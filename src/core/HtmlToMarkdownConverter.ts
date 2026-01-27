import TurndownService from "turndown";

interface TextDisplayComponent {
  type: "textDisplay";
  content: string;
}

interface MediaGalleryComponent {
  type: "mediaGallery";
  urls: string[];
}

interface SeparatorComponent {
  type: "separator";
}

interface StreamComponent {
  type: "stream";
  url: string;
}

type DiscordComponent = TextDisplayComponent | MediaGalleryComponent | SeparatorComponent | StreamComponent;

interface DiscordComponentsV2 {
  components: DiscordComponent[];
}

export class HtmlToMarkdownConverter {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService();
    this.turndownService.addRule("horizontalRule", {
      filter: "hr",
      replacement: () => "\n\n───────────────────────────────\n\n",
    });
  }

  convert(html: string, link?: string): string {
    let processedHtml = this.replaceIframesWithLinks(html);
    processedHtml = this.preprocessHtml(processedHtml);
    let markdown = this.turndownService.turndown(processedHtml);
    markdown = this.cleanupMarkdown(markdown);
    markdown = this.convertDatesToDiscordTimestamps(markdown);
    markdown = this.cutMessageAtMaxLength(markdown, link);

    return markdown.trim();
  }

  private preprocessHtml(html: string): string {
    html = html.replace(/<(h[1-6])[^>]*>\s*<\/\1>/gi, "");
    html = html.replace(/<br\s*\/?>\s*<\/li>/gi, "</li>");
    html = html.replace(/<(strong|em|b|i)>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/\1>/gi, "<$1>$2</$1>");
    return html;
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

    markdown = markdown.replace(/\*\*\s*\n+([A-Za-z][^\n]{0,50})\n+\*\*/g, "**$1**");
    markdown = markdown.replace(/(\*\s+[^\n]+)\n\n+(\*\s+)/g, "$1\n$2");
    markdown = markdown.replace(/\s*\n\s*\n\s*/g, "\n\n");
    markdown = markdown.replace(/(\n\s*){3,}/g, "\n\n");
    markdown = markdown.replace(/^・/gm, "* ");
    markdown = markdown.replace(/^■\s*/gm, "* ");
    markdown = markdown.replace(/\n・/g, "\n* ");
    markdown = this.replaceImagesWithCounts(markdown);
    markdown = this.convertTitlesToDiscordFormat(markdown);
    markdown = this.wrapSpecialUrlsInBackticks(markdown);

    return markdown;
  }

  private wrapSpecialUrlsInBackticks(markdown: string): string {
    // Wrap URLs containing box characters (■) or punycode (xn--) in backticks
    // This prevents Discord from auto-converting them and keeps them as literal text

    // Pattern 1: Standalone URLs (not in markdown links) containing box or punycode
    markdown = markdown.replace(
      /(?<!`)(https?:\/\/[^\s\)]+(?:■|xn--)[^\s\)]*)/g,
      (_match: string, url: string) => {
        // Only wrap if not already in backticks
        return `\`${url}\``;
      },
    );

    // Pattern 2: Markdown links [text](url) where url contains box or punycode
    markdown = markdown.replace(
      /\[([^\]]+)\]\(([^)]+(?:■|xn--)[^)]*)\)/g,
      (_match: string, text: string, url: string) => {
        // Replace the markdown link with plain text: text + backtick url
        return `${text} \`${url}\``;
      },
    );

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
    const imagePattern = /((?:\[?!\[[^\]]*\]\([^)]+\)\]?(?:\([^)]+\))?(?:\s*\n*\s*)?)+)(\n\n|\n)?/g;

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
    markdown = this.convert12HourPatterns(markdown);
    markdown = markdown.replace(/(\d{1,2}:\d{2})(?::\d{2})?\s+(am|pm)/gi, "$1");
    markdown = this.removeNonGmtTimezoneData(markdown);
    markdown = this.parseGmtDatePatterns(markdown);
    return markdown;
  }

  private removeNonGmtTimezoneData(text: string): string {
    text = text.replace(
      /(?:\s*\/\s*(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?(?:\d{1,2}\s+)?(?:[A-Za-z]{3,9}\.?\s+)?(?:\d{1,2},?\s+)?(?:\d{4}\s+)?(?:at\s+(?:around\s+)?)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?(?:\s+(?:and|to)\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)?\s*\((?!GMT)[A-Z]{2,5}\))+/gi,
      "",
    );

    text = text.replace(
      /\s*\/\s*\d{1,2}:\d{2}(?::\d{2})?\s*\((?!GMT)[A-Z]{2,5}\)(?=\s+on\s+)/gi,
      "",
    );

    text = text.replace(
      /^(?:On\s+)?(?:From\s+)?(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?(?:\d{1,2}\s+)?[A-Za-z]{3,9}\.?\s*\d{1,2},?\s+\d{4}(?:\s+(?:at(?:\s+around)?|from))?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?(?:\s+(?:to|and)\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?(?:(?:\d{1,2}\s+)?[A-Za-z]{3,9}\.?\s*\d{1,2},?\s+\d{4}\s+)?(?:at\s+(?:around\s+)?)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)?\s*\((?!GMT)[A-Z]{2,5}\)[.,!]?\s*\n?/gm,
      "",
    );

    text = text.replace(/\n{3,}/g, "\n\n");

    return text;
  }

  private convert12HourPatterns(markdown: string): string {
    return markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\s+to\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\s*\(GMT\)/gi,
      (match, month, day, year, startHour, startMinute, startAmPm, endHour, endMinute, endAmPm) => {
        const start24 = this.convert12To24Hour(parseInt(startHour), startAmPm);
        const end24 = this.convert12To24Hour(parseInt(endHour), endAmPm);
        const startTs = this.parseDateTimeToTimestamp(day, month, year, start24.toString(), startMinute);
        let endTs = this.parseDateTimeToTimestamp(day, month, year, end24.toString(), endMinute);
        if (startTs && endTs) {
          if (endTs <= startTs) endTs += 86400;
          return this.formatTimeRange(startTs, endTs);
        }
        return match;
      },
    );
  }

  private parseGmtDatePatterns(markdown: string): string {
    markdown = markdown.replace(
      /(\*{1,2})?From\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:\s+at)?(?:\s+around)?\s+(\d{1,2}):(\d{2})(?::\d{2})?\*{0,2}\s*\n+\s*\*{0,2}(Until|To)\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:\s+at)?(?:\s+around)?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)(\*{1,2})?/gi,
      (match, startBold, sd, sm, sy, sh, smin, keyword, ed, em, ey, eh, emin, endBold) => {
        const startTs = this.parseDateTimeToTimestamp(sd, sm, sy, sh, smin);
        const endTs = this.parseDateTimeToTimestamp(ed, em, ey, eh, emin);
        if (startTs && endTs) {
          const bold = startBold || "";
          const boldEnd = endBold || "";
          return `${bold}From <t:${startTs}:F>${boldEnd}\n${bold}${keyword} <t:${endTs}:F>${boldEnd}`;
        }
        return match;
      },
    );

    markdown = markdown.replace(
      /(\*{1,2})?From\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})(?:\s+at)?(?:\s+around)?\s+(\d{1,2}):(\d{2})(?::\d{2})?\*{0,2}\s*\n+\s*\*{0,2}(Until|To)\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})(?:\s+at)?(?:\s+around)?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)(\*{1,2})?/gi,
      (match, startBold, sm, sd, sy, sh, smin, keyword, em, ed, ey, eh, emin, endBold) => {
        const startTs = this.parseDateTimeToTimestamp(sd, sm, sy, sh, smin);
        const endTs = this.parseDateTimeToTimestamp(ed, em, ey, eh, emin);
        if (startTs && endTs) {
          const bold = startBold || "";
          const boldEnd = endBold || "";
          return `${bold}From <t:${startTs}:F>${boldEnd}\n${bold}${keyword} <t:${endTs}:F>${boldEnd}`;
        }
        return match;
      },
    );

    markdown = markdown.replace(
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(?:around\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)\s+until\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(?:around\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, _sw, sd, sm, sy, sh, smin, _ew, ed, em, ey, eh, emin) => {
        const startTs = this.parseDateTimeToTimestamp(sd, sm, sy, sh, smin);
        const endTs = this.parseDateTimeToTimestamp(ed, em, ey, eh, emin);
        if (startTs && endTs) return `<t:${startTs}:F> until <t:${endTs}:F>`;
        return match;
      },
    );

    markdown = markdown.replace(
      /(From\s+)?([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+to\s+([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, fromPrefix, sm, sd, sy, sh, smin, em, ed, ey, eh, emin) => {
        const startTs = this.parseDateTimeToTimestamp(sd, sm, sy, sh, smin);
        const endTs = this.parseDateTimeToTimestamp(ed, em, ey, eh, emin);
        if (startTs && endTs) return this.formatTimeRange(startTs, endTs, fromPrefix ? "From " : "");
        return match;
      },
    );

    markdown = markdown.replace(
      /(From\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+to\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, fromPrefix, month, day, year, startHour, startMinute, endHour, endMinute) => {
        const startTs = this.parseDateTimeToTimestamp(day, month, year, startHour, startMinute);
        let endTs = this.parseDateTimeToTimestamp(day, month, year, endHour, endMinute);
        if (startTs && endTs) {
          if (endTs <= startTs) endTs += 86400;
          return this.formatTimeRange(startTs, endTs, fromPrefix ? "From " : "");
        }
        return match;
      },
    );

    markdown = markdown.replace(
      /(?:On\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+from\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+to\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, month, day, year, startHour, startMinute, endHour, endMinute) => {
        const startTs = this.parseDateTimeToTimestamp(day, month, year, startHour, startMinute);
        let endTs = this.parseDateTimeToTimestamp(day, month, year, endHour, endMinute);
        if (startTs && endTs) {
          if (endTs <= startTs) endTs += 86400;
          return this.formatTimeRange(startTs, endTs, "From ");
        }
        return match;
      },
    );

    markdown = markdown.replace(
      /(Sometime\s+on\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+and\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, prefix, month, day, year, startHour, startMinute, endHour, endMinute) => {
        const startTs = this.parseDateTimeToTimestamp(day, month, year, startHour, startMinute);
        const endTs = this.parseDateTimeToTimestamp(day, month, year, endHour, endMinute);
        if (startTs && endTs) {
          const sameDay = this.isSameDay(startTs, endTs);
          const endFormat = sameDay ? "t" : "f";
          const prefixText = prefix ? prefix.trim() + " " : "";
          return `${prefixText}<t:${startTs}:f> and <t:${endTs}:${endFormat}>`;
        }
        return match;
      },
    );

    markdown = markdown.replace(
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?(?:\s+at)?(?:\s+around)?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, _weekday, day, month, year, hour, minute) => {
        const ts = this.parseDateTimeToTimestamp(day, month, year || new Date().getFullYear().toString(), hour, minute);
        if (ts) return `<t:${ts}:F>`;
        return match;
      },
    );

    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(?:around\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, month, day, year, hour, minute) => {
        const ts = this.parseDateTimeToTimestamp(day, month, year, hour, minute);
        if (ts) return `<t:${ts}:f>`;
        return match;
      },
    );

    markdown = markdown.replace(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+from\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, month, day, year, hour, minute) => {
        const ts = this.parseDateTimeToTimestamp(day, month, year, hour, minute);
        if (ts) return `From <t:${ts}:f>`;
        return match;
      },
    );

    markdown = markdown.replace(
      /(From\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/gi,
      (match, fromPrefix, month, day, year, hour, minute) => {
        const ts = this.parseDateTimeToTimestamp(day, month, year, hour, minute);
        if (ts) {
          const prefix = fromPrefix ? "From " : "";
          return `${prefix}<t:${ts}:f>`;
        }
        return match;
      },
    );

    markdown = markdown.replace(
      /(?:approximately\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)\s+on\s+([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/gi,
      (match, hour, minute, month, day, year) => {
        const ts = this.parseDateTimeToTimestamp(day, month, year, hour, minute);
        if (ts) return `<t:${ts}:f>`;
        return match;
      },
    );

    return markdown;
  }

  private formatTimeRange(startTs: number, endTs: number, prefix: string = ""): string {
    const sameDay = this.isSameDay(startTs, endTs);
    const endFormat = sameDay ? "t" : "f";
    return `${prefix}<t:${startTs}:f> to <t:${endTs}:${endFormat}>`;
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

  private convert12To24Hour(hour: number, amPm: string): number {
    const isPm = amPm.toLowerCase() === "p";
    if (hour === 12) {
      return isPm ? 12 : 0;
    }
    return isPm ? hour + 12 : hour;
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
      } else if (key.toLowerCase() === "title" && typeof value === "string") {
        result.title = this.decodeHtmlEntities(value);
      } else if (
        key.toLowerCase() === "description" && typeof value === "string"
      ) {
        result.description = {
          html: value,
          markdown: this.convert(value, link),
          discord_components_v2: this.parseToDiscordComponents(value, link),
        };
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.addMarkdownFields(value);
      }
    }

    return result;
  }

  private parseToDiscordComponents(html: string, link?: string): DiscordComponentsV2 {
    const components: DiscordComponent[] = [];
    let workingHtml = html;

    workingHtml = workingHtml.replace(
      /<a[^>]*class="news__list--img"[^>]*>.*?<\/a>/gis,
      "",
    );

    workingHtml = this.replaceIframesWithLinks(workingHtml);

    const parts = workingHtml.split(/<hr\s*\/?>/gi);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i > 0) {
        components.push({ type: "separator" });
      }

      this.parseHtmlPartToComponents(part, components, link);
    }

    this.mergeAdjacentTextComponents(components);

    return { components };
  }

  private parseHtmlPartToComponents(
    html: string,
    components: DiscordComponent[],
    link?: string,
  ): void {
    const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const streamPattern = /<p>Stream:\s*(https?:\/\/[^\s<]+)<\/p>/gi;

    let lastIndex = 0;
    let currentImages: string[] = [];

    const allMatches: Array<{ index: number; length: number; type: "image" | "stream"; data: string }> = [];

    let match;
    while ((match = imgPattern.exec(html)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: "image",
        data: match[1],
      });
    }

    while ((match = streamPattern.exec(html)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: "stream",
        data: match[1],
      });
    }

    allMatches.sort((a, b) => a.index - b.index);

    for (const item of allMatches) {
      if (item.type === "image") {
        const textBetween = html.substring(lastIndex, item.index);
        const hasTextContent = textBetween.replace(/<[^>]*>/g, "").trim().length > 0;

        if (currentImages.length === 0) {
          this.addTextComponent(textBetween, components, link);
        } else if (hasTextContent) {
          components.push({ type: "mediaGallery", urls: currentImages });
          currentImages = [];
          this.addTextComponent(textBetween, components, link);
        }

        currentImages.push(item.data);
        lastIndex = item.index + item.length;
      } else if (item.type === "stream") {
        if (currentImages.length > 0) {
          components.push({ type: "mediaGallery", urls: currentImages });
          currentImages = [];
        }

        const textBefore = html.substring(lastIndex, item.index);
        this.addTextComponent(textBefore, components, link);

        components.push({ type: "stream", url: item.data });
        lastIndex = item.index + item.length;
      }
    }

    if (currentImages.length > 0) {
      components.push({ type: "mediaGallery", urls: currentImages });
      currentImages = [];
    }

    const remainingText = html.substring(lastIndex);
    this.addTextComponent(remainingText, components, link);
  }

  private addTextComponent(
    html: string,
    components: DiscordComponent[],
    _link?: string,
  ): void {
    if (!html.trim()) return;

    html = this.preprocessHtmlForV2(html);
    let markdown = this.turndownService.turndown(html);
    markdown = this.cleanupMarkdownForComponents(markdown);
    markdown = this.convertDatesToDiscordTimestamps(markdown);
    // Final pass after timestamp conversion: ensure single newline before ### headings
    markdown = markdown.replace(/\n\n+(###)/g, "\n$1");
    markdown = markdown.trim();

    if (markdown) {
      components.push({ type: "textDisplay", content: markdown });
    }
  }

  private preprocessHtmlForV2(html: string): string {
    html = html.replace(/<(h[1-6])[^>]*>\s*<\/\1>/gi, "");
    html = html.replace(/<br\s*\/?>\s*<\/li>/gi, "</li>");
    html = html.replace(/<(strong|em|b|i)>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/\1>/gi, "<$1>$2</$1>");
    return html;
  }

  private cleanupMarkdownForComponents(markdown: string): string {
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

    markdown = markdown.replace(/\*\*\s*\n+([A-Za-z][^\n]{0,50})\n+\*\*/g, "**$1**");
    markdown = markdown.replace(/(\*\s+[^\n]+)\n\n+(\*\s+)/g, "$1\n$2");
    markdown = markdown.replace(/[ \t]+$/gm, "");
    markdown = markdown.replace(/\n\n+/g, "\n\n");
    markdown = markdown.replace(/^・/gm, "* ");
    markdown = markdown.replace(/^■\s*/gm, "* ");
    markdown = markdown.replace(/\n・/g, "\n* ");
    markdown = this.convertTitlesToV2Format(markdown);
    markdown = this.wrapSpecialUrlsInBackticks(markdown);

    return markdown;
  }

  private convertTitlesToV2Format(markdown: string): string {
    markdown = markdown.replace(/^#{1,6}\s+(.+)$/gm, "### $1");
    markdown = markdown.replace(/^\[([^\]]+)\]\s*$/gm, "### $1");
    markdown = this.normalizeSpacingAroundV2Titles(markdown);
    return markdown;
  }

  private normalizeSpacingAroundV2Titles(markdown: string): string {
    markdown = markdown.replace(/(### [^\n]+)[\r\n]+/g, "$1\n");
    markdown = markdown.replace(/\n(?:[ \t\u3000\u00A0]*\n)+(### )/g, "\n$1");
    markdown = markdown.replace(/([^\r\n])(### [^\n]+)/g, "$1\n$2");
    return markdown;
  }

  private mergeAdjacentTextComponents(components: DiscordComponent[]): void {
    for (let i = components.length - 1; i > 0; i--) {
      const current = components[i];
      const previous = components[i - 1];

      if (current.type === "textDisplay" && previous.type === "textDisplay") {
        (previous as TextDisplayComponent).content += "\n\n" + (current as TextDisplayComponent).content;
        components.splice(i, 1);
      }
    }
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  private cutMessageAtMaxLength(
    markdown: string,
    link?: string,
  ): string {
    const maxLength = 2000;

    if (markdown === "" || markdown.length <= maxLength) {
      return markdown;
    }

    const suffix = link ? `\n\n*[Continue reading](${link})*` : "";
    let cutLength = maxLength - suffix.length - 3;

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

    return markdown.substring(0, cutLength).trimEnd() + "..." + suffix;
  }

  extractMaintenanceTimestamps(
    html: string,
  ): { start_timestamp: number | null; end_timestamp: number | null } {
    const result = { start_timestamp: null as number | null, end_timestamp: null as number | null };

    let text = html.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/&nbsp;/g, " ");
    text = this.removeNonGmtTimezoneData(text);
    text = text.replace(/\s+/g, " ");

    let match = text.match(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\s+to\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?m\.?\s*\(GMT\)/i,
    );
    if (match) {
      const start24 = this.convert12To24Hour(parseInt(match[4]), match[6]);
      const end24 = this.convert12To24Hour(parseInt(match[7]), match[9]);
      const startTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], start24.toString(), match[5]);
      let endTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], end24.toString(), match[8]);
      if (startTs && endTs) {
        if (endTs <= startTs) endTs += 86400;
        result.start_timestamp = startTs;
        result.end_timestamp = endTs;
        return result;
      }
    }

    text = text.replace(/(\d{1,2}:\d{2})(?::\d{2})?\s+(am|pm)/gi, "$1");

    match = text.match(
      /(?:From\s+)?([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+to\s+([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i,
    );
    if (match) {
      const startTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      const endTs = this.parseDateTimeToTimestamp(match[7], match[6], match[8], match[9], match[10]);
      if (startTs && endTs) {
        result.start_timestamp = startTs;
        result.end_timestamp = endTs;
        return result;
      }
    }

    match = text.match(
      /(?:From\s+)?([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+to\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i,
    );
    if (match) {
      const startTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      let endTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[6], match[7]);
      if (startTs && endTs) {
        if (endTs <= startTs) endTs += 86400;
        result.start_timestamp = startTs;
        result.end_timestamp = endTs;
        return result;
      }
    }

    match = text.match(
      /([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s+(\d{4})\s+from\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+to\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i,
    );
    if (match) {
      const startTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      let endTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[6], match[7]);
      if (startTs && endTs) {
        if (endTs <= startTs) endTs += 86400;
        result.start_timestamp = startTs;
        result.end_timestamp = endTs;
        return result;
      }
    }

    match = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\).*?until.*?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i,
    );
    if (match) {
      const startTs = this.parseDateTimeToTimestamp(match[1], match[2], match[3], match[4], match[5]);
      const endTs = this.parseDateTimeToTimestamp(match[6], match[7], match[8], match[9], match[10]);
      if (startTs && endTs) {
        result.start_timestamp = startTs;
        result.end_timestamp = endTs;
        return result;
      }
    }

    match = text.match(
      /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+between\s+(\d{1,2}):(\d{2})(?::\d{2})?\s+and\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i,
    );
    if (match) {
      const startTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      const endTs = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[6], match[7]);
      if (startTs && endTs) {
        result.start_timestamp = startTs;
        result.end_timestamp = endTs;
        return result;
      }
    }

    match = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i,
    );
    if (match) {
      const ts = this.parseDateTimeToTimestamp(
        match[1],
        match[2],
        match[3] || new Date().getFullYear().toString(),
        match[4],
        match[5],
      );
      if (ts) {
        result.start_timestamp = ts;
        return result;
      }
    }

    match = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i);
    if (match) {
      const ts = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      if (ts) {
        result.start_timestamp = ts;
        return result;
      }
    }

    match = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+from\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i);
    if (match) {
      const ts = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      if (ts) {
        result.start_timestamp = ts;
        return result;
      }
    }

    match = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*\(GMT\)/i);
    if (match) {
      const ts = this.parseDateTimeToTimestamp(match[2], match[1], match[3], match[4], match[5]);
      if (ts) {
        result.start_timestamp = ts;
        return result;
      }
    }

    return result;
  }

  public extractLiveLetterTimestamp(markdown: string): number | null {
    const dateTimeSection = markdown.match(/Date\s*&\s*Time.*?<t:(\d+):/is);
    if (dateTimeSection && dateTimeSection[1]) {
      const timestamp = parseInt(dateTimeSection[1], 10);
      if (!isNaN(timestamp)) {
        return timestamp * 1000;
      }
    }
    return null;
  }
}
