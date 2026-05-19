# Functions

{% hint style="info" %}
Currently, `.evm.ts` functions lower to inline functions.
{% endhint %}

Functions are the main authoring unit in `.evm.ts`. An `evm (...) => {}` body
looks like TypeScript, but it lowers to a reusable EvmScript builder with a
typed interface and a bytecode-producing body.

## EVM functions

You normally write this:

```typescript
const hashPairAtOffset = evm (
  sibling: Data,
  offset: Uint,
  hash: Data,
): Data => {
  mstore(offset, hash);
  mstore(32 - offset, sibling);
  return keccak256(0, 64);
}
```

The transpiler turns that into an `inline(schema, fn)` call:

```typescript
const hashPairAtOffset = inline(
  { sibling: Data, offset: Uint, hash: Data },
  ({ sibling, offset, hash }) => [
    mstore(offset, hash),
    mstore(sub(32, offset), sibling),
    keccak256(0, 64)
  ]
)
```

The `.evm.ts` parameter list declares the EVM types. In the generated callback,
scalar parameters become `StackRef`s and fixed arrays such as `Data[32]` become
array references.

For expression-producing EVM functions, the body must end with a single-output
expression. Earlier statements are lowered for their side effects and for any
named values they leave on the stack. The last expression becomes the generated
inline function's return value.

There is one important extension for programs such as proxies and init code:
halting bodies are also valid. If an EVM function executes `ret(...)` or
`returnOrRevert(...)`, the function can end there instead of returning a stack
value.

When an inline function has only scalar parameters, EvmScript can build its
fragment once. When the function accepts array parameters, the array references
are supplied at the call site, so the fragment is built when the function is
called.

Inline functions are intentionally not runtime calls. They are expanded during
code generation, which allows the binder and solver to optimize across the
function body as if it had been written in place.

## Host TypeScript

Because `.evm.ts` is still TypeScript, ordinary helper code can construct and
return EVM functions. The batch-send example groups recipients with normal
TypeScript sorting, then returns an `evm () => {}` function for the bytecode
body. The proxy example builds runtime bytecode with one EVM function and embeds
it as a blob in another.

That split is deliberate: use TypeScript for generation, data shaping, tests,
and deployment plumbing; use `evm (...) => {}` for the EVM program itself.
