/**
 * feedScheduler.ts
 * Runs the Python fetcher on a schedule to keep feed.json up to date.
 * Triggered once at startup, then every hour automatically.
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import cron from "node-cron";

const PROJECT_ROOT = path.resolve(process.cwd());
const FETCHER_SCRIPT = path.join(PROJECT_ROOT, "fetcher", "fetch.py");
const FEED_OUTPUT = path.join(PROJECT_ROOT, "client", "public", "data", "feed.json");

let isRunning = false;
let lastRunAt: Date | null = null;
let lastRunStatus: "success" | "error" | null = null;
let lastRunDuration: number | null = null;

export function getFetcherStatus() {
  return {
    isRunning,
    lastRunAt: lastRunAt?.toISOString() ?? null,
    lastRunStatus,
    lastRunDuration,
    nextRunIn: "up to 1 hour",
  };
}

export function runFetcher(): Promise<void> {
  if (isRunning) {
    console.log("[FeedScheduler] Fetcher already running, skipping.");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    isRunning = true;
    const startTime = Date.now();
    console.log(`[FeedScheduler] Starting feed refresh at ${new Date().toISOString()}`);

    // Ensure output directory exists
    const outputDir = path.dirname(FEED_OUTPUT);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Use a clean environment to avoid PYTHONHOME/PYTHONPATH conflicts from uv/pyenv
    // Pass through API keys so the fetcher can authenticate with external services
    const cleanEnv: NodeJS.ProcessEnv = {
      PATH: "/usr/bin:/bin:/usr/local/bin",
      HOME: process.env.HOME,
      PYTHONUNBUFFERED: "1",
      ...(process.env.GITHUB_TOKEN && { GITHUB_TOKEN: process.env.GITHUB_TOKEN }),
      ...(process.env.YOUTUBE_API_KEY && { YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY }),
      ...(process.env.REDDIT_CLIENT_ID && { REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID }),
      ...(process.env.REDDIT_CLIENT_SECRET && { REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET }),
    };
    const proc = spawn("/usr/bin/python3.11", [FETCHER_SCRIPT], {
      cwd: PROJECT_ROOT,
      env: cleanEnv,
    });

    proc.stdout.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.log(`[FeedScheduler] ${line}`);
    });

    proc.stderr.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.error(`[FeedScheduler] ERR: ${line}`);
    });

    proc.on("close", (code) => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      isRunning = false;
      lastRunAt = new Date();
      lastRunDuration = duration;

      if (code === 0) {
        lastRunStatus = "success";
        console.log(`[FeedScheduler] Feed refresh completed in ${duration}s`);
      } else {
        lastRunStatus = "error";
        console.error(`[FeedScheduler] Fetcher exited with code ${code} after ${duration}s`);
      }
      resolve();
    });

    proc.on("error", (err) => {
      isRunning = false;
      lastRunStatus = "error";
      lastRunAt = new Date();
      console.error(`[FeedScheduler] Failed to start fetcher: ${err.message}`);
      resolve();
    });
  });
}

export function startScheduler() {
  console.log("[FeedScheduler] Scheduler initialized — feed will refresh every hour.");

  // Run once at startup (after a short delay to let the server fully boot)
  setTimeout(() => {
    runFetcher().catch(console.error);
  }, 5000);

  // Then run every hour at the top of the hour
  cron.schedule("0 * * * *", () => {
    runFetcher().catch(console.error);
  });
}
