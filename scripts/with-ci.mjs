import { spawnSync } from "node:child_process";

process.env.CI = "1";

const cmd = process.argv.slice(2);
if (cmd.length === 0) {
  console.error("[with-ci] Missing command");
  process.exit(1);
}

const res = spawnSync(cmd[0], cmd.slice(1), {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(res.status ?? 1);
