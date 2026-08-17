import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import net from "node:net";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

function run(cmd: string): void {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function dockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function startDockerDesktop(): void {
  const candidates = [
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop (Windows).exe",
  ];
  for (const exe of candidates) {
    try {
      spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      console.log("  started Docker Desktop");
      return;
    } catch {
      // try next candidate
    }
  }
  throw new Error("Docker Desktop not found and the Docker daemon is not running");
}

async function waitForDocker(timeoutMs = 150_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (dockerAvailable()) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Timed out waiting for the Docker daemon");
}

async function waitForPort(host: string, port: number, timeoutMs = 60_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

export default async function globalSetup(): Promise<void> {
  console.log("[setup] preparing demo database…");

  // CI runs a Postgres service and sets SKIP_DOCKER=1. Locally we start Docker.
  if (!process.env.SKIP_DOCKER) {
    if (!dockerAvailable()) startDockerDesktop();
    await waitForDocker();
    console.log("[setup] starting db container…");
    run("docker compose up -d db");
    await waitForPort("127.0.0.1", 5432);
  }

  // Fresh, deterministic data: reset schema → migrate → seed → run editorial jobs.
  run("npx tsx e2e/setup-data.ts");

  console.log("[setup] demo data ready (demo@fun.app / demo1234)");
}