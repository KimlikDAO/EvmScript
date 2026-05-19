import { PluginBuilder } from "bun";
import { readFileSync } from "node:fs";
import { transformEvmSource } from "./transform";

const evmScriptPlugin = {
  name: "evmscript",
  setup(build: PluginBuilder) {
    build.onLoad({ filter: /^(?!.*\/(?:node_modules|build)\/).*\.evm\.ts$/ }, (args) => ({
      contents: transformEvmSource(readFileSync(args.path, "utf8")),
      loader: "ts",
    }));
  },
};

export {
  evmScriptPlugin,
};
