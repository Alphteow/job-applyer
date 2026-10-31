import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

const log = [
  "2026-10-31T04:23:24.657Z 95543696 unanswered question",
  "2026-10-31T04:29:10.040Z 95543696 applied",
  "2026-10-31T04:29:13.143Z 95455499 external site",
  "2026-10-31T05:56:08.803Z 95562911 unanswered: How many years of SQL?",
].join("\n");

describe("rowsFromLog", () => {
  it("keeps the latest status and splits an unanswered question into notes", () => {
    const rows = rowsFromLog(log);
    const gateway = rows.find((row) => row.jobId === "95543696");
    const unanswered = rows.find((row) => row.jobId === "95562911");
    expect(gateway?.status).toBe("applied");
    expect(unanswered?.status).toBe("unanswered");
    expect(unanswered?.notes).toBe("How many years of SQL?");
    expect(appliedCount(rows)).toBe(1);
  });
});

describe("mergeApplications", () => {
  it("keeps a hand-submitted job that is not in the log and reuses its title", () => {
    const manual = [sample("95308084", "Business Analyst", "SEMPHN")];
    const merged = mergeApplications(rowsFromLog(log), manual);
    expect(merged.find((row) => row.jobId === "95308084")?.source).toBe("manual");
    const saved = new Map([["95543696", { title: "Business Analyst", company: "Gateway Bank Ltd" }]]);
    applySavedTitles(merged, saved);
    expect(merged.find((row) => row.jobId === "95543696")?.company).toBe("Gateway Bank Ltd");
  });
});

describe("alreadySettled", () => {
  it("leaves submitted, external, and unfinished jobs closed", () => {
    expect(alreadySettled("did not finish")).toBe(true);
    expect(alreadySettled("applied")).toBe(true);
    expect(alreadySettled("stopped on external: https://example.com")).toBe(true);
  });
});

describe("saveTracker", () => {
  it("round-trips role and company through the workbook", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "seek-tracker-"));
    const file = path.join(dir, "applications.xlsx");
    const rows = [rowFromResult("95543696", "applied", "2026-10-31T04:29:10.040Z")];
    rows[0].title = "Business Analyst";
    rows[0].company = "Gateway Bank Ltd";
    await saveTracker(file, rows, 100);
    const saved = await titlesFromTracker(file);
    expect(saved.get("95543696")).toEqual({
      title: "Business Analyst",
      company: "Gateway Bank Ltd",
    });
    expect(appliedCount(rows)).toBe(1);
    await rm(dir, { recursive: true });
  });
});

function sample(jobId: string, title: string, company: string): ApplicationRow {
  return {
    appliedAt: "2026-10-31",
    jobId,
    title,
    company,
    status: "applied",
    url: `https://au.seek.com/job/${jobId}`,
    source: "manual",
    notes: "",
  };
}
