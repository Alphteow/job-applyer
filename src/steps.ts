/** Counts a finished application or a completed dry-run toward the run limit. */
export function countsTowardLimit(result: string): boolean {
  return result === "applied" || result === "dry-run";
}

/** Job ids already attempted, so a later run can start on listings it has not opened. */
export function seenJobIds(log: string): Set<string> {
  const ids = new Set<string>();
  for (const line of log.split("\n")) {
    const match = line.match(/(?:^|\s)(\d{5,})(?:\s|$)/);
    if (match) {
      ids.add(match[1]);
    }
  }
  return ids;
}

/** True when SEEK is showing a Cloudflare check instead of search results. */
export function isBotCheckText(text: string): boolean {
  return /security verification|verify you are not a bot/i.test(text);
}

/** A SEEK login redirect that should be waited out rather than treated as a finished step. */
export function isTransientUrl(url: string): boolean {
  return /\/oauth\/|login\.seek\.com|accounts\.google\.com/.test(url);
}

export type Step =
  | "documents"
  | "questions"
  | "profile"
  | "review"
  | "success"
  | "external"
  | "unknown";

/** Maps a SEEK apply URL to the current step in the form. */
export function stepFromUrl(url: string): Step {
  if (!url.includes("au.seek.com")) {
    return "external";
  }
  if (url.includes("/apply/success")) {
    return "success";
  }
  if (url.includes("/role-requirements")) {
    return "questions";
  }
  if (url.includes("/apply/profile")) {
    return "profile";
  }
  if (url.includes("/apply/review")) {
    return "review";
  }
  if (url.includes("/apply")) {
    return "documents";
  }
  return "unknown";
}
