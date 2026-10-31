import type { Notes } from "./notes";

/** Converts a monthly salary into an annual amount. */
export function annualSalary(monthly: number): number {
  return monthly * 12;
}

/** Formats the monthly salary for a free-text salary question. */
export function salaryText(monthly: number): string {
  return `$${monthly.toLocaleString("en-AU")} per month`;
}

/**
 * Picks the SEEK annual salary option closest to the notes.
 * Amounts under 10,000 are treated as monthly and annualised first.
 */
export function nearestSalaryOption(
  monthlyOrAnnual: number,
  options: string[],
): string | null {
  const annual =
    monthlyOrAnnual < 10_000 ? annualSalary(monthlyOrAnnual) : monthlyOrAnnual;
  const parsed = options
    .map((label) => ({ label, amount: salaryAmount(label) }))
    .filter((item): item is { label: string; amount: number } => item.amount !== null);
  if (parsed.length === 0) {
    return null;
  }
  return parsed.reduce((best, item) =>
    Math.abs(item.amount - annual) < Math.abs(best.amount - annual) ? item : best,
  ).label;
}

/** Picks a notice-period option closest to the number of months in the notes. */
export function noticeOption(months: number, options: string[]): string | null {
  const targetWeeks = months * 4;
  const ranked = options
    .map((label) => ({ label, weeks: weeksOf(label) }))
    .filter((item): item is { label: string; weeks: number } => item.weeks !== null);
  if (ranked.length === 0) {
    return null;
  }
  return ranked.reduce((best, item) =>
    Math.abs(item.weeks - targetWeeks) < Math.abs(best.weeks - targetWeeks) ? item : best,
  ).label;
}

/** Returns the option label or free-text answer, or null when the question should be skipped. */
export function answerFor(
  question: string,
  options: string[],
  notes: Notes,
): string | null {
  if (/right to work|sponsorship/i.test(question)) {
    return options.find((option) => /require sponsorship/i.test(option)) ?? null;
  }
  if (/salary/i.test(question)) {
    return options.length === 0
      ? salaryText(notes.monthlySalary)
      : nearestSalaryOption(notes.monthlySalary, options);
  }
  if (/notice/i.test(question)) {
    return noticeOption(notes.noticeMonths, options);
  }
  if (isExperience(question)) {
    return experienceAnswer(options, notes.experienceYears);
  }
  return writtenAnswer(question, options, notes);
}

function isExperience(question: string): boolean {
  return /experience|business analyst|\(ba\)|requirement/i.test(question);
}

function experienceAnswer(options: string[], years: number): string | null {
  const label = years === 1 ? "1 year" : `${years} years`;
  if (options.length === 0) {
    return label;
  }
  return options.find((option) => option.trim().toLowerCase() === label) ?? null;
}

function writtenAnswer(question: string, options: string[], notes: Notes): string | null {
  if (options.length > 0) {
    return null;
  }
  if (/visa|working entitlement/i.test(question)) {
    return notes.visa || null;
  }
  if (/interest/i.test(question)) {
    return notes.interest || null;
  }
  return null;
}

function salaryAmount(label: string): number | null {
  const compact = label.replace(/,/g, "").toLowerCase();
  const thousands = compact.match(/\$(\d+)\s*k\b/);
  if (thousands) {
    return Number(thousands[1]) * 1000;
  }
  const plain = compact.match(/\$(\d+)/);
  if (!plain) {
    return null;
  }
  const value = Number(plain[1]);
  return value < 1000 ? value * 1000 : value;
}

function weeksOf(label: string): number | null {
  if (/6 or more/i.test(label)) {
    return 8;
  }
  if (/none|ready to go/i.test(label)) {
    return 0;
  }
  const weeks = label.match(/(\d+)\s*week/i);
  return weeks ? Number(weeks[1]) : null;
}
