import { describe, expect, it } from "vitest";
import { chromeLaunchArgs } from "./chrome-launch";
import { countsTowardLimit, isBotCheckText, isTransientUrl, seenJobIds, stepFromUrl } from "./steps";

describe("countsTowardLimit", () => {
  it("counts submitted applications and dry-runs, and ignores skips", () => {
    expect(countsTowardLimit("applied")).toBe(true);
    expect(countsTowardLimit("dry-run")).toBe(true);
    expect(countsTowardLimit("external site")).toBe(false);
  });
});

describe("chromeLaunchArgs", () => {
  it("opens a normal Chrome window instead of a WebDriver-controlled one", () => {
    const args = chromeLaunchArgs("/tmp/profile", 9333);
    expect(args).toContain("--remote-debugging-port=9333");
    expect(args).toContain("--user-data-dir=/tmp/profile");
    expect(args.join(" ")).not.toMatch(/enable-automation|webdriver/i);
  });
});

describe("seenJobIds", () => {
  it("collects job ids already written to the log", () => {
    const ids = seenJobIds("2026-10-31T04:29:10.040Z 95543696 applied\n95255711 external site\n");
    expect(ids.has("95543696")).toBe(true);
    expect(ids.has("95255711")).toBe(true);
  });
});

describe("isTransientUrl", () => {
  it("treats a SEEK login redirect as unfinished", () => {
    expect(isTransientUrl("https://au.seek.com/oauth/callback?code=secret")).toBe(true);
    expect(isTransientUrl("https://au.seek.com/job/1/apply")).toBe(false);
  });
});

describe("isBotCheckText", () => {
  it("recognises a Cloudflare check and ignores a normal results page", () => {
    expect(isBotCheckText("Performing security verification. verify you are not a bot")).toBe(true);
    expect(isBotCheckText("Business Analyst jobs")).toBe(false);
  });
});

describe("stepFromUrl", () => {
  it("recognises each SEEK apply step and an employer site", () => {
    expect(stepFromUrl("https://au.seek.com/job/1/apply")).toBe("documents");
    expect(stepFromUrl("https://au.seek.com/job/1/apply/role-requirements")).toBe("questions");
    expect(stepFromUrl("https://au.seek.com/job/1/apply/profile")).toBe("profile");
    expect(stepFromUrl("https://au.seek.com/job/1/apply/review")).toBe("review");
    expect(stepFromUrl("https://au.seek.com/job/1/apply/success")).toBe("success");
    expect(stepFromUrl("https://applynow.net.au/jobs/1")).toBe("external");
  });
});
