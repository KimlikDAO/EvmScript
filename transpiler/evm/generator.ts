import {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  ReturnStatement,
} from "acorn";
import { Generator } from "../ast/walk";

class EvmGenerator extends Generator {
  FunctionDeclaration(node: FunctionDeclaration) {
    this.inlineFunction(node);
  }

  FunctionExpression(node: FunctionExpression) {
    this.inlineFunction(node);
  }

  ArrowFunctionExpression(node: ArrowFunctionExpression) {
    this.inlineFunction(node);
  }

  inlineFunction(
    node: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
  ) {
    this.put("inline(");
    this.schemaObject(node.params);
    this.put(", ");
    this.paramBinding(node.params);
    this.put(" => ");
    this.rec(node.body);
    this.put(")");
  }

  schemaObject(params: readonly Node[]) {
    this.put("{ ");
    for (let i = 0; i < params.length; ++i) {
      if (i) this.put(", ");
      this.schemaEntry(params[i]!);
    }
    this.put(" }");
  }

  schemaEntry(param: Node) {
    if (param.type != "Identifier")
      this.unsupported(param, "EVM function parameters must be identifiers");
    this.put(param.name + ": ");
    this.rec(param.typeAnnotation);
  }

  paramBinding(params: readonly Node[]) {
    this.put("({ ");
    for (let i = 0; i < params.length; ++i) {
      if (i) this.put(", ");
      this.paramName(params[i]!);
    }
    this.put(" })");
  }

  paramName(param: Node) {
    if (param.type == "Identifier")
      this.put(param.name);
    else
      this.unsupported(param, "EVM function parameters must be identifiers");
  }

  BlockStatement(node: BlockStatement) {
    this.put("[");
    this.inc();
    this.arrLines(node.body, ",");
    this.dec();
    if (node.body.length)
      this.ret();
    this.put("]");
  }

  ReturnStatement(node: ReturnStatement) {
    if (node.argument)
      this.rec(node.argument);
  }

  ExpressionStatement(node: ExpressionStatement) {
    this.rec(node.expression);
  }

  CallExpression(node: CallExpression) {
    this.rec(node.callee);
    this.put("(");
    this.arr(node.arguments, ", ");
    this.put(")");
  }

  MemberExpression(node: MemberExpression) {
    this.rec(node.object);
    if (node.computed) {
      this.put("[");
      this.rec(node.property);
      this.put("]");
    } else {
      this.put(".");
      this.rec(node.property);
    }
  }

  Identifier(node: Identifier) {
    this.put(node.name);
  }

  Literal(node: Literal) {
    this.put(node.raw ?? JSON.stringify(node.value));
  }

  TSIndexedAccessType(node: any) {
    this.put("array(");
    this.rec(node.objectType);
    this.put(", ");
    this.rec(node.indexType);
    this.put(")");
  }

  TSLiteralType(node: any) {
    this.rec(node.literal);
  }

  TSTypeAnnotation(node: any) {
    this.rec(node.typeAnnotation);
  }

  TSTypeReference(node: any) {
    this.rec(node.typeName);
  }

  unsupported(node: Node, message: string): never {
    throw new Error(`${message} at ${node.start}:${node.end}`);
  }
}

const generate = (node: Node): string => {
  const generator = new EvmGenerator();
  generator.rec(node);
  return generator.out;
};

export {
  EvmGenerator,
  generate,
};
