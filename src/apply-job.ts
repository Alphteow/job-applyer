import type { WebDriver } from "selenium-webdriver";
import { answerFor } from "./answers";
import type { Notes } from "./notes";
import { clickText, fillFields, hasSeekError, pageText, readFields, type Field } from "./page";
import { isTransientUrl, stepFromUrl } from "./steps";

/** Walks one SEEK application and returns applied, skipped, or the stop reason. */
export async function applyToJob(
  driver: WebDriver,
  jobId: string,
  notes: Notes,
  resumeFile: string,
  dryRun: boolean,
): Promise<string> {
  await driver.get(`https://au.seek.com/job/${jobId}/apply`);
  await driver.sleep(2500);
  if (stepFromUrl(await driver.getCurrentUrl()) === "external") {
    return "external site";
  }
  if (/already applied/i.test(await pageText(driver))) {
    return "already applied";
  }
  await clickText(driver, "I require sponsorship");
  return finishApplication(driver, notes, resumeFile, dryRun);
}

async function finishApplication(
  driver: WebDriver,
  notes: Notes,
  resumeFile: string,
  dryRun: boolean,
): Promise<string> {
  let errors = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await hasSeekError(driver)) {
      errors += 1;
      if (errors >= 3) {
        return "did not finish";
      }
      await driver.sleep(20000);
    }
    const outcome = await advance(driver, notes, resumeFile, dryRun);
    if (outcome) {
      return outcome;
    }
    await driver.sleep(2000);
  }
  return stepFromUrl(await driver.getCurrentUrl()) === "success" ? "applied" : "did not finish";
}

async function advance(
  driver: WebDriver,
  notes: Notes,
  resumeFile: string,
  dryRun: boolean,
): Promise<string | null> {
  const step = stepFromUrl(await driver.getCurrentUrl());
  if (step === "success") {
    return "applied";
  }
  if (step === "documents") {
    await prepareDocuments(driver, resumeFile);
    return null;
  }
  if (step === "questions") {
    const missing = await fillQuestions(driver, notes);
    return missing ? `unanswered: ${missing}` : null;
  }
  if (step === "profile") {
    await clickText(driver, "Continue");
    return null;
  }
  if (step === "review") {
    if (dryRun) {
      return "dry-run";
    }
    await clickText(driver, "Submit application");
    return null;
  }
  const url = await driver.getCurrentUrl();
  if (isTransientUrl(url)) {
    return null;
  }
  return `stopped on ${step}: ${url.split("?")[0].slice(0, 120)}`;
}

async function prepareDocuments(driver: WebDriver, resumeFile: string): Promise<void> {
  await clickText(driver, resumeFile);
  await clickText(driver, "Don't include a cover letter");
  await clickText(driver, "Continue");
}

async function fillQuestions(driver: WebDriver, notes: Notes): Promise<string | null> {
  const fields = await readFields(driver);
  const updates: Array<{ index: number; value: string }> = [];
  for (let index = 0; index < fields.length; index += 1) {
    const missing = unanswered(fields[index], notes);
    if (missing) {
      return missing;
    }
    const value = answerFor(fields[index].question, fields[index].options, notes);
    if (value && !fields[index].filled) {
      updates.push({ index, value });
    }
  }
  await fillFields(driver, updates);
  await clickText(driver, "Continue");
  return null;
}

function unanswered(field: Field, notes: Notes): string | null {
  if (field.filled || !field.required) {
    return null;
  }
  if (answerFor(field.question, field.options, notes)) {
    return null;
  }
  return field.question.replace(/\s+/g, " ").slice(0, 140);
}
