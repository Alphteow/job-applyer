import ExcelJS from "exceljs";

export interface ApplicationRow {
  appliedAt: string;
  jobId: string;
  title: string;
  company: string;
  status: string;
  url: string;
  source: string;
  notes: string;
}

const COLUMNS = [
  { header: "Applied at", key: "appliedAt", width: 26 },
  { header: "Job ID", key: "jobId", width: 14 },
  { header: "Role", key: "title", width: 40 },
  { header: "Company", key: "company", width: 42 },
  { header: "Status", key: "status", width: 18 },
  { header: "Source", key: "source", width: 12 },
  { header: "URL", key: "url", width: 42 },
  { header: "Notes", key: "notes", width: 48 },
];

/** SEEK job page for an id. */
export function jobUrl(jobId: string): string {
  return `https://au.seek.com/job/${jobId}`;
}

/** True when SEEK accepted the application or it was already on the account. */
export function isAppliedStatus(status: string): boolean {
  return status === "applied" || status === "already applied";
}

/** Statuses that will not be opened again. */
export function alreadySettled(status: string): boolean {
  if (status === "applied" || status === "external site" || status === "unanswered" || status === "dry-run" || status === "did not finish") {
    return true;
  }
  return status.startsWith("stopped on ");
}

/** How many rows count toward the daily application target. */
export function appliedCount(rows: ApplicationRow[]): number {
  return rows.filter((row) => row.status === "applied").length;
}

/** Keeps the latest log line for each job. */
export function rowsFromLog(log: string): ApplicationRow[] {
  const latest = new Map<string, ApplicationRow>();
  for (const line of log.split("\n")) {
    const row = parseLine(line);
    if (row) {
      latest.set(row.jobId, row);
    }
  }
  return [...latest.values()];
}

/** Adds hand-submitted jobs and fills blank titles from older tracker rows. */
export function mergeApplications(
  logRows: ApplicationRow[],
  extras: ApplicationRow[],
): ApplicationRow[] {
  const byId = new Map<string, ApplicationRow>();
  for (const row of extras) {
    byId.set(row.jobId, row);
  }
  for (const row of logRows) {
    const prior = byId.get(row.jobId);
    byId.set(row.jobId, {
      ...row,
      title: row.title || prior?.title || "",
      company: row.company || prior?.company || "",
    });
  }
  return [...byId.values()].sort(byAppliedAt);
}

/** Copies role and company already stored in the workbook onto matching rows. */
export function applySavedTitles(
  rows: ApplicationRow[],
  saved: Map<string, { title: string; company: string }>,
): void {
  for (const row of rows) {
    const prior = saved.get(row.jobId);
    if (!prior) {
      continue;
    }
    row.title = row.title || prior.title;
    row.company = row.company || prior.company;
  }
}

/** One tracker row for a result just produced by the apply script. */
export function rowFromResult(jobId: string, result: string, appliedAt: string): ApplicationRow {
  const parsed = parseLine(`${appliedAt} ${jobId} ${result}`);
  return parsed ?? emptyRow(jobId, appliedAt);
}

/** Writes the Applied, Other, and Summary sheets. */
export async function saveTracker(
  file: string,
  rows: ApplicationRow[],
  target: number,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  addSummary(workbook, rows, target);
  addSheet(workbook, "Applied", rows.filter((row) => row.status === "applied"));
  addSheet(workbook, "Other", rows.filter((row) => row.status !== "applied"));
  await workbook.xlsx.writeFile(file);
}

/** Reads role and company from an existing workbook, if the file is there. */
export async function titlesFromTracker(
  file: string,
): Promise<Map<string, { title: string; company: string }>> {
  const found = new Map<string, { title: string; company: string }>();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(file);
  } catch {
    return found;
  }
  readSheetTitles(workbook.getWorksheet("Applied"), found);
  readSheetTitles(workbook.getWorksheet("Other"), found);
  return found;
}

function parseLine(line: string): ApplicationRow | null {
  const match = line.match(/^(\S+)\s+(\d+)\s+(.+)$/);
  if (!match) {
    return null;
  }
  const split = splitStatus(match[3].trim());
  return {
    appliedAt: match[1],
    jobId: match[2],
    title: "",
    company: "",
    status: split.status,
    url: jobUrl(match[2]),
    source: "script",
    notes: split.notes,
  };
}

function splitStatus(raw: string): { status: string; notes: string } {
  if (raw.startsWith("unanswered:")) {
    return { status: "unanswered", notes: raw.slice("unanswered:".length).trim() };
  }
  if (isAppliedStatus(raw)) {
    return { status: "applied", notes: "" };
  }
  return { status: raw, notes: "" };
}

function emptyRow(jobId: string, appliedAt: string): ApplicationRow {
  return {
    appliedAt,
    jobId,
    title: "",
    company: "",
    status: "",
    url: jobUrl(jobId),
    source: "script",
    notes: "",
  };
}

function byAppliedAt(left: ApplicationRow, right: ApplicationRow): number {
  return left.appliedAt.localeCompare(right.appliedAt) || left.jobId.localeCompare(right.jobId);
}

function addSummary(workbook: ExcelJS.Workbook, rows: ApplicationRow[], target: number): void {
  const sheet = workbook.addWorksheet("Summary");
  const applied = appliedCount(rows);
  sheet.addRow(["Applied", applied]);
  sheet.addRow(["Target", target]);
  sheet.addRow(["Remaining", Math.max(0, target - applied)]);
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 12;
}

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: ApplicationRow[]): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = COLUMNS;
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: "A1", to: "H1" };
}

function readSheetTitles(
  sheet: ExcelJS.Worksheet | undefined,
  found: Map<string, { title: string; company: string }>,
): void {
  if (!sheet) {
    return;
  }
  const columns = headerColumns(sheet.getRow(1));
  if (columns.id === 0) {
    return;
  }
  sheet.eachRow((row, index) => {
    if (index === 1) {
      return;
    }
    rememberTitle(found, row, columns);
  });
}

function headerColumns(header: ExcelJS.Row): { id: number; title: number; company: number } {
  const columns = { id: 0, title: 0, company: 0 };
  header.eachCell((cell, col) => {
    const value = String(cell.value ?? "");
    if (value === "Job ID") {
      columns.id = col;
    }
    if (value === "Role") {
      columns.title = col;
    }
    if (value === "Company") {
      columns.company = col;
    }
  });
  return columns;
}

function rememberTitle(
  found: Map<string, { title: string; company: string }>,
  row: ExcelJS.Row,
  columns: { id: number; title: number; company: number },
): void {
  const jobId = String(row.getCell(columns.id).value ?? "");
  if (!jobId) {
    return;
  }
  found.set(jobId, {
    title: String(row.getCell(columns.title).value ?? ""),
    company: String(row.getCell(columns.company).value ?? ""),
  });
}
