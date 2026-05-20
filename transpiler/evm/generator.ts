import {
  AssignmentExpression,
  ArrowFunctionExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  ReturnStatement,
  VariableDeclaration,
} from "acorn";
import { Generator } from "../ast/walk";

type EvmFunction =
  | FunctionDeclaration
  | FunctionExpression
  | ArrowFunctionExpression;

class EvmGenerator extends Generator {
  private readonly arrays = new Set<string>();
  private readonly locals = new Set<string>();
  private readonly params = new Set<string>();
  private readonly rawBindings = new Set<string>();
  private readonly stackBindings = new Set<string>();

  override rec(node: Node | null | undefined, ...rest: unknown[]) {
    if (!node)
      return;
    if (typeof (this as any)[node.type] != "function")
      this.unsupported(node, `Unsupported EVM node ${node.type}`);
    (this as any)[node.type](node, ...rest);
  }

  FunctionDeclaration(node: FunctionDeclaration) {
    this.inlineFunction(node);
  }

  FunctionExpression(node: FunctionExpression) {
    this.inlineFunction(node);
  }

  ArrowFunctionExpression(node: ArrowFunctionExpression) {
    this.inlineFunction(node);
  }

  inlineFunction(node: EvmFunction) {
    const oldArrays = new Set(this.arrays);
    const oldLocals = new Set(this.locals);
    const oldParams = new Set(this.params);
    const arrayParams = this.arrayParamNames(node.params);
    for (const name of arrayParams)
      this.arrays.add(name);
    for (const name of this.paramNames(node.params))
      this.params.add(name);

    this.put("inline(");
    this.inc();
    this.ret();
    this.schemaObject(node.params);
    this.put(",");
    this.ret();
    this.paramBinding(node.params);
    this.put(" => ");
    this.rec(node.body);
    this.dec();
    this.ret();
    this.put(")");

    this.arrays.clear();
    for (const name of oldArrays)
      this.arrays.add(name);
    this.locals.clear();
    for (const name of oldLocals)
      this.locals.add(name);
    this.params.clear();
    for (const name of oldParams)
      this.params.add(name);
  }

  schemaObject(params: readonly Node[]) {
    if (params.length == 0) {
      this.put("{}");
      return;
    }
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
    if (!param.typeAnnotation)
      this.unsupported(param, "EVM function parameters need type annotations");
    this.put(param.name + ": ");
    this.rec(param.typeAnnotation);
  }

  arrayParamNames(params: readonly Node[]): string[] {
    const names: string[] = [];
    for (const param of params)
      if (
        param.type == "Identifier" &&
        param.typeAnnotation?.typeAnnotation.type == "TSIndexedAccessType"
      )
        names.push(param.name);
    return names;
  }

  paramNames(params: readonly Node[]): string[] {
    const names: string[] = [];
    for (const param of params)
      if (param.type == "Identifier")
        names.push(param.name);
    return names;
  }

  paramBinding(params: readonly Node[]) {
    if (params.length == 0) {
      this.put("({})");
      return;
    }
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
    if (!node.argument)
      this.unsupported(node, "EVM return statements must return a value");
    this.rec(node.argument);
  }

  ExpressionStatement(node: ExpressionStatement) {
    this.rec(node.expression);
  }

  VariableDeclaration(node: VariableDeclaration) {
    if (node.declarations.length != 1)
      this.unsupported(node, "EVM variable declarations need one binding");
    const declaration = node.declarations[0]!;
    if (declaration.id.type != "Identifier")
      this.unsupported(declaration.id, "EVM variable bindings must be identifiers");
    if (!declaration.id.typeAnnotation)
      this.unsupported(declaration.id, "EVM variable bindings need type annotations");
    if (!declaration.init)
      this.unsupported(declaration, "EVM variable bindings need initializers");
    const typedLiteral = !this.isExpressionInit(declaration.init);
    this.put(`set(${JSON.stringify(declaration.id.name)}, `);
    if (typedLiteral) {
      this.rec(declaration.id.typeAnnotation);
      this.put(", ");
    }
    this.rec(declaration.init);
    this.put(")");
    this.locals.add(declaration.id.name);
  }

  isExpressionInit(node: Node): boolean {
    if (
      node.type == "CallExpression" ||
      node.type == "BinaryExpression" ||
      node.type == "AssignmentExpression"
    )
      return true;
    if (node.type == "Identifier")
      return this.locals.has(node.name)
        || this.params.has(node.name)
        || this.stackBindings.has(node.name);
    if (node.type == "MemberExpression")
      return node.computed &&
        node.object.type == "Identifier" &&
        this.arrays.has(node.object.name);
    return false;
  }

  CallExpression(node: CallExpression) {
    this.rec(node.callee);
    this.put("(");
    this.arr([
      ...node.arguments,
      ...((node as any).typeArguments?.params ?? []),
    ], ", ");
    this.put(")");
  }

  AssignmentExpression(node: AssignmentExpression) {
    if (node.operator != "=")
      this.unsupported(node, `Unsupported EVM assignment operator ${node.operator}`);
    this.put("set(");
    this.rec(node.left);
    this.put(", ");
    this.rec(node.right);
    this.put(")");
  }

  BinaryExpression(node: BinaryExpression) {
    const op = {
      "&": "bitAnd",
      "*": "mul",
      "-": "sub",
      ">>": "shr",
      "==": "eq",
    }[node.operator];
    if (!op)
      this.unsupported(node, `Unsupported EVM binary operator ${node.operator}`);

    this.put(op + "(");
    if (node.operator == ">>") {
      this.rec(node.right);
      this.put(", ");
      this.rec(node.left);
    } else {
      this.rec(node.left);
      this.put(", ");
      this.rec(node.right);
    }
    this.put(")");
  }

  ForInStatement(node: ForInStatement) {
    this.forStatement(node);
  }

  ForOfStatement(node: ForOfStatement) {
    this.forStatement(node);
  }

  forStatement(node: ForInStatement | ForOfStatement) {
    if (node.static)
      this.staticForStatement(node);
    else
      this.forRangeStatement(node);
  }

  staticForStatement(node: ForInStatement | ForOfStatement) {
    const name = this.loopBindingName(node.left);
    this.put("staticFor([], ");
    this.rec(node.right);
    this.put(`, (${name}) => `);
    this.withRawBinding(name, () => this.rec(node.body));
    this.put(")");
  }

  forRangeStatement(node: ForInStatement | ForOfStatement) {
    const name = this.loopBindingName(node.left);
    const [begin, end, step] = this.rangeLiteralArgs(node.right);
    this.put(
      `forRange(${JSON.stringify(name)}, ${begin}, ${end}, ${step}, `
        + `(${name}) => `
    );
    this.withRawBinding(name, () =>
      this.withStackBinding(name, () => this.rec(node.body)));
    this.put(")");
  }

  loopBindingName(left: Node): string {
    if (left.type == "Identifier")
      return left.name;
    if (left.type == "VariableDeclaration") {
      if (left.declarations.length != 1)
        this.unsupported(left, "EVM loops need one binding");
      const id = left.declarations[0]!.id;
      if (id.type == "Identifier")
        return id.name;
    }
    this.unsupported(left, "EVM loop bindings must be identifiers");
  }

  rangeLiteralArgs(node: Node): [number, number, number] {
    if (
      node.type != "CallExpression" ||
      node.callee.type != "Identifier" ||
      node.callee.name != "range"
    )
      this.unsupported(node, "Runtime EVM loops currently require range(...)");

    const args = node.arguments;
    if (args.length < 1 || 3 < args.length)
      this.unsupported(node, "range(...) expects one to three arguments");
    const values = args.map((arg) => this.numericLiteral(arg as Node));
    const begin = args.length == 1 ? 0 : values[0]!;
    const end = args.length == 1 ? values[0]! : values[1]!;
    const step = args.length == 3 ? values[2]! : 1;
    if (step <= 0)
      this.unsupported(args[args.length - 1] as Node,
        "Runtime EVM loops currently require a positive range step");
    return [begin, end, step];
  }

  numericLiteral(node: Node): number {
    if (
      node.type != "Literal" ||
      typeof node.value != "number" ||
      !Number.isSafeInteger(node.value)
    )
      this.unsupported(node,
        "Runtime EVM loops currently require numeric literal range arguments");
    return node.value;
  }

  withRawBinding(name: string, fn: () => void) {
    const had = this.rawBindings.has(name);
    this.rawBindings.add(name);
    fn();
    if (!had) this.rawBindings.delete(name);
  }

  withStackBinding(name: string, fn: () => void) {
    const had = this.stackBindings.has(name);
    this.stackBindings.add(name);
    fn();
    if (!had) this.stackBindings.delete(name);
  }

  MemberExpression(node: MemberExpression) {
    this.rec(node.object);
    if (node.computed) {
      if (node.object.type == "Identifier" && this.arrays.has(node.object.name)) {
        this.put(".at(");
        this.rec(node.property);
        this.put(")");
      } else {
        this.put("[");
        this.rec(node.property);
        this.put("]");
      }
    } else {
      this.put(".");
      this.rec(node.property);
    }
  }

  Identifier(node: Identifier) {
    if (this.rawBindings.has(node.name)) {
      this.put(node.name);
      return;
    }
    if (this.locals.has(node.name)) {
      this.put(`get(${JSON.stringify(node.name)})`);
      return;
    }
    this.put(node.name);
  }

  Literal(node: Literal) {
    const raw = node.raw ?? JSON.stringify(node.value);
    this.put(raw.endsWith("n") ? raw.slice(0, -1) : raw);
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
