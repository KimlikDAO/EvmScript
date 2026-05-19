import { expect, test } from "bun:test";
import { stripIndent } from "../../util/testing/source";
import { transformEvmSource } from "../transform";

test("replaces evm arrow functions with generated inline bodies", () => {
  const source = stripIndent(`
    import { Data } from "../core/types";

    const keep = (x: number) => x + 1;
    const verify = evm (hash: Data): Data => {
      return hash;
    };
    const done = true;
  `);

  expect(transformEvmSource(source)).toBe(stripIndent(`
    import { Data } from "../core/types";
    import { bitAnd, call, eq, keccak256, mstore, mul, range, shr, sload, sub } from "../core/builtins";
    import { inline } from "../core/function";
    import { array } from "../core/array";
    import { set, unrollFor } from "../core/statement";
    import { get } from "../core/expression";

    const keep = (x: number) => x + 1;
    const verify = inline(
      { hash: Data },
      ({ hash }) => [
        hash
      ]
    );
    const done = true;
  `));
});

test("replaces evm function expressions with generated inline bodies", () => {
  const source = stripIndent(`
    const verify = evm function(hash: Data): Data {
      return hash;
    };
  `);

  expect(transformEvmSource(source)).toBe(stripIndent(`
    import { bitAnd, call, eq, keccak256, mstore, mul, range, shr, sload, sub } from "../core/builtins";
    import { inline } from "../core/function";
    import { array } from "../core/array";
    import { set, unrollFor } from "../core/statement";
    import { get } from "../core/expression";
    const verify = inline(
      { hash: Data },
      ({ hash }) => [
        hash
      ]
    );
  `));
});

test("replaces evm function declarations with const inline bodies", () => {
  const source = stripIndent(`
    evm function verify(hash: Data): Data {
      return hash;
    }
  `);

  expect(transformEvmSource(source)).toBe(stripIndent(`
    import { bitAnd, call, eq, keccak256, mstore, mul, range, shr, sload, sub } from "../core/builtins";
    import { inline } from "../core/function";
    import { array } from "../core/array";
    import { set, unrollFor } from "../core/statement";
    import { get } from "../core/expression";
    const verify = inline(
      { hash: Data },
      ({ hash }) => [
        hash
      ]
    );
  `));
});

test("keeps ordinary functions source-preserved", () => {
  const source = stripIndent(`
    function plain(hash: Data): Data {
      return hash;
    }

    const arrow = (hash: Data): Data => hash;
  `);

  expect(transformEvmSource(source)).toBe(source);
});

test("indents nested evm function replacements", () => {
  const source = stripIndent(`
    const make = () => {
      return evm (): Bool => {
        return call(0, recipient, amount, 0, 0, 0, 0);
      };
    }
  `);

  expect(transformEvmSource(source)).toBe(stripIndent(`
    import { bitAnd, call, eq, keccak256, mstore, mul, range, shr, sload, sub } from "../core/builtins";
    import { inline } from "../core/function";
    import { array } from "../core/array";
    import { set, unrollFor } from "../core/statement";
    import { get } from "../core/expression";
    const make = () => {
      return inline(
        {},
        ({}) => [
          call(0, recipient, amount, 0, 0, 0, 0)
        ]
      );
    }
  `));
});
