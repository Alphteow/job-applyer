import { describe, expect, it } from "vitest";
import { answerFor, nearestSalaryOption, noticeOption } from "./answers";
import type { Notes } from "./notes";

const notes: Notes = {
  monthlySalary: 6500,
  noticeMonths: 2,
  experienceYears: 1,
  visa: "Need a 482 visa",
  interest: "The analyst work",
};
const salaries = ["$70k", "$80k", "$90k"];
const notice = ["4 weeks", "5 weeks", "6 or more weeks"];

describe("answerFor", () => {
  it("maps a monthly salary of 6500 to the $80k annual option", () => {
    expect(nearestSalaryOption(6500, salaries)).toBe("$80k");
  });

  it("maps two months of notice to 6 or more weeks", () => {
    expect(noticeOption(2, notice)).toBe("6 or more weeks");
  });

  it("selects sponsorship, salary, notice, and one year of analyst experience", () => {
    expect(
      answerFor("Which statement describes your right to work in Australia?", [
        "I'm an Australian citizen",
        "I require sponsorship to work for a new employer",
      ], notes),
    ).toMatch(/sponsorship/i);
    expect(answerFor("What's your expected annual base salary?", salaries, notes)).toBe(
      "$80k",
    );
    expect(
      answerFor("How much notice are you required to give your current employer?", notice, notes),
    ).toBe("6 or more weeks");
    expect(
      answerFor("How many years' experience do you have in a business analyst (BA) role?", [
        "No experience",
        "1 year",
      ], notes),
    ).toBe("1 year");
    expect(
      answerFor("How many years of Business Requirements Analysis experience do you have?", [
        "1 year",
        "2 years",
      ], notes),
    ).toBe("1 year");
  });

  it("answers every experience question with one year", () => {
    expect(
      answerFor("How many years' experience do you have in the financial services industry?", [
        "No experience",
        "1 year",
      ], notes),
    ).toBe("1 year");
    expect(
      answerFor("How many years' experience do you have as a Management Consultant?", [
        "No experience",
        "1 year",
      ], notes),
    ).toBe("1 year");
  });

  it("writes the visa and interest notes into free-text questions", () => {
    expect(
      answerFor("Please provide details of your visa/working entitlements.", [], notes),
    ).toBe("Need a 482 visa");
    expect(answerFor("Please outline what interests you about this position.", [], notes)).toBe(
      "The analyst work",
    );
  });

  it("leaves an unknown required question unanswered", () => {
    expect(answerFor("Are you willing to relocate to Sydney?", ["Yes", "No"], notes)).toBeNull();
  });

  it("writes the monthly salary into a free-text salary question", () => {
    expect(answerFor("Salary expectations (including superannuation)", [], notes)).toBe(
      "$6,500 per month",
    );
  });
});
