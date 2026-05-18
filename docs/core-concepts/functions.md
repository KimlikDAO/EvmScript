# Functions

{% hint style="info" %}
Currently, only inline functions are implemented.
{% endhint %}

Functions are reusable EvmScript builders. They describe a typed interface and a
body, then produce an expression when called.

## Inline functions

`inline(schema, fn)` creates a function-like expression builder.

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

The schema declares the function parameters and their EVM types. The callback
receives `StackRef`s for scalar parameters and array references for array
parameters.

An inline body must end with a single-output expression. Earlier statements are
lowered for their side effects and for any named values they leave on the stack.
The last expression becomes the inline function's return value.

When an inline function has only scalar parameters, EvmScript can build its
fragment once. When the function accepts array parameters, the array references
are supplied at the call site, so the fragment is built when the function is
called.

Inline functions are intentionally not runtime calls. They are expanded during
code generation, which allows the binder and solver to optimize across the
function body as if it had been written in place.
