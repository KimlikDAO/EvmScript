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

  expect(generate(fn)).toBe(`inline({ hash: Data, proof: array(Data, 32) }, ({ hash, proof }) => [
  mstore(0, proof[0]),
  keccak256(0, 64)
])`);
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
