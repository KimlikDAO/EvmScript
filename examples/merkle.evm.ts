import { range } from "../core/builtins";
import { Bool, Data, Uint } from "../core/types";

const hashPairAtOffset = evm (
  sibling: Data,
  offset: Uint,
  hash: Data,
): Data => {
  mstore(offset, hash);
  mstore(32 - offset, sibling);
  return keccak256(0, 64);
}

const verifyMerkle = evm (
  hash: Data,
  index: Uint,
  proof: Data[32],
): Bool => {
  static for (const level in range(32)) {
    hash = hashPairAtOffset(proof[level], (index & 1) * 32, hash);
    index = index >> 1;
  }
  return hash == sload<Data>(0);
}

export { verifyMerkle };
