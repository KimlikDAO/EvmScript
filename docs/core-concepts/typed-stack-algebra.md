# Typed stack algebra

EvmScript generates EVM programs by composing small pieces of bytecode with
typed stack effects. These pieces are called `Fragment`s.

A `Fragment` has two parts:

* `signature`: a typed description of the fragment's stack effect.
* `code`: the EVM bytecodes executed by the fragment.

The typed stack algebra is the layer that lets EvmScript stitch fragments
together safely before bytecode is assembled. If two fragments do not agree on
the types they exchange through the stack, composition fails.

## Signature

A signature describes the local stack effect of a fragment:

```typescript
gas:    () -> 0|Uint
add:    (Uint, Uint) -> 2|Uint
rotate: (Addr, Uint, Word) -> 3|Word, Addr, Uint
```

The rightmost stack position is the top of stack. For example, the signature
`(Uint, Uint) -> 2|Uint` means:

* `expect`: `(Uint, Uint)` must be present on top of the stack.
* `pop`: `2` stack items are consumed.
* `ensure`: `Uint` is pushed back.

Signatures can also carry names for ensured values:

```typescript
() -> 0|amount: Weis, owner: Addr
```

Names are not EVM values. They are compile-time labels that let later statements
refer to stack-resident values.

Some terminal fragments also carry a halt marker. For example, a fragment that
emits `RETURN` or `REVERT` stops normal control flow, so later fragments do not
add further stack requirements to the composed signature.

## Types

EvmScript types are compile-time classifications for EVM words. They do not add
runtime tags to bytecode, but they make invalid stack composition fail early.

<table>
  <thead>
    <tr>
      <th width="100">Name</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>Word</code></td>
      <td>
        The top type. A value whose more specific interpretation is not known.
      </td>
    </tr>
    <tr>
      <td><code>Uint</code></td>
      <td>Unbranded integer word.</td>
    </tr>
    <tr>
      <td><code>Weis</code></td>
      <td>A <code>Uint</code> subtype used for wei amounts.</td>
    </tr>
    <tr>
      <td><code>Locn</code></td>
      <td>A <code>Uint</code> subtype used for calldata and memory offsets.</td>
    </tr>
    <tr>
      <td><code>Size</code></td>
      <td>A <code>Uint</code> subtype used for calldata and memory sizes.</td>
    </tr>
    <tr>
      <td><code>Addr</code></td>
      <td>An Ethereum address.</td>
    </tr>
    <tr>
      <td><code>Data</code></td>
      <td>
        A non-numeric EVM word, commonly used for storage, memory, and hashes.
      </td>
    </tr>
    <tr>
      <td><code>Bool</code></td>
      <td>A boolean word, represented in the EVM as 0 or 1.</td>
    </tr>
  </tbody>
</table>

The type relation is intentionally simple: a subtype can be used where one of
its supertypes is expected. For example, `Weis` is assignable to `Uint`, and
`Uint` is assignable to `Word`.

## Composition

Fragments compose generically. Composition computes the overall stack effect of
a sequence of fragments without needing to know what the bytecode means.

For example, suppose we have three fragments:

```typescript
pushX: () -> 0|Uint
pushY: () -> 0|Uint
add:   (Uint, Uint) -> 2|Uint
```

Composing them gives a closed fragment:

```typescript
compose(pushX, pushY, add): () -> 0|Uint
```

The two `Uint`s produced by `pushX` and `pushY` satisfy the expectation of
`add`, and `add` consumes them to produce the final `Uint`.

The same logic works even when some inputs come from the stack before the
composed fragment starts:

```typescript
pushY: () -> 0|Uint
add:   (Uint, Uint) -> 2|Uint

compose(pushY, add): (Uint) -> 1|Uint
```

Here the composed fragment still expects one `Uint` from its caller. The other
`Uint` is produced internally by `pushY`.

If a later fragment expects a type that is incompatible with the produced type,
composition throws a type error.

Composition is associative: grouping does not change the final stack effect.

```typescript
compose(a, compose(b, c)) == compose(compose(a, b), c)
```

This property is important because larger EvmScript programs are built by
lowering nested expressions, statements, function bodies, and generated code
into ordinary fragment composition.
