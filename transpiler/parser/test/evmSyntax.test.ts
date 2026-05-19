import { expect, test } from "bun:test";
import { parseSource } from "./utils";

function expectNodeType<
  TNode extends { type: string } | null | undefined,
  TType extends NonNullable<TNode>["type"]
>(
  node: TNode,
  type: TType
): asserts node is Extract<NonNullable<TNode>, { type: TType }> {
  expect(node?.type).toBe(type);
}

test("evm function declarations parse as marked FunctionDeclarations", () => {
  const ast = parseSource(`
    evm function verify(hash: Data): Bool {
      return true;
    }
  `);

  const stmt = ast.body[0];
  expectNodeType(stmt, "FunctionDeclaration");
  expect(stmt.evm).toBe(true);
  expect(stmt.async).toBe(false);
  expect(stmt.generator).toBe(false);
  expect(stmt.id.name).toBe("verify");
});

test("evm function expressions parse as marked FunctionExpressions", () => {
  const ast = parseSource(`
    const verify = evm function(hash: Data): Bool {
      return true;
    };
  `);

  const stmt = ast.body[0];
  expectNodeType(stmt, "VariableDeclaration");
  const init = stmt.declarations[0].init;
  expectNodeType(init, "FunctionExpression");
  expect(init.evm).toBe(true);
  expect(init.async).toBe(false);
  expect(init.generator).toBe(false);
});

test("evm arrow functions parse as marked ArrowFunctionExpressions", () => {
  const ast = parseSource(`
    const verify = evm (
      hash: Data,
      index: Uint,
      proof: Data[32],
    ): Bool => {
      return hash == sload<Data>(0);
    };
  `);

  const stmt = ast.body[0];
  expectNodeType(stmt, "VariableDeclaration");
  const init = stmt.declarations[0].init;
  expectNodeType(init, "ArrowFunctionExpression");
  expect(init.evm).toBe(true);
  expect(init.async).toBe(false);
  expect(init.params).toHaveLength(3);

  const proof = init.params[2];
  expectNodeType(proof, "Identifier");
  expect(proof.name).toBe("proof");
  const proofType = proof.typeAnnotation?.typeAnnotation;
  expectNodeType(proofType, "TSIndexedAccessType");
  expect(proofType.objectType.type).toBe("TSTypeReference");
  expect(proofType.indexType.type).toBe("TSLiteralType");
});

test("ordinary functions carry evm false", () => {
  const ast = parseSource(`
    function plain() {}
    const arrow = () => {};
    const genericAsync = async <T>(x: T): T => x;
  `);

  const declaration = ast.body[0];
  expectNodeType(declaration, "FunctionDeclaration");
  expect(declaration.evm).toBe(false);

  const variable = ast.body[1];
  expectNodeType(variable, "VariableDeclaration");
  const arrow = variable.declarations[0].init;
  expectNodeType(arrow, "ArrowFunctionExpression");
  expect(arrow.evm).toBe(false);

  const genericVariable = ast.body[2];
  expectNodeType(genericVariable, "VariableDeclaration");
  const genericAsync = genericVariable.declarations[0].init;
  expectNodeType(genericAsync, "ArrowFunctionExpression");
  expect(genericAsync.evm).toBe(false);
});

test("unroll for loops parse as marked for-in statements", () => {
  const ast = parseSource(`
    const verify = evm (): Bool => {
      unroll for (const level in range(32)) {
        mstore(0, level);
      }
      return true;
    };
  `);

  const stmt = ast.body[0];
  expectNodeType(stmt, "VariableDeclaration");
  const fn = stmt.declarations[0].init;
  expectNodeType(fn, "ArrowFunctionExpression");
  const loop = fn.body.body[0];
  expectNodeType(loop, "ForInStatement");
  expect(loop.unroll).toBe(true);
});
