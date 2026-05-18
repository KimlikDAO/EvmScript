# Expressions and Statements

EvmScript programs are written as TypeScript values, but most author-facing code
is organized around two language-level concepts:

* `Expression`: a value-producing computation.
* `Statement`: a body item that is lowered into bytecode for its effect.

Expressions and statements are still regular TypeScript objects. The distinction
matters because EvmScript can optimize expression evaluation against the stack
that is already available at each statement boundary.

## Expressions

An `Expression` wraps a fragment together with its children. Children may be
literals, stack references, calldata references, or other expressions.

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

Expressions are not emitted immediately. They form a small dependency tree that
the binder can later schedule against the current stack.

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

A `Statement` is any body item that can be lowered into a fragment:

* `Expression`: emitted for its side effect or result.
* `SetStatement`: created with `set(...)` to bind expression output names.
* `Label`: a symbolic position in bytecode.
* `Blob`: raw byte data placed in the program.

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

It then asks the stack solver for a cheap choreography of stack actions and
expression fragments. The result is ordinary bytecode: `DUP`, `SWAP`, `POP`,
literal pushes, and the opcode fragments needed to compute the expression.

This is the key step that lets EvmScript authoring stay high-level while still
producing tight stack-machine code.
