import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { startLocalDatabase, LOCAL_DB_KEY } from "./local-database.mjs";

if (process.env.VERCEL) throw new Error("Local preview cannot run on Vercel.");
const test = process.argv.includes("--test");
const port = test ? 3100 : 3000;
const dbPort = test ? 4311 : 4310;
const database = await startLocalDatabase({ port: dbPort, persistent: !test, test, seed: !test });
await mkdir(".private", { recursive: true });
if (!test) await writeFile(".private/local-preview-link.txt", `http://localhost:${port}/\n`);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      LOCAL_PREVIEW: "1",
      SUPABASE_URL: `http://127.0.0.1:${dbPort}`,
      SUPABASE_SECRET_KEY: LOCAL_DB_KEY,
    },
  },
);
if (!test)
  console.log(
    "Local preview link saved in .private/local-preview-link.txt. Sample data stays on this computer.",
  );
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await database.close();
}
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
child.on("exit", async (code) => {
  await stop();
  process.exit(code ?? 0);
});
