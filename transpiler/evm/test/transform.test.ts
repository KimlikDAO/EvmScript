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

    const keep = (x: number) => x + 1;
    const verify = inline({ hash: Data }, ({ hash }) => [
      hash
    ]);
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
    const verify = inline({ hash: Data }, ({ hash }) => [
      hash
    ]);
  `));
});

test("replaces evm function declarations with const inline bodies", () => {
  const source = stripIndent(`
    evm function verify(hash: Data): Data {
      return hash;
    }
  `);

  expect(transformEvmSource(source)).toBe(stripIndent(`
    const verify = inline({ hash: Data }, ({ hash }) => [
      hash
    ]);
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
