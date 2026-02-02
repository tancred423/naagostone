import { Document, DOMParser } from "deno-dom";
import { lodestoneQueue, RequestPriority } from "../../core/LodestoneRequestQueue.ts";
import * as log from "@std/log";

const domParser = new DOMParser();

export type EventType = "Special Event" | "Moogle Treasure Trove";

export interface EventTimeframe {
  type: EventType;
  from: number;
  to: number | null;
}

/**
 * Extracts short URL from topic description if it contains "Read on for details"
 */
export function extractShortUrl(description: { html?: string; markdown?: string }): string | null {
  const html = description.html || "";
  const markdown = description.markdown || "";

  // Try HTML first (more reliable)
  const htmlMatch = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>Read on<\/a>\s*for details/i);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1];
  }

  // Fallback to markdown
  const markdownMatch = markdown.match(/\[Read on\]\(([^)]+)\)\s*for details/i);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1];
  }

  return null;
}

/**
 * Extracts Moogle Treasure Trove link from topic description
 */
export function extractMoogleTreasureTroveUrl(description: { html?: string; markdown?: string }): string | null {
  const html = description.html || "";
  const markdown = description.markdown || "";

  // Try HTML - look for links containing "Moogle Treasure Trove"
  // Pattern: <a href="..." ...>Moogle Treasure Trove ... special site</a>
  const htmlMatch = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>.*?Moogle Treasure Trove[^<]*<\/a>/i);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1];
  }

  // Also check for "special site" text which appears in Moogle Treasure Trove links
  const specialSiteMatch = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>.*?special site<\/a>/i);
  if (specialSiteMatch && specialSiteMatch[1]) {
    return specialSiteMatch[1];
  }

  // Fallback to markdown
  const markdownMatch = markdown.match(/\[.*?Moogle Treasure Trove[^\]]*\]\(([^)]+)\)/i);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1];
  }

  return null;
}

/**
 * Detects event type from URL pattern
 */
export function detectEventType(url: string): EventType | null {
  // Moogle Treasure Trove pattern: /lodestone/special/mogmog-collection/<year><month>/<code>
  const mogmogPattern = /\/lodestone\/special\/mogmog-collection\/\d{6}\/[^\/]+/;
  if (mogmogPattern.test(url)) {
    return "Moogle Treasure Trove";
  }

  // Special Event pattern: /lodestone/special/<year>/<event>/<code>
  const specialEventPattern = /\/lodestone\/special\/\d{4}\/[^\/]+\/[^\/]+/;
  if (specialEventPattern.test(url)) {
    return "Special Event";
  }

  return null;
}

/**
 * Follows redirects and checks if URL matches event pattern
 * Returns the final URL and event type if it matches, null otherwise
 */
export async function checkEventUrl(shortUrl: string): Promise<{ url: string; type: EventType } | null> {
  try {
    // Make request - fetch() automatically follows redirects
    const response = await lodestoneQueue.fetchWithTimeout(
      shortUrl,
      {},
      RequestPriority.LOW,
    );

    if (!response.ok) {
      return null;
    }

    // Get the final URL from response (after redirects)
    // In Deno, response.url contains the final URL after redirects
    let finalUrl = response.url || shortUrl;

    // If response.url is not available or same as shortUrl, try to extract from Location header or HTML
    if (finalUrl === shortUrl) {
      // Check for redirect in Location header
      const location = response.headers.get("location");
      if (location) {
        finalUrl = location.startsWith("http") ? location : new URL(location, shortUrl).href;
      }
    }

    // Try to detect event type from URL pattern
    const eventType = detectEventType(finalUrl);
    if (eventType) {
      return { url: finalUrl, type: eventType };
    }

    // Fallback: check HTML content for event indicators
    // This handles cases where response.url might not be available or doesn't match
    const html = await response.text();
    const dom = domParser.parseFromString(html, "text/html");
    const document = dom as unknown as Document;

    // Check for meta description with "Event Schedule"
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      const content = metaDescription.getAttribute("content");
      if (content && content.includes("Event Schedule")) {
        // Try to extract URL from og:url meta tag
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) {
          const ogUrlContent = ogUrl.getAttribute("content");
          if (ogUrlContent) {
            const detectedType = detectEventType(ogUrlContent);
            if (detectedType) {
              return { url: ogUrlContent, type: detectedType };
            }
          }
        }
        // If we found Event Schedule but can't determine type from URL,
        // try to infer from the content pattern
        // Moogle Treasure Trove has "to the release of Patch"
        if (content.includes("to the release of Patch")) {
          return { url: finalUrl, type: "Moogle Treasure Trove" };
        }
        // Otherwise assume Special Event
        return { url: finalUrl, type: "Special Event" };
      }
    }

    return null;
  } catch (error) {
    log.debug(`Failed to check event URL ${shortUrl}: ${error}`);
    return null;
  }
}

/**
 * Parses GMT date string to timestamp
 * Handles various formats:
 * - "Wednesday, 31 December 2025 at 15:00 GMT"
 * - "Monday, February 2, 2026 at 8:00 (GMT)"
 * - "31 December 2025 at 15:00 GMT"
 * - Variations with extra spaces, punctuation, etc.
 */
function parseGmtDate(dateStr: string): number | null {
  try {
    // Normalize the string - remove GMT markers and clean up
    let cleaned = dateStr.trim();

    // Remove GMT or (GMT) markers and everything after them
    cleaned = cleaned.replace(/\s*\(?GMT\)?.*$/i, "").trim();

    // Normalize "at" separator - handle variations with spaces
    cleaned = cleaned.replace(/\s+at\s+/i, " ").trim();

    // Try multiple regex patterns to extract date components
    // Order matters - more specific patterns first
    let day: number | null = null;
    let monthName: string | null = null;
    let year: number | null = null;
    let hour: number | null = null;
    let minute: number | null = null;
    let match: RegExpMatchArray | null = null;

    // Pattern 1: "Monday, February 2, 2026 8:00" (day name, month name, day with comma)
    match = cleaned.match(/^[A-Za-z]+,?\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      monthName = match[1];
      day = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
      hour = parseInt(match[4], 10);
      minute = parseInt(match[5], 10);
    }

    // Pattern 2: "Monday, 31 December 2025 15:00" (day name, day number, month name)
    if (!match) {
      match = cleaned.match(/^[A-Za-z]+,?\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (match) {
        day = parseInt(match[1], 10);
        monthName = match[2];
        year = parseInt(match[3], 10);
        hour = parseInt(match[4], 10);
        minute = parseInt(match[5], 10);
      }
    }

    // Pattern 3: "February 2, 2026 8:00" (month name, day with comma, no day name)
    if (!match) {
      match = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (match) {
        monthName = match[1];
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        hour = parseInt(match[4], 10);
        minute = parseInt(match[5], 10);
      }
    }

    // Pattern 4: "31 December 2025 15:00" (day number, month name, no day name)
    if (!match) {
      match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (match) {
        day = parseInt(match[1], 10);
        monthName = match[2];
        year = parseInt(match[3], 10);
        hour = parseInt(match[4], 10);
        minute = parseInt(match[5], 10);
      }
    }

    // Pattern 5: "February 2 2026 8:00" (month name, day without comma, no day name) - fallback
    if (!match) {
      match = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (match) {
        monthName = match[1];
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        hour = parseInt(match[4], 10);
        minute = parseInt(match[5], 10);
      }
    }

    if (!match || day === null || monthName === null || year === null || hour === null || minute === null) {
      return null;
    }

    // Month name mapping (handles full names and abbreviations)
    const monthMap: Record<string, number> = {
      january: 0,
      jan: 0,
      february: 1,
      feb: 1,
      march: 2,
      mar: 2,
      april: 3,
      apr: 3,
      may: 4,
      june: 5,
      jun: 5,
      july: 6,
      jul: 6,
      august: 7,
      aug: 7,
      september: 8,
      sep: 8,
      sept: 8,
      october: 9,
      oct: 9,
      november: 10,
      nov: 10,
      december: 11,
      dec: 11,
    };

    const monthLower = monthName.toLowerCase().replace(/\./g, ""); // Remove dots
    const month = monthMap[monthLower];
    if (month === undefined) {
      return null;
    }

    if (isNaN(day) || isNaN(year) || isNaN(hour) || isNaN(minute)) {
      return null;
    }

    // Create UTC date
    const date = Date.UTC(year, month, day, hour, minute);

    if (isNaN(date)) {
      return null;
    }

    return date;
  } catch (error) {
    log.debug(`Failed to parse GMT date: ${dateStr}`, error);
    return null;
  }
}

/**
 * Extracts event timeframe from event page HTML
 */
export async function parseEventTimeframe(
  eventUrl: string,
  eventType: EventType,
): Promise<EventTimeframe | null> {
  try {
    const response = await lodestoneQueue.fetchWithTimeout(
      eventUrl,
      {},
      RequestPriority.LOW,
    );

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const dom = domParser.parseFromString(html, "text/html");
    const document = dom as unknown as Document;

    // Find meta description tag
    const metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      return null;
    }

    const content = metaDescription.getAttribute("content");
    if (!content) {
      return null;
    }

    // Check if it contains "Event Schedule"
    if (!content.includes("Event Schedule")) {
      return null;
    }

    // Parse based on event type
    if (eventType === "Moogle Treasure Trove") {
      // Format: "Event Schedule / From Tuesday, 8 July 2025 at 8:00 GMT (18:00 AEST) to the release of Patch 7.3"
      // Also handles "(GMT)" format
      const dateMatch = content.match(/From\s+(.+?)\s+\(?GMT\)?/i);
      if (!dateMatch || dateMatch.length < 2) {
        return null;
      }

      const fromStr = dateMatch[1].trim() + " GMT";
      const fromTimestamp = parseGmtDate(fromStr);

      if (!fromTimestamp) {
        return null;
      }

      // Moogle Treasure Trove events end at patch release, which we can't parse as a timestamp
      return {
        type: "Moogle Treasure Trove",
        from: fromTimestamp,
        to: null,
      };
    } else {
      // Special Event format: "Event Schedule / From Wednesday, 31 December 2025 at 15:00 GMT ... to Thursday, 15 January 2026 at 14:59 GMT"
      // Also handles "(GMT)" format: "From Monday, February 2, 2026 at 8:00 (GMT) ... to Monday, February 16, 2026 at 14:59 (GMT)"
      // More flexible regex to handle variations in spacing and format
      // Match from date up to GMT marker, then anything until "to", then to date (may not have GMT marker at end)
      const dateMatch = content.match(/From\s+(.+?)\s+\(?GMT\)?.*?\s+to\s+(.+?)(?:\s+\(?GMT\)?|$)/i);
      if (!dateMatch || dateMatch.length < 3) {
        return null;
      }

      // Clean up the extracted date strings - remove any trailing content after time
      let fromStr = dateMatch[1].trim();
      let toStr = dateMatch[2].trim();

      // Remove any parenthetical timezone info that might be after the time
      // For "from" date: remove complete parentheses like "(19:00 AEDT)"
      fromStr = fromStr.replace(/\s*\([^)]*(?:\([^)]*\)[^)]*)*\)\s*$/, "").trim();
      // For "to" date: remove everything from first opening paren to end (handles malformed/unclosed parentheses)
      toStr = toStr.replace(/\s*\(.*$/, "").trim();

      // Ensure we have GMT suffix for parsing
      fromStr = fromStr + " GMT";
      toStr = toStr + " GMT";

      const fromTimestamp = parseGmtDate(fromStr);
      const toTimestamp = parseGmtDate(toStr);

      if (!fromTimestamp || !toTimestamp) {
        return null;
      }

      return {
        type: "Special Event",
        from: fromTimestamp,
        to: toTimestamp,
      };
    }
  } catch (error) {
    log.debug(`Failed to parse event timeframe from ${eventUrl}:`, error);
    return null;
  }
}

/**
 * Main function to get event info for a topic
 */
export async function getEventTimeframe(
  description: { html?: string; markdown?: string },
): Promise<EventTimeframe | null> {
  // Try Special Event link first
  let shortUrl = extractShortUrl(description);

  // If no Special Event link, try Moogle Treasure Trove link
  if (!shortUrl) {
    shortUrl = extractMoogleTreasureTroveUrl(description);
  }

  if (!shortUrl) {
    return null;
  }

  // Ensure URL is absolute
  const absoluteUrl = shortUrl.startsWith("http") ? shortUrl : `https://eu.finalfantasyxiv.com${shortUrl}`;

  const eventInfo = await checkEventUrl(absoluteUrl);
  if (!eventInfo) {
    return null;
  }

  return await parseEventTimeframe(eventInfo.url, eventInfo.type);
}
