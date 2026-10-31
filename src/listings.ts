import { jobUrl } from "./tracker";

/** Loads the public role and company name for a SEEK job. */
export async function fetchListing(jobId: string): Promise<{ title: string; company: string }> {
  try {
    const response = await fetch(jobUrl(jobId), { headers: { "user-agent": "Mozilla/5.0" } });
    if (!response.ok) {
      return { title: "", company: "" };
    }
    const html = await response.text();
    return { title: matchField(html, "jobTitle"), company: matchField(html, "advertiserName") };
  } catch {
    return { title: "", company: "" };
  }
}

/** Fills blank role and company fields. Rows that already have both are left as they are. */
export async function fillMissingListings(
  rows: Array<{ jobId: string; title: string; company: string; status: string }>,
): Promise<void> {
  for (const row of rows) {
    if (row.status !== "applied" || (row.title && row.company)) {
      continue;
    }
    const listing = await fetchListing(row.jobId);
    row.title = row.title || listing.title;
    row.company = row.company || listing.company;
  }
}

function matchField(html: string, field: string): string {
  const match = html.match(new RegExp(`"${field}":"([^"]*)"`));
  return match ? decodeJson(match[1]) : "";
}

function decodeJson(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}
