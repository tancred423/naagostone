import TurndownService from "turndown";

export class HtmlToMarkdownConverter {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService();
  }

  convert(html: string, link?: string): string {
    const processedHtml = this.replaceIframesWithLinks(html);
    let markdown = this.turndownService.turndown(processedHtml);
    markdown = this.cleanupMarkdown(markdown);
    markdown = this.convertDatesToDiscordTimestamps(markdown);
    markdown = this.cutMessageAtMaxLength(markdown, link);

    return markdown.trim();
  }

  private replaceIframesWithLinks(html: string): string {
    return html.replace(
      /<div[^>]*mdl-youtube[^>]*>.*?<iframe[^>]+src=["']([^"']+)["'][^>]*>.*?<\/div>/gis,
      (_match: string, iframeSrc: string) => {
        const cleanUrl = this.extractCleanVideoUrl(iframeSrc);
        return `<p>Stream: ${cleanUrl}</p>`;
      },
    );
  }

  private extractCleanVideoUrl(iframeSrc: string): string {
    if (iframeSrc.includes("twitch.tv")) {
      const videoMatch = iframeSrc.match(/video=(\d+)/);
      if (videoMatch) {
        return `https://www.twitch.tv/videos/${videoMatch[1]}`;
      }
    } else if (iframeSrc.includes("youtube.com/embed/")) {
      const youtubeMatch = iframeSrc.match(/youtube\.com\/embed\/([^?&]+)/);
      if (youtubeMatch) {
        return `https://www.youtube.com/watch?v=${youtubeMatch[1]}`;
      }
    }
    return iframeSrc;
  }

  private cleanupMarkdown(markdown: string): string {
    markdown = markdown
      .replaceAll("\\", "")
      .replaceAll("](/lodestone", "](https://eu.finalfantasyxiv.com/lodestone");

    markdown = markdown.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match: string, text: string, url: string) => {
        if (text === url || text.trim() === url.trim()) {
          return url;
        }
        return _match;
      },
    );

    markdown = markdown.replace(/\s*\n\s*\n\s*/g, "\n\n");
    markdown = markdown.replace(/(\n\s*){3,}/g, "\n\n");
    markdown = markdown.replace(/^・/gm, "* ");
    markdown = markdown.replace(/^■\s*/gm, "* ");
    markdown = markdown.replace(/\n・/g, "\n* ");
    markdown = this.replaceImagesWithCounts(markdown);
    markdown = this.convertTitlesToDiscordFormat(markdown);

    return markdown;
  }

  private convertTitlesToDiscordFormat(markdown: string): string {
    markdown = markdown.replace(/^#{1,6}\s+(.+)$/gm, "**__$1__**");
    markdown = markdown.replace(/^\[([^\]]+)\]\s*$/gm, "**__$1__**");
    markdown = this.normalizeSpacingAroundTitles(markdown);
    return markdown;
  }

  private normalizeSpacingAroundTitles(markdown: string): string {
    markdown = markdown.replace(/(\*\*__[^_]+__\*\*)\n\n+/g, "$1\n");
    markdown = markdown.replace(/([^\n])\n(\*\*__[^_]+__\*\*)/g, "$1\n\n$2");
    return markdown;
  }

  private replaceImagesWithCounts(markdown: string): string {
    // Match both standalone images ![](url) and linked images [![](url)](link)
    // Group consecutive images together (separated only by whitespace)
    const imagePattern =
      /((?:\[?!\[[^\]]*\]\([^)]+\)\]?(?:\([^)]+\))?(?:\s*\n*\s*)?)+)(\n\n|\n)?/g;

    let result = markdown.replace(
      imagePattern,
      (match, images, trailingNewlines) => {
        // Count individual images in the matched group
        const singleImagePattern = /!\[[^\]]*\]\([^)]+\)/g;
        const imageMatches = images.match(singleImagePattern);
        const count = imageMatches ? imageMatches.length : 0;

        if (count === 0) {
          return match;
        }

        const imageText = count === 1 ? "image" : "images";
        const trailing = trailingNewlines || "\n\n";
        return `_${count} ${imageText}_${trailing}`;
      },
    );

    // Remove the first image marker if it's at the very start (this is the banner)
    result = result.replace(/^_\d+ images?_\s*\n+/, "");

    return result;
  }

  private convertDatesToDiscordTimestamps(markdown: string): string {
    // Preprocessing: Remove erroneous am/pm markers (24-hour format with am/pm is an error)
    markdown = markdown.replace(/(\d{1,2}:\d{2})\s+(am|pm)/gi, "$1");

    // Pattern 0a: Multiple timezone lines with time range and optional "From" prefix
    // Example: "From Oct. 1, 2025 02:06 to 02:55 (GMT)  \nFrom Oct. 1, 2025 03:06 to 03:55 (BST)"
    markdown = markdown.replace(
      /(From\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+to\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\n(?:From\s+)?[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s+to\s+\d{1,2}:\d{2}\s+\([A-Z]{3,4}\)){1,}/gi,
      (
        match,
        fromPrefix,
        month,
        day,
        year,
        startHour,
        startMinute,
        endHour,
        endMinute,
      ) => {
        const startTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          startHour,
          startMinute,
        );
        let endTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          endHour,
          endMinute,
        );

        if (startTimestamp && endTimestamp) {
          // If end time is before start time, it's the next day
          if (endTimestamp <= startTimestamp) {
            endTimestamp += 86400; // Add 24 hours
          }
          const sameDay = this.isSameDay(startTimestamp, endTimestamp);
          const endFormat = sameDay ? "t" : "f";
          const prefix = fromPrefix ? "From " : "";
          return `${prefix}<t:${startTimestamp}:f> to <t:${endTimestamp}:${endFormat}>`;
        }
        return match;
      },
    );

    // Pattern 0b: Multiple timezone lines for same time with optional "From" prefix
    // Example: "From Nov. 5, 2025 4:24 (GMT)  \nFrom Nov. 5, 2025 15:24 (AEDT)"
    markdown = markdown.replace(
      /(From\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\n(?:From\s+)?[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s+\([A-Z]{3,4}\)){1,}/gi,
      (match, fromPrefix, month, day, year, hour, minute) => {
        const timestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          hour,
          minute,
        );
        if (timestamp) {
          const prefix = fromPrefix ? "From " : "";
          return `${prefix}<t:${timestamp}:f>`;
        }
        return match;
      },
    );

    // Pattern 0b2: Multiple timezone lines with "from" keyword (open-ended time)
    // Example: "Nov. 11, 2025 from 10:00 (GMT)  \nNov. 11, 2025 from 21:00 (AEDT)"
    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+from\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\n[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}\s+from\s+\d{1,2}:\d{2}\s+\([A-Z]{3,4}\)){1,}/gi,
      (match, month, day, year, hour, minute) => {
        const timestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          hour,
          minute,
        );
        if (timestamp) {
          return `From <t:${timestamp}:f>`;
        }
        return match;
      },
    );

    // Pattern 0c: Inline multiple timezone times with "/" separator (consolidate to single timestamp)
    // Example: "Oct. 7, 2025 10:00 (GMT) / Oct. 7, 2025 11:00 (BST) / Oct. 7, 2025 21:00 (AEDT)"
    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\/\s*[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s+\([A-Z]{3,4}\)){1,}/gi,
      (match, month, day, year, hour, minute) => {
        const timestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          hour,
          minute,
        );
        if (timestamp) {
          return `<t:${timestamp}:f>`;
        }
        return match;
      },
    );

    // Pattern 0d: Weekday with time range using "until" with inline timezone alternatives
    // Example: "Thursday, 6 November 2025 at 8:00 (GMT) / 19:00 (AEDT) until Thursday, 27 November 2025 at 14:59 (GMT) / Friday, 28 November 2025 at 1:59 (AEDT)"
    markdown = markdown.replace(
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\/\s*\d{1,2}:\d{2}\s+\([^)]+\))?\s+until\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\/\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+\([^)]+\))?/gi,
      (
        match,
        _startWeekday,
        startDay,
        startMonth,
        startYear,
        startHour,
        startMinute,
        _endWeekday,
        endDay,
        endMonth,
        endYear,
        endHour,
        endMinute,
      ) => {
        const startTimestamp = this.parseDateTimeToTimestamp(
          startDay,
          startMonth,
          startYear,
          startHour,
          startMinute,
        );
        const endTimestamp = this.parseDateTimeToTimestamp(
          endDay,
          endMonth,
          endYear,
          endHour,
          endMinute,
        );

        if (startTimestamp && endTimestamp) {
          return `<t:${startTimestamp}:F> until <t:${endTimestamp}:F>`;
        }
        return match;
      },
    );

    // Pattern 1: Full date with weekday and time
    // Example: "Friday, 31 October at 11:00 (GMT) / 22:00 (AEDT)"
    markdown = markdown.replace(
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\/\s*(\d{1,2}):(\d{2})\s+\([^)]+\))?/gi,
      (match, _weekday, day, month, year, hour, minute) => {
        const timestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year || new Date().getFullYear().toString(),
          hour,
          minute,
        );
        if (timestamp) {
          return `<t:${timestamp}:F>`;
        }
        return match;
      },
    );

    // Pattern 2: Date with time range (no weekday)
    // Example: "Sometime on Nov. 4, 2025 between 4:00 and 11:00 (GMT) / 15:00 and 22:00 (AEDT)"
    markdown = markdown.replace(
      /(Sometime\s+on\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s+and\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\/\s*(\d{1,2}):(\d{2})\s+and\s+(\d{1,2}):(\d{2})\s+\([^)]+\))?/gi,
      (
        match,
        prefix,
        month,
        day,
        year,
        startHour,
        startMinute,
        endHour,
        endMinute,
      ) => {
        const dateTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          startHour,
          startMinute,
        );
        const startTimeTimestamp = dateTimestamp;
        const endTimeTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          endHour,
          endMinute,
        );

        if (dateTimestamp && startTimeTimestamp && endTimeTimestamp) {
          const prefixText = prefix ? prefix.trim() + " " : "";
          const sameDay = this.isSameDay(startTimeTimestamp, endTimeTimestamp);
          const endFormat = sameDay ? "t" : "f";
          return `${prefixText}<t:${dateTimestamp}:f> and <t:${endTimeTimestamp}:${endFormat}>`;
        }
        return match;
      },
    );

    // Pattern 3: Date with time range "to" (multi-line with AEDT)
    // Example: "Nov. 4, 2025 7:00 to 8:00 (GMT)  \nNov. 4, 2025 18:00 to 19:00 (AEDT)"
    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+to\s+(\d{1,2}):(\d{2})\s+\(GMT\)\s*\n[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s+to\s+\d{1,2}:\d{2}\s+\([^)]+\)/gi,
      (match, month, day, year, startHour, startMinute, endHour, endMinute) => {
        const startTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          startHour,
          startMinute,
        );
        let endTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          endHour,
          endMinute,
        );

        if (startTimestamp && endTimestamp) {
          // If end time is before start time, it's the next day
          if (endTimestamp <= startTimestamp) {
            endTimestamp += 86400; // Add 24 hours
          }
          const sameDay = this.isSameDay(startTimestamp, endTimestamp);
          const endFormat = sameDay ? "t" : "f";
          return `<t:${startTimestamp}:f> to <t:${endTimestamp}:${endFormat}>`;
        }
        return match;
      },
    );

    // Pattern 3b: Date with time range "to" (single line)
    // Example: "Nov. 4, 2025 7:00 to 8:00 (GMT)"
    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+to\s+(\d{1,2}):(\d{2})\s+\(GMT\)/gi,
      (match, month, day, year, startHour, startMinute, endHour, endMinute) => {
        const startTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          startHour,
          startMinute,
        );
        let endTimestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          endHour,
          endMinute,
        );

        if (startTimestamp && endTimestamp) {
          // If end time is before start time, it's the next day
          if (endTimestamp <= startTimestamp) {
            endTimestamp += 86400; // Add 24 hours
          }
          const sameDay = this.isSameDay(startTimestamp, endTimestamp);
          const endFormat = sameDay ? "t" : "f";
          return `<t:${startTimestamp}:f> to <t:${endTimestamp}:${endFormat}>`;
        }
        return match;
      },
    );

    // Pattern 4: Date with single time (no weekday)
    // Example: "Nov. 4, 2025 at 4:00 (GMT)"
    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)(?:\s*\/\s*(\d{1,2}):(\d{2})\s+\([^)]+\))?/gi,
      (match, month, day, year, hour, minute) => {
        const timestamp = this.parseDateTimeToTimestamp(
          day,
          month,
          year,
          hour,
          minute,
        );
        if (timestamp) {
          return `<t:${timestamp}:f> at <t:${timestamp}:t>`;
        }
        return match;
      },
    );

    return markdown;
  }

  private isSameDay(timestamp1: number, timestamp2: number): boolean {
    const date1 = new Date(timestamp1 * 1000);
    const date2 = new Date(timestamp2 * 1000);

    return (
      date1.getUTCFullYear() === date2.getUTCFullYear() &&
      date1.getUTCMonth() === date2.getUTCMonth() &&
      date1.getUTCDate() === date2.getUTCDate()
    );
  }

  private parseDateTimeToTimestamp(
    day: string,
    month: string,
    year: string,
    hour: string,
    minute: string,
  ): number | null {
    try {
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
        october: 9,
        oct: 9,
        november: 10,
        nov: 10,
        december: 11,
        dec: 11,
      };

      const monthLower = month.toLowerCase();
      const monthIndex = monthMap[monthLower];
      if (monthIndex === undefined) {
        return null;
      }

      const utcDate = new Date(
        Date.UTC(
          parseInt(year),
          monthIndex,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          0,
          0,
        ),
      );

      return Math.floor(utcDate.getTime() / 1000);
    } catch {
      return null;
    }
  }

  addMarkdownFields(data: unknown): unknown {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.addMarkdownFields(item));
    }

    const result = { ...data } as Record<string, unknown>;

    const link = typeof result.link === "string" ? result.link : undefined;

    for (const key in result) {
      const value = result[key];

      if (key.toLowerCase() === "date") {
        result.date = (result.date as number) * 1000;
      } else if (
        key.toLowerCase() === "description" && typeof value === "string"
      ) {
        result.description = {
          html: value,
          markdown: this.convert(value, link),
        };
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.addMarkdownFields(value);
      }
    }

    return result;
  }

  private cutMessageAtMaxLength(
    markdown: string,
    link?: string,
  ): string {
    const maxLength = 2000;

    if (markdown === "" || markdown.length <= maxLength) {
      return markdown;
    }

    const suffix = link ? `\n\n*[Continue reading...](${link})*` : "...";
    let cutLength = maxLength - suffix.length;

    // Find the last complete word before cutLength
    const lastSpaceIndex = markdown.lastIndexOf(" ", cutLength);
    const lastNewlineIndex = markdown.lastIndexOf("\n", cutLength);
    const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);

    if (lastBreakIndex > 0 && lastBreakIndex > cutLength - 100) {
      cutLength = lastBreakIndex;
    }

    // Check if we're cutting inside a markdown link [text](url)
    // Look backwards for unclosed brackets/parentheses
    const checkStr = markdown.substring(0, cutLength);

    let openBrackets = 0;
    let openParens = 0;
    let inLink = false;

    for (let i = 0; i < checkStr.length; i++) {
      if (checkStr[i] === "[" && (i === 0 || checkStr[i - 1] !== "\\")) {
        openBrackets++;
        inLink = false;
      } else if (checkStr[i] === "]" && (i === 0 || checkStr[i - 1] !== "\\")) {
        openBrackets--;
        if (
          openBrackets === 0 && i + 1 < checkStr.length &&
          checkStr[i + 1] === "("
        ) {
          inLink = true;
        }
      } else if (
        checkStr[i] === "(" && inLink && (i === 0 || checkStr[i - 1] !== "\\")
      ) {
        openParens++;
      } else if (checkStr[i] === ")" && (i === 0 || checkStr[i - 1] !== "\\")) {
        openParens--;
        if (openParens === 0) {
          inLink = false;
        }
      }
    }

    // If we're inside a link, find the start of it and cut there
    if (openBrackets > 0 || openParens > 0 || inLink) {
      const lastCompleteLinkEnd = checkStr.lastIndexOf(")");
      if (lastCompleteLinkEnd > 0 && lastCompleteLinkEnd < cutLength) {
        cutLength = lastCompleteLinkEnd + 1;
      } else {
        const lastOpenBracket = checkStr.lastIndexOf("[");
        if (lastOpenBracket > 0) {
          cutLength = lastOpenBracket;
          while (cutLength > 0 && /\s/.test(checkStr[cutLength - 1])) {
            cutLength--;
          }
        }
      }
    }

    return markdown.substring(0, cutLength).trimEnd() + suffix;
  }

  /**
   * Extract start and end timestamps from maintenance description HTML
   * Returns an object with start_timestamp and end_timestamp (or null if not found)
   */
  extractMaintenanceTimestamps(
    html: string,
  ): { start_timestamp: number | null; end_timestamp: number | null } {
    const result = {
      start_timestamp: null as number | null,
      end_timestamp: null as number | null,
    };

    // Convert HTML to plain text (rough conversion)
    let text = html.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/\s+/g, " ");

    // Remove erroneous am/pm markers (24-hour format with am/pm is an error)
    text = text.replace(/(\d{1,2}:\d{2})\s+(am|pm)/gi, "$1");

    // Try multiple patterns to extract timestamps

    // Pattern 1: Date with time range "to" with optional "From" prefix
    // Example: "From Nov. 4, 2025 7:00 to 8:00 (GMT)" or "Oct. 1, 2025 02:06 to 02:55 (GMT)"
    let match = text.match(
      /(?:From\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+to\s+(\d{1,2}):(\d{2})\s+\(GMT\)/i,
    );
    if (match) {
      const startTimestamp = this.parseDateTimeToTimestamp(
        match[2],
        match[1],
        match[3],
        match[4],
        match[5],
      );
      let endTimestamp = this.parseDateTimeToTimestamp(
        match[2],
        match[1],
        match[3],
        match[6],
        match[7],
      );

      if (startTimestamp && endTimestamp) {
        // If end time is before start time, it's the next day
        if (endTimestamp <= startTimestamp) {
          endTimestamp += 86400; // Add 24 hours
        }
        result.start_timestamp = startTimestamp;
        result.end_timestamp = endTimestamp;
        return result;
      }
    }

    // Pattern 2: Weekday with time range using "until"
    // Example: "Thursday, 6 November 2025 at 8:00 (GMT) until Thursday, 27 November 2025 at 14:59 (GMT)"
    match = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\).*?until.*?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)/i,
    );
    if (match) {
      const startTimestamp = this.parseDateTimeToTimestamp(
        match[1],
        match[2],
        match[3],
        match[4],
        match[5],
      );
      const endTimestamp = this.parseDateTimeToTimestamp(
        match[6],
        match[7],
        match[8],
        match[9],
        match[10],
      );

      if (startTimestamp && endTimestamp) {
        result.start_timestamp = startTimestamp;
        result.end_timestamp = endTimestamp;
        return result;
      }
    }

    // Pattern 3: Date with time range "between...and"
    // Example: "Nov. 4, 2025 between 4:00 and 11:00 (GMT)"
    match = text.match(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})\s+and\s+(\d{1,2}):(\d{2})\s+\(GMT\)/i,
    );
    if (match) {
      const startTimestamp = this.parseDateTimeToTimestamp(
        match[2],
        match[1],
        match[3],
        match[4],
        match[5],
      );
      const endTimestamp = this.parseDateTimeToTimestamp(
        match[2],
        match[1],
        match[3],
        match[6],
        match[7],
      );

      if (startTimestamp && endTimestamp) {
        result.start_timestamp = startTimestamp;
        result.end_timestamp = endTimestamp;
        return result;
      }
    }

    // Pattern 4: Full date with weekday and single time (no end time, just a start time)
    // Example: "Friday, 31 October 2025 at 11:00 (GMT)"
    match = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)/i,
    );
    if (match) {
      const timestamp = this.parseDateTimeToTimestamp(
        match[1],
        match[2],
        match[3] || new Date().getFullYear().toString(),
        match[4],
        match[5],
      );
      if (timestamp) {
        result.start_timestamp = timestamp;
        // For single timestamp, we don't set end_timestamp
        return result;
      }
    }

    // Pattern 5: Date with single time (no weekday, no end time)
    // Example: "Nov. 4, 2025 at 4:00 (GMT)"
    match = text.match(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+\(GMT\)/i,
    );
    if (match) {
      const timestamp = this.parseDateTimeToTimestamp(
        match[2],
        match[1],
        match[3],
        match[4],
        match[5],
      );
      if (timestamp) {
        result.start_timestamp = timestamp;
        // For single timestamp, we don't set end_timestamp
        return result;
      }
    }

    // Pattern 6: Date with "from" keyword (open-ended time)
    // Example: "Nov. 11, 2025 from 10:00 (GMT)"
    match = text.match(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+from\s+(\d{1,2}):(\d{2})\s+\(GMT\)/i,
    );
    if (match) {
      const timestamp = this.parseDateTimeToTimestamp(
        match[2],
        match[1],
        match[3],
        match[4],
        match[5],
      );
      if (timestamp) {
        result.start_timestamp = timestamp;
        // For "from" patterns, we don't set end_timestamp
        return result;
      }
    }

    return result;
  }
}
