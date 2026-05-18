import {
  bitAnd,
  eq,
  keccak256,
  mstore,
  mul,
  range,
  shr,
  sload,
  sub,
} from "../core/builtins";
import { inline } from "../core/function";
import { array } from "../core/array";
import { set, unrollFor } from "../core/statement";
import { Data, Uint } from "../core/types";

const hashPairAtOffset = inline(
  { sibling: Data, offset: Uint, hash: Data },
  ({ sibling, offset, hash }) => [
    mstore(offset, hash),
    mstore(sub(32, offset), sibling),
    keccak256(0, 64),
  ],
);

const verifyMerkle = (depth: number) => inline(
  { hash: Data, index: Uint, proof: array(Data, depth) },
  ({ hash, index, proof }) => [
    unrollFor(
      [],
      range(depth),
      (level) => [
        set(hash, hashPairAtOffset(
          proof.at(level),
          mul(bitAnd(index, 1), 32),
          hash,
        )),
        set(index, shr(1, index)),
      ],
    ),
    eq(hash, sload(0, Data)),
  ],
);

export { verifyMerkle };
