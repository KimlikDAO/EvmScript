import type { Body } from "./body";
import type { BoolArg, Expression } from "./expression";

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

export {
  ifElse,
  ifThen,
  staticFor
};
