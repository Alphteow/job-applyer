import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { WebDriver } from "selenium-webdriver";
import { applyToJob } from "./apply-job";
import { isBotCheck } from "./page";
import { launchSignedInChrome } from "./chrome-launch";
import { manualRows, parseConfig, searchPageUrl, type ApplyConfig } from "./config";
import { fillMissingListings } from "./listings";
import {
  alreadySettled,
  appliedCount,
  applySavedTitles,
  mergeApplications,
  rowFromResult,
  rowsFromLog,
  saveTracker,
  titlesFromTracker,
  type ApplicationRow,
} from "./tracker";

const ROOT = path.resolve(import.meta.dirname, "..");
const TRACKER = path.join(ROOT, "applications.xlsx");

/** Opens Chrome, signs into the saved profile, and applies to SEEK jobs. */
async function main(): Promise<void> {
  const { max, target, dryRun } = readArgs(process.argv.slice(2));
  const config = parseConfig(await readFile(path.join(ROOT, "personal", "config.json"), "utf8"));
  const rows = await loadRows(config);
  const goal = target > 0 ? target : appliedCount(rows) + max;
  await writeTracker(rows, goal);
  console.log(`${appliedCount(rows)} applied so far. Target ${goal}.`);
  const driver = await launchSignedInChrome(path.join(ROOT, ".chrome-profile"));
  try {
    await runSearch(driver, config, rows, goal, dryRun);
    console.log(`Finished. ${appliedCount(rows)} applied. Target ${goal}.`);
  } finally {
    await driver.quit();
  }
}

function readArgs(argv: string[]): { max: number; target: number; dryRun: boolean } {
  const max = readFlag(argv, "--max", 10);
  const target = readFlag(argv, "--target", 0);
  return { max, target, dryRun: argv.includes("--dry-run") };
}

function readFlag(argv: string[], flag: string, fallback: number): number {
  const index = argv.indexOf(flag);
  const value = index >= 0 ? Number(argv[index + 1]) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function loadRows(config: ApplyConfig): Promise<ApplicationRow[]> {
  const rows = mergeApplications(rowsFromLog(await readLog()), manualRows(config.manualApplications));
  applySavedTitles(rows, await titlesFromTracker(TRACKER));
  await fillMissingListings(rows);
  return rows;
}

async function runSearch(
  driver: WebDriver,
  config: ApplyConfig,
  rows: ApplicationRow[],
  goal: number,
  dryRun: boolean,
): Promise<void> {
  const seen = new Set(
    rows.filter((row) => alreadySettled(row.status)).map((row) => row.jobId),
  );
  const collected = new Set<string>();
  for (let page = 1; page <= 40 && appliedCount(rows) < goal; page += 1) {
    const fresh = await freshIds(driver, page, collected, config.searchUrl);
    if (fresh.length === 0) {
      break;
    }
    await applyPage(driver, config, rows, goal, dryRun, seen, fresh);
  }
}

async function freshIds(
  driver: WebDriver,
  page: number,
  collected: Set<string>,
  searchUrl: string,
): Promise<string[]> {
  const found = await jobIdsOnPage(driver, page, searchUrl);
  const fresh = found.filter((jobId) => !collected.has(jobId));
  fresh.forEach((jobId) => collected.add(jobId));
  return fresh;
}

async function jobIdsOnPage(driver: WebDriver, page: number, searchUrl: string): Promise<string[]> {
  await driver.get(searchPageUrl(searchUrl, page));
  await waitForResults(driver);
  return driver.executeScript<string[]>(collectIdsScript);
}

async function waitForResults(driver: WebDriver): Promise<void> {
  const deadline = Date.now() + 10 * 60 * 1000;
  let announced = false;
  while (Date.now() < deadline) {
    if (!(await isBotCheck(driver))) {
      await driver.sleep(1500);
      return;
    }
    if (!announced) {
      console.log("SEEK is checking the browser. Complete the check in the Chrome window.");
      announced = true;
    }
    await driver.sleep(3000);
  }
  throw new Error("SEEK is still on a security check. Complete it in the Chrome window, then run again.");
}

async function applyPage(
  driver: WebDriver,
  config: ApplyConfig,
  rows: ApplicationRow[],
  goal: number,
  dryRun: boolean,
  seen: Set<string>,
  jobIds: string[],
): Promise<void> {
  for (const jobId of jobIds) {
    if (appliedCount(rows) >= goal) {
      return;
    }
    if (seen.has(jobId)) {
      continue;
    }
    seen.add(jobId);
    await submitOne(driver, config, rows, goal, dryRun, jobId);
  }
}

async function submitOne(
  driver: WebDriver,
  config: ApplyConfig,
  rows: ApplicationRow[],
  goal: number,
  dryRun: boolean,
  jobId: string,
): Promise<void> {
  const result = await applyToJob(driver, jobId, config.notes, config.resumeFile, dryRun);
  const appliedAt = new Date().toISOString();
  console.log(`${jobId}: ${result}`);
  await record(appliedAt, jobId, result);
  const row = rowFromResult(jobId, result, appliedAt);
  if (row.status === "applied") {
    await fillMissingListings([row]);
  }
  replaceRow(rows, row);
  await writeTracker(rows, goal);
  if (result === "applied" || result === "did not finish" || result.startsWith("unanswered")) {
    await driver.sleep(8000);
  }
}

function replaceRow(rows: ApplicationRow[], row: ApplicationRow): void {
  const index = rows.findIndex((item) => item.jobId === row.jobId);
  if (index >= 0) {
    rows[index] = row;
  } else {
    rows.push(row);
  }
}

async function writeTracker(rows: ApplicationRow[], goal: number): Promise<void> {
  try {
    await saveTracker(TRACKER, rows, goal);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

async function readLog(): Promise<string> {
  try {
    return await readFile(path.join(ROOT, "output", "applications.log"), "utf8");
  } catch {
    return "";
  }
}

async function record(appliedAt: string, jobId: string, result: string): Promise<void> {
  const dir = path.join(ROOT, "output");
  await mkdir(dir, { recursive: true });
  await appendFile(path.join(dir, "applications.log"), `${appliedAt} ${jobId} ${result}\n`);
}

const collectIdsScript = `return [...document.querySelectorAll('a[href*="/job/"]')]
  .map((link) => (link.href.match(/\\/job\\/(\\d+)/) || [])[1])
  .filter(Boolean)`;

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
