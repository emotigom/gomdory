import { spawnSync } from "node:child_process";

const commands = process.argv.slice(2).filter(Boolean);
const alreadyRunningDoctor = process.env.DOCTOR_RUNNING === "1";

if (commands.length === 0) {
  console.error("Usage: node scripts/ci/run-with-doctor.mjs <command> [command...]");
  process.exit(1);
}

process.env.DOCTOR_RUNNING = "1";

const log = ({ level, stage, event, summary, durationMs, details }) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    stage,
    event,
    summary,
    ...(typeof durationMs === "number" ? { durationMs } : {}),
    ...(details ? { details } : {}),
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const stageForCommand = (command) => {
  if (command.includes("check:parse")) return "parse";
  if (command.includes("lint")) return "lint";
  if (command.includes("check:security")) return "security";
  if (command.includes("check:codemod")) return "codemod";
  if (command.includes("check:contract")) return "contracts";
  if (command.includes("check:duplication")) return "duplication";
  if (command.includes("check:selfcheck")) return "selfcheck";
  if (command.includes("check:probe") || command.includes("selfcheck:probe")) return "probe";
  if (command.includes("check:supabase:migrations")) return "migrations";
  if (command.includes("CI=1 npm run build") || command.includes("npm run build")) {
    return "build";
  }
  if (command.includes("smoke")) return "smoke";
  return "ci";
};

const runCommand = (command, envOverrides = {}) =>
  spawnSync(command, {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

const shouldRunDoctor = !alreadyRunningDoctor;

let failure = null;

for (const command of commands) {
  const stage = stageForCommand(command);
  log({ level: "info", stage, event: "start", summary: `run: ${command}` });
  const startedAt = Date.now();
  const result = runCommand(command, { DOCTOR_RUNNING: "1" });
  const durationMs = Date.now() - startedAt;
  const exitCode = typeof result.status === "number" ? result.status : 1;

  if (exitCode === 0) {
    log({ level: "info", stage, event: "ok", summary: "ok", durationMs });
    continue;
  }

  log({
    level: "error",
    stage,
    event: "fail",
    summary: "failed",
    durationMs,
    details: { exitCode },
  });
  failure = { command, exitCode };
  break;
}

if (!failure) {
  process.exit(0);
}

if (shouldRunDoctor) {
  log({
    level: "error",
    stage: "doctor",
    event: "start",
    summary: "running doctor:cf:full due to failure",
  });
  const doctorStartedAt = Date.now();
  runCommand("npm run doctor:cf:full", { DOCTOR_RUNNING: "1" });
  log({
    level: "error",
    stage: "doctor",
    event: "ok",
    summary: "doctor completed",
    durationMs: Date.now() - doctorStartedAt,
  });
}

process.exit(failure.exitCode);
