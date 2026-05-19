---
description: Write, test and deploy EVM programs in TypeScript
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

EvmScript is an experimental TypeScript library and framework for generating,
testing and deploying gas-efficient Ethereum Virtual Machine (EVM) programs all
from the TypeScript ecosystem.

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
      <td><strong>Extreme gas efficiency</strong></td>
      <td>
        For each statement, EvmScript searches for the minimum-cost stack
        choreography in the abstract stack model
      </td>
      <td>
        <a href="core-concepts/abstract-stack-problem.md">
          abstract-stack-problem.md
        </a>
      </td>
    </tr>
    <tr>
      <td><strong>Fully typed</strong></td>
      <td>
        The program is composed of <code>Fragments</code> with type checked
        stack effects
      </td>
      <td>
        <a href="core-concepts/typed-stack-algebra.md">
          typed-stack-algebra.md
        </a>
      </td>
    </tr>
    <tr>
      <td><strong>TypeScript native</strong></td>
      <td>
        EVM programs are written, tested and deployed as regular TypeScript code
      </td>
      <td>
        <a href="https://github.com/KimlikDAO/EvmScript">
          https://github.com/KimlikDAO/EvmScript
        </a>
      </td>
    </tr>
  </tbody>
</table>

EvmScript is built around a novel
[typed stack algebra](core-concepts/typed-stack-algebra.md), allowing us to
generate extremely efficient EVM programs while being type-safe throughout the
compilation.

## Who is this for?

EvmScript is for teams whose costs come from repeatedly executing expensive EVM
programs. It is most useful when shaving gas and bytes from the on-chain side of
an operation compounds over many transactions.

Good fits include:

* protocol teams deploying small, specialized verifiers, proxies, and payout
  programs;
* DeFi operators running liquidations, auctions, rebalances, or batch
  settlements;
* bridge operators, validator committees, and threshold-signature signer sets;
* searchers and solvers submitting execution-heavy settlement transactions;
* any operator who would otherwise hand-write EVM assembly to win gas.

EvmScript is for EVM-side hot paths. It helps when bytecode size, stack
choreography, and per-call gas dominate the cost of an operation.

In those settings, EvmScript can consistently generate bytecode that is
significantly better than hand-written low-level assembly. Optimal stack dances
are highly nontrivial and often counter-intuitive, even in small programs.
EvmScript discovers them through smart, guided combinatorial search.

## Authoring EVM Programs

In EvmScript, EVM programs are authored using regular `.ts` files via calls to
the EvmScript library. Soon we will have `.tsevm` files, which will provide a
much nicer syntax and are lowered to regular `.ts` files through a transpiler.

Because programs live directly inside TypeScript, metaprogramming is just
ordinary TypeScript. You can use functions, loops, arrays, sorting, grouping,
bigints, tests, fixtures, and deployment scripts from the same toolchain you
already use for the rest of your application.

Compilation produces EVM bytecode as `Uint8Array` that you can deploy with
`viem`, `ethers`, `wagmi`, `@kimlikdao/lib`, or whichever Ethereum tooling you
already prefer.

{% hint style="info" %}
`.tsevm` files are very similar to `.tsx` files in that the regular TypeScript
syntax is enhanced with a domain specific language, which is then transpiled
back into a bunch of library calls in regular TypeScript syntax.
{% endhint %}

As an example,

{% code title="merkle.tsevm" overflow="wrap" %}
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

becomes

{% code title="merkle.ts" expandable="true" %}
```typescript
const verifyMerkle = inline(
  { hash: Data, index: Uint, proof: array(Data, depth) },
  ({ hash, index, proof }) => [
    unrollFor(
      [],
      range(32),
      (level) => [
        set(hash, hashPair(
          proof.at(level),
          mul(bitAnd(index, 1), 32),
          hash,
        )),
        set(index, shr(1, index)),
      ],
    ),
    eq(hash, sload(0, Data)),
  ]);
```
{% endcode %}

For now, all code is written in `.ts` files in the lowered format.
