import {
  ArrowFunctionExpression,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  Program,
} from "acorn";
import { Mutator } from "../ast/walk";
import { TsParser } from "../parser/tsParser";
import { CodeUpdater } from "../util/textual";
import { generate } from "./generator";

type EvmFunction =
  | ArrowFunctionExpression
  | FunctionDeclaration
  | FunctionExpression;

const isEvmFunction = (node: EvmFunction): boolean =>
  !!(node as EvmFunction & { evm?: boolean }).evm;

class EvmTransform extends Mutator {
  readonly updater = new CodeUpdater();

  constructor(private readonly source: string) { super(); }

  FunctionDeclaration(node: FunctionDeclaration) {
    if (!isEvmFunction(node))
      return false;
    this.updater.replace(node, this.functionDeclarationReplacement(node));
    return true;
  }

  FunctionExpression(node: FunctionExpression) {
    return this.replaceExpressionFunction(node);
  }

  ArrowFunctionExpression(node: ArrowFunctionExpression) {
    return this.replaceExpressionFunction(node);
  }

  private replaceExpressionFunction(node: FunctionExpression | ArrowFunctionExpression) {
    if (!isEvmFunction(node))
      return false;
    this.updater.replace(node, generate(node));
    return true;
  }

  private functionDeclarationReplacement(node: FunctionDeclaration): string {
    if (!node.id)
      return `${generate(node)};`;
    return `const ${this.source.slice(node.id.start, node.id.end)} = ${generate(node)};`;
  }

  apply(ast: Node): string {
    this.mut(ast);
    return this.updater.apply(this.source);
  }
}

const parseEvmSource = (source: string): Program =>
  TsParser.parse(source, {
    sourceType: "module",
    ecmaVersion: "latest",
  });

const transformEvmSource = (source: string): string =>
  new EvmTransform(source).apply(parseEvmSource(source));

export {
  EvmTransform,
  transformEvmSource,
};
