import { ExprChild, Expression, StackRef } from "./expression";
import { Fragment } from "./fragment";
import { Bytes, EvmType, Literal, Size } from "./types";
import type { ForRangeStatement } from "./control";

class Label {
  static next = 0;
  static names: (string | undefined)[] = [];
  static describe(label: Label): string {
    return label.name ? `label "${label.name}"` : "anonymous label";
  }

  readonly id: number;
  constructor(readonly name?: string) {
    this.id = Label.next++;
    if (name) Label.names[this.id] = name;
  }

  ref(jump = false): Expression {
    return Expression.fromFragment(Fragment.ofLabelPos(this.id, jump));
  }
  dest(): Expression {
    return Expression.fromFragment(Fragment.ofLabelRef(this.id));
  }
}

type NameBinding = string | StackRef | string[] | Record<string, string>;

class SetStatement {
  constructor(
    readonly name: NameBinding,
    readonly init: ExprChild
  ) { }
}

type Statement = Expression | SetStatement | Blob | Label | ForRangeStatement;
type Body = Statement | readonly Body[];

function set(name: NameBinding, expr: ExprChild): SetStatement;
function set(name: NameBinding, type: EvmType, lit: Literal): SetStatement;
function set(
  name: NameBinding,
  exprOrType: ExprChild | EvmType,
  lit?: Literal,
): SetStatement {
  if (lit !== undefined)
    return new SetStatement(
      name,
      Expression.fromLiteral(lit, exprOrType as EvmType)
    );
  if (exprOrType instanceof Expression || exprOrType instanceof StackRef)
    return new SetStatement(name, exprOrType);
  throw new TypeError("set requires an expression, stack ref, or typed literal");
}

class Blob {
  readonly label: Label;

  constructor(
    readonly data: Bytes,
    name?: string,
  ) {
    this.label = new Label(name);
  }

  beg(): Expression {
    return this.label.ref();
  }
  len(): Expression {
    return Expression.fromLiteral(this.data.length, Size);
  }
}

/**
 * Creates a byte blob in the program from a fixed byte array. Its symbolic
 * start index can be obtained by the `beg()` method on the returned object.
 */
const blob = (bytes: Bytes, name?: string): Blob => new Blob(bytes, name);

const label = (name?: string): Label => new Label(name);

export {
  Blob,
  Body,
  Label,
  NameBinding,
  SetStatement,
  Statement,
  blob,
  label,
  set
};
