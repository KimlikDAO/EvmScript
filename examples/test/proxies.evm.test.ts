import { expect, test } from "bun:test";
import { assemble } from "../../core/assembler";
import { createUpgradableProxy, upgradableProxy } from "../proxies.evm";

test("upgradableProxy assembles runtime bytecode", () => {
  const slot = Uint8Array.from(Array(32).fill(1));

  expect(assemble(upgradableProxy(slot)()).length).toBeGreaterThan(0);
});

test("createUpgradableProxy assembles init bytecode with runtime tail", () => {
  const addr = "0x1111111111111111111111111111111111111111";
  const slot = Uint8Array.from(Array(32).fill(1));

  expect(assemble(createUpgradableProxy(addr, slot)()).length)
    .toBeGreaterThan(assemble(upgradableProxy(slot)()).length);
});
