import { expect, test } from "bun:test";
import { TsParser } from "../../parser/tsParser";
import { stripIndent } from "../../util/testing/source";
import { generate } from "../generator";

test("prints function bodies as body arrays", () => {
  const ast = TsParser.parse(stripIndent(`
    const verify = evm (
      hash: Data,
      proof: Data[32],
    ): Data => {
      mstore(0, proof[0]);
      return keccak256(0, 64);
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const body = declaration.declarations[0].init.body;

  expect(generate(body)).toBe(`[
  mstore(0, proof[0]),
  keccak256(0, 64)
]`);
});

test("prints evm functions as inline expressions", () => {
  const ast = TsParser.parse(stripIndent(`
    const verify = evm (
      hash: Data,
      proof: Data[32],
    ): Data => {
      mstore(0, proof[0]);
      return keccak256(0, 64);
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const fn = declaration.declarations[0].init;

  expect(generate(fn)).toBe(`inline(
  { hash: Data, proof: array(Data, 32) },
  ({ hash, proof }) => [
    mstore(0, proof.at(0)),
    keccak256(0, 64)
  ]
)`);
});

test("prints merkle-shaped evm body constructs", () => {
  const ast = TsParser.parse(stripIndent(`
    const verify = evm (
      hash: Data,
      index: Uint,
      proof: Data[32],
    ): Bool => {
      static for (const level in range(32)) {
        hash = hashPairAtOffset(proof[level], (index & 1) * 32, hash);
        index = index >> 1;
      }
      return hash == sload<Data>(0);
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const fn = declaration.declarations[0].init;

  expect(generate(fn)).toBe(`inline(
  { hash: Data, index: Uint, proof: array(Data, 32) },
  ({ hash, index, proof }) => [
    staticFor([], range(32), (level) => [
      set(hash, hashPairAtOffset(proof.at(level), mul(bitAnd(index, 1), 32), hash)),
      set(index, shr(1, index))
    ]),
    eq(hash, sload(0, Data))
  ]
)`);
});

test("prints local bindings in zero-parameter evm functions", () => {
  const ast = TsParser.parse(stripIndent(`
    const send = evm (): Bool => {
      const value: Weis = amount;
      static for (const recipient of recipients) {
        call(0, recipient, value, 0, 0, 0, 0);
      }
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const fn = declaration.declarations[0].init;

  expect(generate(fn)).toBe(`inline(
  {},
  ({}) => [
    set("value", Weis, amount),
    staticFor([], recipients, (recipient) => [
      call(0, recipient, get("value"), 0, 0, 0, 0)
    ])
  ]
)`);
});

test("prints runtime range loops as forRange statements", () => {
  const ast = TsParser.parse(stripIndent(`
    const fill = evm (): Bool => {
      for (const i in range(0, 4)) {
        mstore(0, i);
      }
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const fn = declaration.declarations[0].init;

  expect(generate(fn)).toBe(`inline(
  {},
  ({}) => [
    forRange("i", 0, 4, 1, (i) => [
      mstore(0, i)
    ])
  ]
)`);
});

test("prints expression local initializers without literal type wrapping", () => {
  const ast = TsParser.parse(stripIndent(`
    const proxy = evm (): Bool => {
      const success: Bool = delegateCall(gas(), impl, 0, calldataSize(), 0, 0);
      returnOrRevert(success, 0, returndataSize());
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const fn = declaration.declarations[0].init;

  expect(generate(fn)).toBe(`inline(
  {},
  ({}) => [
    set("success", delegateCall(gas(), impl, 0, calldataSize(), 0, 0)),
    returnOrRevert(get("success"), 0, returndataSize())
  ]
)`);
});

test("throws on unsupported evm function parameters", () => {
  const ast = TsParser.parse(stripIndent(`
    const verify = evm ({ hash }: { hash: Data }): Data => {
      return hash;
    };
  `), {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  const declaration = ast.body[0] as any;
  const fn = declaration.declarations[0].init;

  expect(() => generate(fn)).toThrow(
    "EVM function parameters must be identifiers"
  );
});
