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

EvmScript is an EVM language inside TypeScript: write `.evm.ts` files and get
lean EVM bytecode. It is an experimental language, compiler, and library stack
for writing gas-optimized EVM programs from the TypeScript ecosystem.

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
        Programs are authored in <code>.evm.ts</code>, transpiled like
        <code>.tsx</code>, and tested, generated, and deployed with the
        ordinary TypeScript toolchain.
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
* any code path where you would otherwise hand-write EVM assembly to cut gas.

The point is not to make EVM programming look high-level at all costs. The
point is to keep the authoring environment TypeScript-native while giving the
compiler direct control over stack layout, liveness, bytecode size, and opcode
choice.

Dropping down to Yul or hand-written assembly does not automatically get you
close to optimal EVM. For compute-heavy code, the best `DUP`/`SWAP` choreography
is often highly non-trivial and counter-intuitive; EvmScript searches that space
directly. For storage-heavy code, storage costs may dominate, but when stack
motion and arithmetic matter, human-written low-level code can leave a lot of
gas on the table.

## Authoring model

EvmScript programs are written in `.evm.ts` files. They are TypeScript modules
with a small EVM language extension: `evm (...) => {}` functions, typed EVM
words, fixed arrays such as `Data[32]`, stack-style reassignment, and
`unroll for` loops.

Under the hood, `.evm.ts` works like `.tsx`: the syntax is parsed and
transpiled back into ordinary TypeScript library calls before Bun runs the
module. The lowered form is an implementation detail. You do not write
`inline(...)`, `set(...)`, or `unrollFor(...)` any more than React authors write
`jsx("div", ...)` by hand.

Because programs live directly inside TypeScript, metaprogramming is ordinary
TypeScript. You can use functions, loops, arrays, sorting, grouping, bigints,
tests, fixtures, and deployment scripts from the same toolchain you already use
for the rest of your application.

Compilation produces EVM bytecode as a `Uint8Array`, ready to deploy with
`viem`, `ethers`, `wagmi`, `@kimlikdao/lib`, or whichever Ethereum tooling you
prefer.

Every EVM construct supported by the current compiler is available through
`.evm.ts` syntax. The library-call form still exists because it is the stable
target of the transpiler and the place where the core optimizer works, but it is
not the normal authoring surface.

## A taste of `.evm.ts`

EvmScript code looks like a small EVM language inside TypeScript:

{% code title="merkle.evm.ts" overflow="wrap" %}
```typescript
const verifyMerkle = evm (
  hash: Data,
  index: Uint,
  proof: Data[32]
): Bool => {
  unroll for (const level in range(32)) {
    hash = hashPair(proof[level], (index & 1) * 32, hash);
    index = index >> 1;
  }
  return hash == sload<Data>(0);
}
```
{% endcode %}

That is the code you write. It lowers into regular TypeScript calls similar to
the following:

{% code title="generated TypeScript" expandable="true" %}
```typescript
const verifyMerkle = inline(
  { hash: Data, index: Uint, proof: array(Data, 32) },
  ({ hash, index, proof }) => [
    unrollFor(
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

Start with [Typed stack algebra](core-concepts/typed-stack-algebra.md) for the
core representation, then read
[Expressions and Statements](core-concepts/expressions-and-statements.md) and
[Functions](core-concepts/functions.md) to see what `.evm.ts` lowers into.
The [Abstract stack problem](core-concepts/abstract-stack-problem.md) page
explains the search problem behind EvmScript's stack choreography.
