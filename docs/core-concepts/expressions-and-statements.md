# Expressions and Statements

In EvmScript a body consists of a sequence of

* `Expression`: a value-producing computation or
* `Statement`: a computation that has some effects but does not produce a value.

While each piece of code eventually becomes a `Fragment` before being assembled, most user written code is an `Expression` or a `Statement` which is roughly a tree of `Fragment`s. This tree of `Fragment`s is flattened only **after seeing the current stack configuration** and through solving an optimization problem. This adaptivity allows us to find the most gas efficient `Fragment` that still computes the exact expression the user wrote.

Crucially, in EvmScript, **the compiler is free to evaluate any expression in the order that minimizes the gas cost**. That means that the programmer has no guarantees about the evaluation order within an expression and therefore in which order the side effects will be observed.

If an exact evaluation order is required, the expression needs to be broken into statements and written line by line in the order desired.

## Expressions

An `Expression` represents a value producing computation as a tree: each node has an internal fragment with a certain signature and a children that ensure the stack signaure requires by this fragment. Expression leaves can be `Expression` nodes with no input, stack references or calldata references.

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

Here `sub(32, offset)` and `keccak256(0, 64)` are expressions. The fragment for each expression declares what types it expects from its children and what it ensures after it runs.

Expressions are not emitted immediately. They form a small dependency tree that the binder can later schedule against the current stack.

## StackRef

A `StackRef` is a compile-time reference to a named value currently living on the EVM stack.

```typescript
import { get } from "../core/expression";

const amount = get("amount", Weis);
```

Most users get `StackRef`s from `inline` parameters:

```typescript
const dec = inline({ x: Uint }, ({ x }) => sub(x, 1));
```

Names are resolved at binding time. If a name is not present in the current stack signature, binding fails with an unknown stack name error.

Stack references are also how reassignment-like code works. In the Merkle example, `set(hash, ...)` binds the new expression result to the same logical name and erases the older binding.

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

Calldata arrays are fixed-length compile-time layouts. Calling `.at(index)` returns a `CalldataRef` for the word at that position and checks the index against the declared length.

## Statement

A `Statement` is any body item that can be lowered into a fragment:

* `Expression`: emitted for its side effect or result.
* `SetStatement`: created with `set(...)` to bind expression output names.
* `Label`: a symbolic position in bytecode.
* `Blob`: raw byte data placed in the program.

Bodies may be nested arrays of statements. `unrollFor` uses this to let ordinary TypeScript loops generate repeated statement bodies:

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

Statements are turned into fragments through an optimization process called binding.

At each statement boundary, EvmScript knows the current stack signature. Binding takes:

* the current signature,
* the expression that must be computed,
* the set of named stack values that must remain available afterward.

It then asks the stack solver for a cheap choreography of stack actions and expression fragments. The result is ordinary bytecode: `DUP`, `SWAP`, `POP`, literal pushes, and the opcode fragments needed to compute the expression.

This is the key step that lets EvmScript authoring stay high-level while still producing tight stack-machine code.
