import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
// UI regression suite: real Express API + built React app, backed by the DEV ENGINE for speed and determinism.
// This is NOT a Drunix test. The Drunix integration suite is `npm run test:drunix` + `npm run verify:concurrency` at the repo root.
const chromium = process.env.PW_CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find((p) => fs.existsSync(p));
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 60_000, retries: 0, reporter: [['list'], ['json', { outputFile: '../reports/playwright-report.json' }]],
  use: { baseURL: 'http://localhost:3200', trace: 'retain-on-failure', launchOptions: chromium ? { executablePath: chromium, args: ['--no-sandbox'] } : {} },
  webServer: { command: 'node ../server/index.js', url: 'http://localhost:3200/api/health', reuseExistingServer: false, timeout: 30_000,
    env: { LEDGER_MODE: 'dev', PORT: '3200', RASID_DEMO_PASSWORD: 'e2e-pass', SESSION_SECRET: 'e2e', DATA_DIR: '../.e2e-data' } },
});
