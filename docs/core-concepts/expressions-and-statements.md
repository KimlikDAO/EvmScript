# Expressions and Statements

An EvmScript body is a sequence of body items. Most user-written body items fall
into one of two categories:

* value-producing `Expression`s;
* effect-oriented statements, such as `set(...)`, labels, and blobs.

Every body item eventually becomes a `Fragment` before assembly. Until then,
most EvmScript code is represented as a small tree of fragments, not as a fixed
sequence of opcodes. That tree is flattened only **after the binder sees the
current stack configuration** and solves an optimization problem. This is the
central bet of EvmScript: for each statement, given the stack in front of it and
the values future statements still need, the compiler goes after the
minimum-cost fragment that still computes the expression the user wrote.

Crucially, **the compiler is free to evaluate the nodes inside a single
expression in whatever order minimizes gas cost**. A programmer should not rely
on the evaluation order of subexpressions, or on the order in which side effects
inside one expression tree are observed.

If an exact evaluation order is required, break the expression into statements
and write those statements in the desired order.

## Expressions

An `Expression` represents a value-producing computation as a tree. Each node
has an internal fragment with a stack signature, and its children provide the
values required by that signature. Expression leaves can be literals, stack
references, calldata references, or closed expression nodes with no inputs.

For example:

```typescript
const hashPairAtOffset = inline(
  { sibling: Data, offset: Uint, hash: Data },
  ({ sibling, offset, hash }) => [
    mstore(offset, hash),
    mstore(sub(32, offset), sibling),
    keccak256(0, 64),
  ],
);
```

Here `sub(32, offset)` and `keccak256(0, 64)` are expressions. The fragment for
each expression declares what types it expects from its children and what it
ensures after it runs.

Expressions are not emitted immediately. They form a dependency tree that the
binder can later schedule against the current stack.

## StackRef

A `StackRef` is a compile-time reference to a named value currently living on the
EVM stack.

```typescript
import { get } from "../core/expression";

const amount = get("amount", Weis);
```

Most users get `StackRef`s from `inline` parameters:

```typescript
const dec = inline({ x: Uint }, ({ x }) => sub(x, 1));
```

Names are resolved at binding time. If a name is not present in the current
stack signature, binding fails with an unknown stack name error.

Stack references are also how reassignment-like code works. In the Merkle
example, `set(hash, ...)` binds the new expression result to the same logical
name and erases the older binding.

## CalldataRef

A `CalldataRef` is an expression that loads a typed word from calldata.

```typescript
calldataLoad(0, Data)
calldataLoad(32, Uint)
```

For fixed calldata layouts, `calldata()` and `array()` build typed references:

```typescript
const cd = calldata({
  leaf: [0, Data],
  index: [32, Uint],
  proof: [64, array(Data, 32)],
});

cd.proof.at(0);
```

Calldata arrays are fixed-length compile-time layouts. Calling `.at(index)`
returns a `CalldataRef` for the word at that position and checks the index
against the declared length.

## Statement

A `Statement` is any body item that can be lowered into a fragment. This
includes:

* `ExpressionStatement`: emitted for its side effect or result.
* `SetStatement`: created with `set(...)` to bind expression output names.
* `Label`: a symbolic position in bytecode.
* `Blob`: raw byte data placed in the program.

Statements impose order. The binder may reorder work inside a single expression,
but it lowers body statements from left to right.

Bodies may be nested arrays of statements. `unrollFor` uses this to let ordinary
TypeScript loops generate repeated statement bodies:

```typescript
unrollFor(
  [],
  range(depth),
  (level) => [
    set(hash, hashPairAtOffset(
      proof.at(level),
      mul(bitAnd(index, 1), 32),
      hash,
    )),
    set(index, shr(1, index)),
  ],
);
```

## Binding

Statements are turned into fragments through an optimization process called
binding.

At each statement boundary, EvmScript knows the current stack signature. Binding
takes:

* the current signature,
* the expression that must be computed,
* the set of named stack values that must remain available afterward.

It then asks the stack solver for the best choreography of stack actions and
expression fragments under the current cost model. The result is ordinary
bytecode: `DUP`, `SWAP`, `POP`, literal pushes, and the opcode fragments needed
to compute the expression.

This is the key step that lets EvmScript authoring stay high-level while still
producing near-optimal stack-machine code.
