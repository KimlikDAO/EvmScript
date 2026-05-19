---
description: An EVM language inside TypeScript
layout:
  width: default
  title:
    visible: true
  description:
    visible: true
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: false
  metadata:
    visible: false
  tags:
    visible: true
---

# EvmScript

<button
  type="button"
  class="button primary"
  data-action="ask"
  data-icon="gitbook-assistant">
  Ask a question...
</button>

EvmScript is an EVM language embedded in TypeScript. Programs live in `.evm.ts`
modules and compile to lean EVM bytecode, while generation, testing, and
deployment remain in the TypeScript ecosystem.

It is built around a typed stack algebra: programs are composed from
`Fragment`s with type-checked stack effects, then assembled into compact bytecode.
For each statement, EvmScript searches for minimum-cost stack choreography
instead of relying on hand-written `DUP`/`SWAP` sequences.

<table data-card-size="large" data-view="cards">
  <thead>
    <tr>
      <th></th>
      <th></th>
      <th data-type="content-ref"></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Optimal stack motion</strong></td>
      <td>
        The binder turns each statement into an abstract stack problem and lets
        the solver find the minimum-cost opcode path.
      </td>
      <td>
        <a href="core-concepts/abstract-stack-problem.md">
          abstract-stack-problem.md
        </a>
      </td>
    </tr>
    <tr>
      <td><strong>Typed fragments</strong></td>
      <td>
        EVM bytecode fragments carry typed stack signatures, so invalid stack
        composition fails before assembly.
      </td>
      <td>
        <a href="core-concepts/typed-stack-algebra.md">
          typed-stack-algebra.md
        </a>
      </td>
    </tr>
    <tr>
      <td><strong>TypeScript-native</strong></td>
      <td>
        Programs live in <code>.evm.ts</code> modules, transpile like
        <code>.tsx</code>, and share the ordinary TypeScript toolchain used by
        tests, generators, and deployment scripts.
      </td>
      <td>
        <a href="https://github.com/KimlikDAO/EvmScript">
          github.com/KimlikDAO/EvmScript
        </a>
      </td>
    </tr>
  </tbody>
</table>

## Why EvmScript?

EvmScript is for EVM-side hot paths where bytecode size, stack choreography, and
per-call gas dominate the cost of an operation. It is useful when shaving gas
and bytes from the on-chain side compounds across many transactions.

Good fits include:

* small, specialized verifiers, proxies, and payout programs;
* liquidations, auctions, rebalances, and batch settlements;
* bridge operators, validator committees, and threshold-signature signer sets;
* execution-heavy settlement transactions submitted by searchers and solvers;
* code paths where hand-written EVM assembly would otherwise be used to cut gas.

The point is not to make EVM programming look high-level at all costs. The
point is to keep the authoring environment TypeScript-native while giving the
compiler direct control over stack layout, liveness, bytecode size, and opcode
choice.

Dropping down to Yul or hand-written assembly does not automatically approach
optimal EVM. For compute-heavy code, the best `DUP`/`SWAP` choreography is often
highly non-trivial and counter-intuitive; EvmScript searches that space
directly. For storage-heavy code, storage costs may dominate, but when stack
motion and arithmetic matter, human-written low-level code can leave a lot of
gas on the table.

## Authoring model

EvmScript programs are authored in `.evm.ts` files. These are TypeScript
modules with a small EVM language extension: `evm (...) => {}` functions, typed
EVM words, fixed arrays such as `Data[32]`, stack-resident local variables, and
`static for` loops.

The model is similar to `.tsx`: the author-facing syntax is parsed and
transpiled into ordinary TypeScript library calls before Bun runs the module.
The lowered `inline(...)`, `set(...)`, and `staticFor(...)` form remains the
compiler target, but not the primary authoring surface.

Because EVM functions are embedded in TypeScript, metaprogramming happens in
ordinary TypeScript rather than in a separate macro language. Generation-time
code can use functions, loops, arrays, sorting, grouping, bigints, fixtures,
tests, and deployment scripts directly.

Compilation produces EVM bytecode as a `Uint8Array`, ready to deploy with
`viem`, `ethers`, `wagmi`, `@kimlikdao/lib`, or other Ethereum tooling.

The EVM constructs supported by the current compiler are available through
`.evm.ts` syntax. The library-call form remains important as the stable
transpiler target and as the layer where the core optimizer works.

## A taste of `.evm.ts`

EvmScript code reads like a small EVM language inside TypeScript:

{% code title="merkle.evm.ts" overflow="wrap" %}
```typescript
const verifyMerkle = evm (
  hash: Data,
  index: Uint,
  proof: Data[32]
): Bool => {
  static for (const level in range(32)) {
    hash = hashPair(proof[level], (index & 1) * 32, hash);
    index = index >> 1;
  }
  return hash == sload<Data>(0);
}
```
{% endcode %}

This authoring form lowers into regular TypeScript calls similar to the
following:

{% code title="generated TypeScript" expandable="true" %}
```typescript
const verifyMerkle = inline(
  { hash: Data, index: Uint, proof: array(Data, 32) },
  ({ hash, index, proof }) => [
    staticFor(
      [],
      range(32),
      (level) => [
        set(hash, hashPairAtOffset(
          proof.at(level),
          mul(bitAnd(index, 1), 32),
          hash,
        )),
        set(index, shr(1, index)),
      ],
    ),
    eq(hash, sload(0, Data)),
  ],
);
```
{% endcode %}

## How to read these docs

The core representation starts with
[Typed stack algebra](core-concepts/typed-stack-algebra.md).
[Expressions and Statements](core-concepts/expressions-and-statements.md) and
[Functions](core-concepts/functions.md) describe the generated representation
behind `.evm.ts`. The
[Abstract stack problem](core-concepts/abstract-stack-problem.md) page explains
the search problem behind EvmScript's stack choreography.
