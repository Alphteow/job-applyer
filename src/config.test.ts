import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { manualRows, parseConfig, searchPageUrl } from "./config";

const sample = `{
  "searchUrl": "https://au.seek.com/jobs",
  "resumeFile": "resume.pdf",
  "baseSalary": 6500,
  "noticeMonths": 2,
  "experienceYears": 1,
  "visa": "Need a 482 visa",
  "interest": "The analyst work",
  "manualApplications": [
    { "appliedAt": "2026-10-31", "jobId": "95308084", "title": "Business Analyst", "company": "SEMPHN" }
  ]
}`;

describe("parseConfig", () => {
  it("reads salary, notice, visa, interest, and the resume name", () => {
    const config = parseConfig(sample);
    expect(config.resumeFile).toBe("resume.pdf");
    expect(config.notes).toEqual({
      monthlySalary: 6500,
      noticeMonths: 2,
      experienceYears: 1,
      visa: "Need a 482 visa",
      interest: "The analyst work",
    });
  });

  it("turns hand-entered jobs into applied tracker rows", () => {
    const [row] = manualRows(parseConfig(sample).manualApplications);
    expect(row).toMatchObject({
      jobId: "95308084",
      company: "SEMPHN",
      status: "applied",
      source: "manual",
    });
  });

  it("rejects a config that is missing salary", () => {
    expect(() => parseConfig('{"searchUrl":"https://au.seek.com","resumeFile":"resume.pdf"}')).toThrow(
      /baseSalary/,
    );
  });
});

describe("searchPageUrl", () => {
  it("adds a page number without dropping the configured search", () => {
    expect(searchPageUrl("https://au.seek.com/jobs?type=standard", 2)).toBe(
      "https://au.seek.com/jobs?type=standard&page=2",
    );
  });
});

describe("config.example.json", () => {
  it("is a valid config a friend can copy", async () => {
    const raw = await readFile(path.resolve(import.meta.dirname, "../config.example.json"), "utf8");
    expect(parseConfig(raw).resumeFile).toBe("resume.pdf");
  });
});
