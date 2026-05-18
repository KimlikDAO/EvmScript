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

<button type="button" class="button primary" data-action="ask" data-icon="gitbook-assistant">Ask a question...</button>

EvmScript is an experimental TypeScript library and framework for generating, testing and deploying Ethereum Virtual Machine (EVM) programs all from the TypeScript ecosystem.

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Extreme gas efficiency</strong></td><td>For each statement, an optimal stack choreography is found via an A* search</td><td><a href="core-concepts/the-solver.md">the-solver.md</a></td></tr><tr><td><strong>Fully typed</strong></td><td>The program is composed of <code>Fragments</code> with type checked stack effects</td><td><a href="core-concepts/typed-stack-algebra.md">typed-stack-algebra.md</a></td></tr><tr><td><strong>TypeScript native</strong></td><td>EVM programs are written, tested and deployed as regular TypeScript code</td><td></td></tr></tbody></table>

EvmScript is built around a novel [typed stack algebra](core-concepts/typed-stack-algebra.md), allowing us to generate extremely efficient EVM programs while being type-safe throughout the compilation.

In EvmScript, EVM programs are authored using regular `.ts`  files via calls to the EvmScript library. Soon we will have `.tsevm` files, which will provide a much nicer syntax and are lowered to regular `.ts` files through a transpiler.

{% hint style="info" %}
&#x20;`.tsevm` files are very similar to `.tsx` files in that the regular TypeScript syntax is enhanced with a domain specific language, which is then transpiled back into a bunch of library calls in regular TypeScript syntax.
{% endhint %}

As an example,

{% code title="merkle.tsevm" overflow="wrap" %}
```typescript
const verifyMerkle = evm (hash: Data, index: Uint, proof: Data[32]): Bool => {
  unroll for (const level in range(32)) {
    hash = hashPair(proof[level], (index & 1) * 32, hash);
    index = index >> 1;
  }
  return hash == sload<Data>(0);
}
```
{% endcode %}

&#x20;becomes

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
