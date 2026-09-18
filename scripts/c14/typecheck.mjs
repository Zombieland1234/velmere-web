import { spawnSync } from "node:child_process";
import path from "node:path";

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const node = process.execPath;
const bin = (name) => path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

run(node, ["scripts/c14/typecheck-coverage.mjs"]);
run(bin("tsc"), ["-p", "tsconfig.c14-all.json", "--pretty", "false"]);
