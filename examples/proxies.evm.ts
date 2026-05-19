import { assemble } from "../core/assembler";
import {
  calldataCopy,
  calldataSize,
  codeCopy,
  delegateCall,
  gas,
  ret,
  returndataCopy,
  returndataSize,
  returnOrRevert,
  sload,
  sstore,
} from "../core/builtins";
import type { InlineFunction } from "../core/function";
import { blob } from "../core/statement";
import { Addr, Address, Bool, Bytes, Size } from "../core/types";

const upgradableProxy = (slot: Bytes): InlineFunction => evm () => {
  calldataCopy(0);
  const success: Bool = delegateCall(
    gas(),
    sload(slot, Addr),
    0,
    calldataSize(),
    0,
    0,
  );
  returndataCopy(0);
  return returnOrRevert(success, 0, returndataSize());
}

const createUpgradableProxy = (
  implAddress: Address,
  implSlot: Bytes,
): InlineFunction => {
  const runtime = blob(assemble(upgradableProxy(implSlot)()));

  return evm () => {
    sstore(implSlot, implAddress);
    const size: Size = runtime.len();
    codeCopy(0, runtime.beg(), size);
    ret(0, size);
    runtime;
  };
}

export { createUpgradableProxy, upgradableProxy };
