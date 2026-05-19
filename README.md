<h1><img src="https://raw.githubusercontent.com/KimlikDAO/dapp/ana/components/icon.svg" align="center" height="44"> EvmScript</h1>

[![Tests](https://img.shields.io/github/actions/workflow/status/KimlikDAO/EvmScript/test.yml?branch=main)](https://github.com/KimlikDAO/EvmScript/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@kimlikdao/evmscript.svg)](https://www.npmjs.com/package/@kimlikdao/evmscript)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/d18m/@kimlikdao/evmscript.svg)](https://www.npmjs.com/package/@kimlikdao/evmscript)

EvmScript is an experimental TypeScript library and framework for generating,
testing, and deploying gas-efficient Ethereum Virtual Machine programs from the
TypeScript ecosystem.

It is built around a typed stack algebra: EVM programs are composed from
`Fragment`s whose stack effects are checked at compile time, then assembled into
compact bytecode. For each statement, EvmScript searches for low-cost stack
choreography instead of relying on hand-written `DUP`/`SWAP` sequences.

## Why EvmScript?

EvmScript is for EVM-side hot paths where bytecode size, stack choreography, and
per-call gas dominate the cost of an operation. It is a good fit for small,
specialized verifiers, proxies, payout programs, settlement transactions,
liquidation bots, auctions, bridges, and other systems where shaving gas and
bytes compounds over many transactions.

The goal is to keep the authoring experience TypeScript-native while giving the
compiler room to produce bytecode that is hard to match by hand. Optimal stack
dances are often non-obvious even in small programs; EvmScript models that
problem directly and searches the state space.

## Install

```sh
bun add @kimlikdao/evmscript
```

Requires Bun and TypeScript. The project currently tests against Bun and
TypeScript from the package lockfile.

## Authoring Model

Today, EvmScript programs are written in ordinary `.ts` files using the lowered
library API. The upcoming `.tsevm` syntax will work like a TypeScript language
extension, similar in spirit to `.tsx`: domain-specific syntax is transpiled
back into regular TypeScript library calls.

For example, a future `.tsevm` Merkle verifier could be written as:

```ts
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

That author-facing syntax lowers into the library form used by the compiler
today:

```ts
const verifyMerkle = inline(
  { hash: Data, index: Uint, proof: array(Data, depth) },
  ({ hash, index, proof }) => [
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
    ),
    eq(hash, sload(0, Data)),
  ],
);
```

Because programs live directly inside TypeScript, metaprogramming stays
ordinary TypeScript: functions, loops, arrays, sorting, grouping, fixtures,
tests, and deployment scripts all come from the same toolchain.

## Core Ideas

- **Typed stack algebra**: bytecode fragments carry typed stack signatures, so
  composition fails early when stack values do not line up.
- **Expression and statement lowering**: TypeScript builders lower expressions,
  assignments, loops, and function bodies into fragment composition.
- **Solver-guided assembly**: the binder converts each statement into an
  abstract stack problem, then a direct strategy or A* search finds a cheap
  opcode path that preserves future-live values.
- **TypeScript-native deployment**: compilation produces EVM bytecode as a
  `Uint8Array`, ready to deploy with `viem`, `ethers`, `wagmi`,
  `@kimlikdao/lib`, or the Ethereum tooling you already use.

## Examples

- [`examples/merkle.ts`](examples/merkle.ts): a Merkle proof verifier
- [`examples/batchSend.ts`](examples/batchSend.ts): grouped batch ETH sends
- [`examples/proxies.ts`](examples/proxies.ts): small proxy programs

## Development

```sh
bun install
bunx --no-install tsc -p .
bun test
```

The GitHub workflow runs both the TypeScript typecheck and the Bun unit tests.

## Documentation

The docs in [`docs/`](docs/README.md) cover the compiler model in more detail:

- [`Typed stack algebra`](docs/core-concepts/typed-stack-algebra.md)
- [`Expressions and Statements`](docs/core-concepts/expressions-and-statements.md)
- [`Functions`](docs/core-concepts/functions.md)
- [`Abstract stack problem`](docs/core-concepts/abstract-stack-problem.md)
