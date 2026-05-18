import { Address } from "../core/address.d";
import { assemble, Program } from "../core/assembler";
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
import { get } from "../core/expression";
import { blob, set } from "../core/statement";
import { Addr, Bytes } from "../core/types";

const upgradableProxy = (slot: Bytes): Program =>
  assemble(
    calldataCopy(0),
    set("success",
      delegateCall(gas(), sload(slot, Addr), 0, calldataSize(), 0, 0)),
    returndataCopy(0),
    returnOrRevert(get("success"), 0, returndataSize()),
  );

const createUpgradableProxy = (
  implAddress: Address,
  implSlot: Bytes,
): Program => {
  const runtime = blob(upgradableProxy(implSlot));

  return assemble(
    sstore(implSlot, implAddress),
    set("x", runtime.len()),
    codeCopy(0, runtime.beg(), get("x")),
    ret(0, get("x")),
    runtime,
  );
};

export { createUpgradableProxy, upgradableProxy };
