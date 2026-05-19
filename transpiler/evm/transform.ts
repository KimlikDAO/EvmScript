import {
  ArrowFunctionExpression,
  FunctionDeclaration,
  FunctionExpression,
  ImportDeclaration,
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
  private replacements = 0;

  constructor(private readonly source: string) { super(); }

  FunctionDeclaration(node: FunctionDeclaration) {
    if (!isEvmFunction(node))
      return false;
    this.updater.replace(node, this.functionDeclarationReplacement(node));
    ++this.replacements;
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
    this.updater.replace(node, this.indented(node, generate(node)));
    ++this.replacements;
    return true;
  }

  private functionDeclarationReplacement(node: FunctionDeclaration): string {
    if (!node.id)
      return `${this.indented(node, generate(node))};`;
    return `const ${this.source.slice(node.id.start, node.id.end)} = ${this.indented(node, generate(node))};`;
  }

  private indented(node: Node, generated: string): string {
    const lineStart = this.source.lastIndexOf("\n", node.start - 1) + 1;
    const indent = /^[ \t]*/.exec(this.source.slice(lineStart, node.start))![0];
    return generated.replace(/\n/g, "\n" + indent);
  }

  apply(ast: Node): string {
    this.mut(ast);
    if (this.replacements && ast.type == "Program")
      this.insertRuntimeImports(ast);
    return this.updater.apply(this.source);
  }

  private insertRuntimeImports(program: Program) {
    const locals = new Set<string>();
    let lastImport: ImportDeclaration | undefined;
    for (const node of program.body) {
      if (node.type != "ImportDeclaration")
        continue;
      lastImport = node;
      for (const specifier of node.specifiers)
        locals.add(specifier.local.name);
    }

    const imports = this.runtimeImports(locals);
    if (!imports)
      return;
    if (lastImport)
      this.updater.insertAfter(lastImport, "\n" + imports);
    else if (program.body[0])
      this.updater.insertBefore(program.body[0], imports + "\n");
  }

  private runtimeImports(locals: Set<string>): string {
    const groups: readonly [string, readonly string[]][] = [
      [
        "../core/builtins",
        ["bitAnd", "call", "eq", "keccak256", "mstore", "mul", "range", "shr", "sload", "sub"],
      ],
      ["../core/function", ["inline"]],
      ["../core/array", ["array"]],
      ["../core/statement", ["set", "unrollFor"]],
      ["../core/expression", ["get"]],
    ];
    const out: string[] = [];
    for (const [source, names] of groups) {
      const missing = names.filter((name) => !locals.has(name));
      if (!missing.length)
        continue;
      for (const name of missing)
        locals.add(name);
      out.push(`import { ${missing.join(", ")} } from "${source}";`);
    }
    return out.join("\n");
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
