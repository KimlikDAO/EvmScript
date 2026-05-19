# Expressions and Statements

An EvmScript body is the body of an `evm (...) => {}` function in a `.evm.ts`
file. It uses TypeScript syntax with EVM meaning attached to a small set of
constructs. Body items generally fall into one of two categories:

* value-producing `Expression`s;
* effect-oriented statements, such as assignments, typed local bindings, calls,
  labels, and blobs.

Every body item eventually becomes a `Fragment` before assembly. Until then,
most EvmScript code is represented as a small tree of fragments, not as a fixed
sequence of opcodes. That tree is flattened only **after the binder sees the
current stack configuration** and solves an optimization problem. For each
statement, EvmScript uses the exact stack in front of it and the values future
statements still need to search for the minimum-cost fragment that computes the
source expression.

Crucially, **the compiler is free to evaluate the nodes inside a single
expression in whatever order minimizes gas cost**. EvmScript code should not
depend on the evaluation order of subexpressions, or on the order in which side
effects inside one expression tree are observed.

This is less exotic than it may sound. C also leaves the evaluation order of
many subexpressions unspecified, including function arguments and most operator
operands. The rule of thumb is the same: expressions describe values and
dependencies; statements describe sequencing.

When exact evaluation order matters, the expression should be split into
separate statements in the `.evm.ts` body.

## Expressions

An `Expression` represents a value-producing computation as a tree. Each node
has an internal fragment with a stack signature, and its children provide the
values required by that signature. Expression leaves can be literals, stack
references, calldata references, or closed expression nodes with no inputs.

For example, inside an `.evm.ts` function:

```typescript
e = m * c * c;
```

The expression here is `mul(m, mul(c, c))`, representing `m * c * c`. The outer
`mul` depends on `m` and the inner `mul(c, c)`. Each `mul` node has a fragment
with signature `(Uint, Uint) -> 2|Uint`, so its children must produce two
`Uint` values and the node itself produces one `Uint`.

Expressions are not emitted immediately. They form a dependency tree that the
binder can later schedule against the current stack.

## StackRef

A `StackRef` is a compile-time reference to a named value currently living on
the EVM stack.

```typescript
const send = evm (amount: Weis): Bool => {
  return call(0, recipient, amount, 0, 0, 0, 0);
}
```

The parameter `amount` is not a JavaScript number at runtime. In the generated
form it becomes a `StackRef`, roughly:

```typescript
inline({ amount: Weis }, ({ amount }) => [
  call(0, recipient, amount, 0, 0, 0, 0)
])
```

Names are resolved at binding time. If a name is not present in the current
stack signature, binding fails with an unknown stack name error.

Stack references are also how reassignment-like code works. In the Merkle
example, `hash = ...` binds the new expression result to the same logical name
and erases the older binding. The generated form uses `set(hash, ...)`.

## CalldataRef

A `CalldataRef` is an expression that loads a typed word from calldata.

```typescript
calldataLoad(0, Data)
calldataLoad(32, Uint)
```

For fixed calldata layouts, `calldata()` and `array()` build typed references
from TypeScript test or deployment code:

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
* assignment and typed local declarations, lowered to `SetStatement`s.
* `Label`: a symbolic position in bytecode.
* `Blob`: raw byte data placed in the program.

Statements impose order. The binder may reorder work inside a single expression,
but it lowers body statements from left to right.

Bodies may be nested arrays of statements. In `.evm.ts`, `static for` marks a
generation-time loop whose repeated statement bodies are produced by the
transpiler:

```typescript
static for (const level in range(depth)) {
  hash = hashPairAtOffset(proof[level], (index & 1) * 32, hash);
  index = index >> 1;
}
```

That syntax lowers to `staticFor(...)`, `set(...)`, `.at(...)`, and helper calls
such as `mul(...)`, `bitAnd(...)`, and `shr(...)`. The EVM-shaped TypeScript is
the authoring form; the lowered call tree is the compiler target.

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
