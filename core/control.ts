import type { Body } from "./body";
import { get, type BoolArg, type Expression, type StackRef } from "./expression";
import { Uint } from "./types";

const ifThen = (_cond: BoolArg, _then: Expression): Expression => {
  throw new TypeError("ifThen is not implemented yet");
}

const ifElse = (_cond: BoolArg, _t: Expression, _f: Expression): Expression => {
  throw new TypeError("ifElse is not implemented yet");
}

const staticFor = <T>(
  init: Body,
  arr: readonly T[],
  fn: (elm: T) => Body,
): Body[] => [init, ...arr.map(fn)];

class ForRangeStatement {
  readonly body: Body;

  constructor(
    readonly name: string,
    readonly begin: number,
    readonly end: number,
    readonly step: number,
    fn: (i: StackRef) => Body,
  ) {
    this.body = fn(get(name, Uint));
  }
}

const forRange = (
  name: string,
  begin: number,
  end: number,
  step: number,
  fn: (i: StackRef) => Body,
): ForRangeStatement => {
  if (!Number.isSafeInteger(begin))
    throw new RangeError(`forRange begin must be a safe integer: ${begin}`);
  if (!Number.isSafeInteger(end))
    throw new RangeError(`forRange end must be a safe integer: ${end}`);
  if (!Number.isSafeInteger(step) || step <= 0)
    throw new RangeError(`forRange step must be a positive safe integer: ${step}`);
  return new ForRangeStatement(name, begin, end, step, fn);
}

export {
  ForRangeStatement,
  forRange,
  ifElse,
  ifThen,
  staticFor
};
