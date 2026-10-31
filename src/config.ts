import type { Notes } from "./notes";
import { jobUrl, type ApplicationRow } from "./tracker";

export interface ManualApplication {
  appliedAt: string;
  jobId: string;
  title: string;
  company: string;
}

export interface ApplyConfig {
  searchUrl: string;
  resumeFile: string;
  notes: Notes;
  manualApplications: ManualApplication[];
}

/** Reads the private apply settings from personal/config.json. */
export function parseConfig(raw: string): ApplyConfig {
  const data = parseObject(raw);
  return {
    searchUrl: requiredText(data, "searchUrl"),
    resumeFile: requiredText(data, "resumeFile"),
    notes: readNotes(data),
    manualApplications: readManual(data.manualApplications),
  };
}

/** Builds a SEEK search URL for a results page. Page 1 keeps the configured URL. */
export function searchPageUrl(searchUrl: string, page: number): string {
  const url = new URL(searchUrl);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

/** Turns hand-entered applications into tracker rows. */
export function manualRows(entries: ManualApplication[]): ApplicationRow[] {
  return entries.map((entry) => ({
    appliedAt: entry.appliedAt,
    jobId: entry.jobId,
    title: entry.title,
    company: entry.company,
    status: "applied",
    url: jobUrl(entry.jobId),
    source: "manual",
    notes: "",
  }));
}

function parseObject(raw: string): Record<string, unknown> {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data)) {
    throw new Error("personal/config.json must be a JSON object");
  }
  return data;
}

function readNotes(data: Record<string, unknown>): Notes {
  return {
    monthlySalary: requiredNumber(data, "baseSalary"),
    noticeMonths: requiredNumber(data, "noticeMonths"),
    experienceYears: optionalNumber(data, "experienceYears") ?? 1,
    visa: optionalText(data, "visa"),
    interest: optionalText(data, "interest"),
  };
}

function readManual(value: unknown): ManualApplication[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("personal/config.json manualApplications must be a list");
  }
  return value.map(readManualEntry);
}

function readManualEntry(value: unknown): ManualApplication {
  if (!isRecord(value)) {
    throw new Error("each manualApplications entry must be an object");
  }
  return {
    appliedAt: requiredText(value, "appliedAt"),
    jobId: requiredText(value, "jobId"),
    title: optionalText(value, "title"),
    company: optionalText(value, "company"),
  };
}

function requiredText(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`personal/config.json needs ${key}`);
  }
  return value.trim();
}

function optionalText(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function requiredNumber(data: Record<string, unknown>, key: string): number {
  const value = optionalNumber(data, key);
  if (value === null) {
    throw new Error(`personal/config.json needs ${key}`);
  }
  return value;
}

function optionalNumber(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
