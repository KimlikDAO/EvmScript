<h1><img src="https://raw.githubusercontent.com/KimlikDAO/dapp/ana/components/icon.svg" align="center" height="44"> EvmScript</h1>

[![Tests](https://img.shields.io/github/actions/workflow/status/KimlikDAO/EvmScript/test.yml?branch=main)](https://github.com/KimlikDAO/EvmScript/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@kimlikdao/evmscript.svg)](https://www.npmjs.com/package/@kimlikdao/evmscript)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

EvmScript is an EVM language embedded in TypeScript. Programs live in `.evm.ts`
modules and compile to lean EVM bytecode, while the surrounding generation,
testing, and deployment workflow stays in the TypeScript ecosystem.

It is built around a typed stack algebra: EVM programs are composed from
`Fragment`s whose stack effects are checked at compile time, then assembled into
compact bytecode. For each statement, EvmScript searches for the minimum-cost
stack choreography using a smart and guided combinatorial search instead of
relying on hand-written `DUP`/`SWAP` sequences.

## Why EvmScript?

EvmScript is for EVM-side hot paths where bytecode size, stack choreography, and
per-call gas dominate the cost of an operation. It is a good fit for small,
specialized verifiers, proxies, payout programs, settlement transactions,
liquidation bots, auctions, bridges, and other systems where shaving gas and
bytes compounds over many transactions.

The goal is to keep the authoring experience TypeScript-native while giving the
compiler room to produce bytecode that is hard to match by hand. Optimal stack
dances are often non-obvious even in small programs; EvmScript models that
problem directly and searches the state space using advanced combinatorial
algorithms.

## Install

```sh
bun add @kimlikdao/evmscript
```

Requires Bun and TypeScript. The project currently tests against Bun and
TypeScript from the package lockfile.

## Authoring Model

EvmScript programs are authored in `.evm.ts` files. These are TypeScript
modules with a small EVM syntax extension: `evm (...) => {}` functions, typed
EVM words, fixed arrays like `Data[32]`, stack-resident local variables, and
`static for` loops.

The model is similar to `.tsx`: the author-facing syntax is transpiled into
regular TypeScript calls before the runtime executes the module. The lowered
`inline(...)`, `set(...)`, and `staticFor(...)` form remains the compiler
target, but it is not the normal surface for writing EvmScript programs.

A Merkle verifier, for example, can be expressed in the EVM syntax as:

```ts
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

The compiler lowers this into regular TypeScript library calls similar to:

```ts
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

Because EVM functions are embedded in TypeScript, metaprogramming happens in
ordinary TypeScript rather than in a separate macro language. Generation-time
code can use functions, loops, arrays, sorting, or any valid TypeScript code.
Similarly fixtures, tests, and deployment scripts live side by side in the same
language. The batch send and proxy examples use TypeScript helper code to
construct EVM functions, while the bytecode bodies remain in
`evm () => {}` syntax.

## Core Ideas

- **Typed stack algebra**: bytecode fragments carry typed stack signatures, so
  composition fails early when stack values do not line up.
- **EVM syntax inside TypeScript**: `.evm.ts` files lower expressions,
  assignments, loops, and function bodies into fragment composition.
- **Solver-guided assembly**: the binder converts each statement into an
  abstract stack problem, then a direct strategy or A* search finds the optimal
  opcode path for that modeled problem while preserving future-live values.
- **TypeScript-native deployment**: compilation produces EVM bytecode as a
  `Uint8Array`, ready to deploy with `viem`, `ethers`, `wagmi`,
  `@kimlikdao/lib`, or the Ethereum tooling you already use.

## Examples

- [`examples/merkle.evm.ts`](examples/merkle.evm.ts): a Merkle proof verifier
- [`examples/batchSend.evm.ts`](examples/batchSend.evm.ts): grouped batch ETH sends
- [`examples/proxies.evm.ts`](examples/proxies.evm.ts): small proxy programs

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
