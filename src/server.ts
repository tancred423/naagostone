import { Context, Hono } from "hono";
import { cors } from "hono/middleware";
import * as log from "@std/log";
import { load } from "@std/dotenv";
import { HtmlToMarkdownConverter } from "./core/HtmlToMarkdownConverter.ts";
import { Character } from "./parser/character/Character.ts";
import { ItemLevel } from "./parser/character/ItemLevel.ts";
import { CharacterSearch } from "./parser/character/CharacterSearch.ts";
import { RaidProgression } from "./parser/character/RaidProgression.ts";
import { RateLimiter } from "./middleware/RateLimiter.ts";
import { InputValidator } from "./middleware/InputValidator.ts";
import { Topics } from "./parser/news/Topics.ts";
import { Notices } from "./parser/news/Notices.ts";
import { NoticesDetails } from "./parser/news/NoticesDetails.ts";
import { Maintenances } from "./parser/news/Maintenances.ts";
import { MaintenancesDetails } from "./parser/news/MaintenancesDetails.ts";
import { Updates } from "./parser/news/Updates.ts";
import { UpdatesDetails } from "./parser/news/UpdatesDetails.ts";
import { Status } from "./parser/news/Status.ts";
import { StatusDetails } from "./parser/news/StatusDetails.ts";
import { RequestPriority } from "./core/LodestoneRequestQueue.ts";
import { FreeCompany } from "./parser/freecompany/FreeCompany.ts";
import { WorldStatus } from "./parser/worldstatus/WorldStatus.ts";
import { getEventTimeframe as getEventInfo } from "./parser/news/EventTimeframeParser.ts";

await load({ export: true });

// Get log level from environment variable, default to INFO for production
const logLevel = (Deno.env.get("LOG_LEVEL") || "INFO").toUpperCase();
const validLogLevels = ["DEBUG", "INFO", "WARN", "ERROR"] as const;
const effectiveLogLevel =
  (validLogLevels.includes(logLevel as typeof validLogLevels[number]) ? logLevel : "INFO") as typeof validLogLevels[
    number
  ];

log.setup({
  handlers: {
    console: new log.ConsoleHandler(effectiveLogLevel, {
      formatter: (logRecord) => {
        const timestamp = new Date().toISOString();
        return `${timestamp} [${logRecord.levelName}] ${logRecord.msg}`;
      },
    }),
  },
  loggers: {
    default: {
      level: effectiveLogLevel,
      handlers: ["console"],
    },
  },
});

// Log the configured log level (using console.log since log might not be ready yet)
console.log(`Log level set to: ${effectiveLogLevel} (set LOG_LEVEL environment variable to change)`);

const markdownConverter = new HtmlToMarkdownConverter();
const rateLimiter = new RateLimiter(60000, 100);
const app = new Hono();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.use("/*", rateLimiter.middleware());

app.use("/*", async (context: Context, next: () => Promise<void>) => {
  const start = Date.now();
  await next();

  if (context.req.path === "/favicon.ico") {
    return;
  }

  const ms = Date.now() - start;
  const status = context.res.status;
  const isSuccess = status >= 200 && status < 300;

  if (!isSuccess) {
    let responseError: string | null = null;
    try {
      const response = context.res as Response;
      if (response && typeof response.clone === "function") {
        const clonedResponse = response.clone();
        const contentType = clonedResponse.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const body = await clonedResponse.json();
          if (body && typeof body === "object" && "error" in body) {
            responseError = String(body.error);
          }
        }
      }
    } catch {
      // If we can't read the response body, that's okay
    }

    const errorMsg = responseError || "Unknown error";
    log.error(`${context.req.method} ${context.req.path} - ${status} (${ms}ms) - Error: ${errorMsg}`);
    return;
  }

  log.info(`${context.req.method} ${context.req.path} - ${status} (${ms}ms)`);
});

app.get("/", (context: Context) => {
  const deploymentHash = Deno.env.get("DEPLOYMENT_HASH") || "development";

  return context.json({
    name: "FFXIV Lodestone API",
    deployment: {
      hash: deploymentHash,
    },
    endpoints: {
      character: {
        search: {
          method: "GET",
          path: "/character/search",
          description: "Search for characters",
          params: {
            name: "Character name (query parameter)",
            worldname: "World name (query parameter)",
            page: "Page number (query parameter, optional)",
          },
        },
        profile: {
          method: "GET",
          path: "/character/:characterId",
          description: "Get character profile by ID",
          params: {
            characterId: "Character ID (path parameter)",
          },
        },
      },
      lodestone: {
        topics: {
          method: "GET",
          path: "/lodestone/topics",
          description: "Get topics with details. Possible event types: 'Special Event' | 'Moogle Treasure Trove'",
        },
        notices: {
          method: "GET",
          path: "/lodestone/notices",
          description: "Get notices with details",
        },
        maintenance: {
          method: "GET",
          path: "/lodestone/maintenances",
          description: "Get maintenances with details",
        },
        updates: {
          method: "GET",
          path: "/lodestone/updates",
          description: "Get updates with details",
        },
        status: {
          method: "GET",
          path: "/lodestone/statuses",
          description: "Get statuses with details",
        },
        worldstatus: {
          method: "GET",
          path: "/lodestone/worldstatus",
          description: "Get world status for all data centers",
        },
      },
    },
  });
});

app.get("/favicon.ico", (context: Context) => {
  return context.body(null, 204);
});

const characterParser = new Character();
const characterSearch = new CharacterSearch();
const freeCompanyParser = new FreeCompany();
const raidProgressionParser = new RaidProgression();
const topicsParser = new Topics();
const noticesParser = new Notices();
const noticesDetailsParser = new NoticesDetails();
const maintenanceParser = new Maintenances();
const maintenanceDetailsParser = new MaintenancesDetails();
const updatesParser = new Updates();
const updatesDetailsParser = new UpdatesDetails();
const statusParser = new Status();
const statusDetailsParser = new StatusDetails();
const worldStatusParser = new WorldStatus();

app.get("/character/search", async (context: Context) => {
  const name = context.req.query("name");
  if (!InputValidator.validateCharacterName(name)) {
    return InputValidator.createValidationError(
      context,
      "Invalid character name. Must be 1-100 characters with letters, numbers, spaces, hyphens, or apostrophes.",
    );
  }

  const page = context.req.query("page");
  if (!InputValidator.validatePageNumber(page)) {
    return InputValidator.createValidationError(
      context,
      "Invalid page number. Must be a positive integer.",
    );
  }

  try {
    const parsed = await characterSearch.parse(context, "", RequestPriority.HIGH);
    return context.json(parsed as Record<string, unknown>);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`Character search error: ${error.message}`);
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/character/:characterId", async (context: Context) => {
  const characterId = context.req.param("characterId");
  if (!InputValidator.validateCharacterId(characterId)) {
    return InputValidator.createValidationError(
      context,
      "Invalid character ID. Must be a positive integer.",
    );
  }

  const bioColumns = context.req.query("columns");
  if (bioColumns?.indexOf("Bio") !== -1 && bioColumns !== undefined) {
    context.header("Cache-Control", "max-age=3600");
  }

  try {
    const character = await characterParser.parse(context, "Character.", RequestPriority.HIGH);
    let parsed = {
      character: {
        id: +characterId,
        ...character,
      },
    } as Record<string, unknown>;

    parsed = fixNameColorIfOnlySecondDyeIsBeingUsed(parsed);
    parsed = countDyeSlots(parsed);
    parsed = parseNumericStrings(parsed);
    (parsed.character as Record<string, unknown>).item_level = ItemLevel
      .getAverageItemLevel(parsed);

    const characterData = parsed.character as Record<string, unknown>;
    if (characterData.bio && typeof characterData.bio === "string") {
      const bioHtml = characterData.bio;
      characterData.bio = {
        html: bioHtml,
        markdown: markdownConverter.convert(bioHtml),
      };
    }

    // Fetch free company tag if free company ID exists
    const freeCompany = characterData.free_company as Record<string, unknown> | undefined;
    if (freeCompany?.id) {
      freeCompany.tag = null;

      try {
        // Clean and validate the free company ID
        // The parser now preserves large numbers as strings to avoid precision loss
        let freeCompanyId = String(freeCompany.id).trim();

        // Remove any trailing slashes or extra characters that might have been captured
        freeCompanyId = freeCompanyId.replace(/\/$/, "").trim();

        // Remove any non-numeric characters (in case the regex captured extra stuff)
        const numericId = freeCompanyId.replace(/[^0-9]/g, "");

        if (!numericId || numericId === "null" || numericId === "undefined") {
          log.warn(`Invalid free company ID: ${freeCompany.id} (cleaned: ${freeCompanyId})`);
        } else {
          const freeCompanyUrl = `https://eu.finalfantasyxiv.com/lodestone/freecompany/${numericId}/`;
          log.debug(`Fetching free company tag from: ${freeCompanyUrl}`);

          const freeCompanyData = await freeCompanyParser.parse(
            context,
            "",
            freeCompanyUrl,
            RequestPriority.HIGH,
          ) as Record<string, unknown>;

          const tag = freeCompanyData.tag as string | undefined;
          if (tag) {
            // Remove &laquo; and &raquo; HTML entities, and also the decoded characters « and »
            const cleanedTag = tag
              .replace(/&laquo;/g, "")
              .replace(/&raquo;/g, "")
              .replace(/«/g, "")
              .replace(/»/g, "")
              .trim();
            freeCompany.tag = cleanedTag;
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        log.warn(`Failed to fetch free company tag for ID "${freeCompany.id}": ${error.message}`);
      }
    }

    try {
      const raidProgression = await raidProgressionParser.parse(context);
      if (raidProgression) {
        (parsed.character as Record<string, unknown>).raid_progression = raidProgression;
      } else {
        (parsed.character as Record<string, unknown>).raid_progression = null;
      }
    } catch (err: unknown) {
      const error = err as Error;
      log.warn(`Failed to fetch raid progression for character ${characterId}: ${error.message}`);
      (parsed.character as Record<string, unknown>).raid_progression = null;
    }

    return context.json(parsed);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`Character fetch error for ID ${characterId}: ${error.message}`);
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

function fixNameColorIfOnlySecondDyeIsBeingUsed(
  parsed: Record<string, unknown>,
) {
  const character = parsed.character as Record<string, Record<string, unknown>>;
  if (!character) {
    return parsed;
  }

  if (
    !character.mainhand?.color_code &&
    character.mainhand?.color_code2
  ) {
    character.mainhand.color_name2 = character.mainhand.color_name;
    delete character.mainhand.color_name;
  }

  if (
    !character.offhand?.color_code &&
    character.offhand?.color_code2
  ) {
    character.offhand.color_name2 = character.offhand.color_name;
    delete character.offhand.color_name;
  }

  if (
    !character.head?.color_code && character.head?.color_code2
  ) {
    character.head.color_name2 = character.head.color_name;
    delete character.head.color_name;
  }

  if (
    !character.body?.color_code && character.body?.color_code2
  ) {
    character.body.color_name2 = character.body.color_name;
    delete character.body.color_name;
  }

  if (
    !character.hands?.color_code && character.hands?.color_code2
  ) {
    character.hands.color_name2 = character.hands.color_name;
    delete character.hands.color_name;
  }

  if (
    !character.legs?.color_code && character.legs?.color_code2
  ) {
    character.legs.color_name2 = character.legs.color_name;
    delete character.legs.color_name;
  }

  if (
    !character.feet?.color_code && character.feet?.color_code2
  ) {
    character.feet.color_name2 = character.feet.color_name;
    delete character.feet.color_name;
  }

  if (
    !character.earrings?.color_code &&
    character.earrings?.color_code2
  ) {
    character.earrings.color_name2 = character.earrings.color_name;
    delete character.earrings.color_name;
  }

  if (
    !character.necklace?.color_code &&
    character.necklace?.color_code2
  ) {
    character.necklace.color_name2 = character.necklace.color_name;
    delete character.necklace.color_name;
  }

  if (
    !character.bracelets?.color_code &&
    character.bracelets?.color_code2
  ) {
    character.bracelets.color_name2 = character.bracelets.color_name;
    delete character.bracelets.color_name;
  }

  if (
    !character.ring1?.color_code && character.ring1?.color_code2
  ) {
    character.ring1.color_name2 = character.ring1.color_name;
    delete character.ring1.color_name;
  }

  if (
    !character.ring2?.color_code && character.ring2?.color_code2
  ) {
    character.ring2.color_name2 = character.ring2.color_name;
    delete character.ring2.color_name;
  }

  return parsed;
}

function countDyeSlots(parsed: Record<string, unknown>) {
  const character = parsed.character as Record<string, Record<string, unknown>>;
  if (!character) {
    return parsed;
  }

  if (character.mainhand?.amount_dye_slots) {
    character.mainhand.amount_dye_slots = ((character.mainhand.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.offhand?.amount_dye_slots) {
    character.offhand.amount_dye_slots = ((character.offhand.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.head?.amount_dye_slots) {
    character.head.amount_dye_slots = ((character.head.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.body?.amount_dye_slots) {
    character.body.amount_dye_slots = ((character.body.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.hands?.amount_dye_slots) {
    character.hands.amount_dye_slots = ((character.hands.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.legs?.amount_dye_slots) {
    character.legs.amount_dye_slots = ((character.legs.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.feet?.amount_dye_slots) {
    character.feet.amount_dye_slots = ((character.feet.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.earrings?.amount_dye_slots) {
    character.earrings.amount_dye_slots = ((character.earrings.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.necklace?.amount_dye_slots) {
    character.necklace.amount_dye_slots = ((character.necklace.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.bracelets?.amount_dye_slots) {
    character.bracelets.amount_dye_slots = ((character.bracelets.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.ring1?.amount_dye_slots) {
    character.ring1.amount_dye_slots = ((character.ring1.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  if (character.ring2?.amount_dye_slots) {
    character.ring2.amount_dye_slots = ((character.ring2.amount_dye_slots as string).split("<img")[0].match(
      /staining/g,
    ) || []).length;
  }

  return parsed;
}

function parseNumericStrings(parsed: Record<string, unknown>) {
  const character = parsed.character as Record<string, unknown>;
  if (!character) {
    return parsed;
  }

  // Parse bozja mettle
  if (character.bozja && typeof character.bozja === "object") {
    const bozja = character.bozja as Record<string, unknown>;
    if (typeof bozja.mettle === "string") {
      const cleanedValue = bozja.mettle.replace(/,/g, "");
      const numValue = Number(cleanedValue);
      if (!isNaN(numValue)) {
        bozja.mettle = numValue;
      }
    }
  }

  // Parse job exp values (current_exp and max_exp)
  const jobFields = [
    "paladin",
    "warrior",
    "darkknight",
    "gunbreaker",
    "whitemage",
    "scholar",
    "astrologian",
    "sage",
    "monk",
    "dragoon",
    "ninja",
    "samurai",
    "reaper",
    "viper",
    "bard",
    "machinist",
    "dancer",
    "blackmage",
    "summoner",
    "redmage",
    "pictomancer",
    "bluemage",
    "carpenter",
    "blacksmith",
    "armorer",
    "goldsmith",
    "leatherworker",
    "weaver",
    "alchemist",
    "culinarian",
    "miner",
    "botanist",
    "fisher",
    "eureka",
  ];

  for (const jobField of jobFields) {
    if (character[jobField] && typeof character[jobField] === "object") {
      const job = character[jobField] as Record<string, unknown>;

      if (typeof job.current_exp === "string") {
        const cleanedValue = job.current_exp.replace(/,/g, "");
        const numValue = Number(cleanedValue);
        if (!isNaN(numValue)) {
          job.current_exp = numValue;
        }
      }

      if (typeof job.max_exp === "string") {
        const cleanedValue = job.max_exp.replace(/,/g, "");
        const numValue = Number(cleanedValue);
        if (!isNaN(numValue)) {
          job.max_exp = numValue;
        }
      }
    }
  }

  return parsed;
}

app.get("/lodestone/topics", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const topics = await topicsParser.parse(context, "", undefined, RequestPriority.LOW);
    const topicsFiltered = Object.fromEntries(
      Object.entries(topics).filter(([_, v]) => v !== null),
    );

    const parsed = {
      topics: {
        ...topicsFiltered,
      },
    } as Record<string, Record<string, unknown>>;

    for (const key in parsed.topics) {
      const topic = parsed.topics[key];
      if (topic && (topic as Record<string, unknown>).link) {
        (topic as Record<string, unknown>).link = "https://eu.finalfantasyxiv.com" +
          (topic as Record<string, unknown>).link;
      }
    }

    const resArray = [];
    for (const topicKey in parsed.topics) {
      const topic = parsed.topics[topicKey];
      if (topic) resArray.push(topic);
    }

    parsed.topics = resArray as unknown as Record<string, unknown>;

    const withMarkdown = markdownConverter.addMarkdownFields(parsed) as Record<string, unknown>;

    const topicsArray = withMarkdown.topics as Array<Record<string, unknown>>;
    for (const topic of topicsArray) {
      topic.timestamp_live_letter = null;
      const title = topic.title as string | undefined;
      if (title && /letter from the producer live/i.test(title) && !/digest/i.test(title)) {
        const description = topic.description as { markdown?: string } | undefined;
        if (description?.markdown) {
          topic.timestamp_live_letter = markdownConverter.extractLiveLetterTimestamp(description.markdown);
        }
      }

      topic.event = null;
      const topicDescription = topic.description as { html?: string; markdown?: string } | undefined;
      if (topicDescription) {
        try {
          const eventInfo = await getEventInfo(topicDescription);
          topic.event = eventInfo;
        } catch (error) {
          log.debug(`Failed to parse event timeframe for topic: ${error}`);
          topic.event = null;
        }
      }
    }

    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`Topics fetch error: ${error.message}`);
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/notices", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const notices = await noticesParser.parse(context, "", undefined, RequestPriority.LOW);
    const noticesFiltered = Object.fromEntries(
      Object.entries(notices).filter(([_, v]) => v !== null),
    );

    // Extract special notices and regular notices from the parsed result
    const specialNotices = (noticesFiltered.special_notices as { list?: Array<Record<string, unknown>> })?.list || [];
    const allRegularNotices = (noticesFiltered.regular_notices as { list?: Array<Record<string, unknown>> })?.list ||
      [];

    // Take first 10 regular notices (they're already in chronological order on the page)
    const regularNotices = allRegularNotices.slice(0, 10);

    // Merge all notices into one array
    const allNotices = [...specialNotices, ...regularNotices];

    // Filter out null entries and add full URLs to links
    const processedNotices = allNotices
      .filter((notice) => notice !== null)
      .map((notice) => {
        if (notice?.link && typeof notice.link === "string") {
          notice.link = "https://eu.finalfantasyxiv.com" + notice.link;
        }
        return notice;
      });

    // Sort by date (timestamp) descending - newest first
    processedNotices.sort((a, b) => {
      const dateA = (a.date as number) || 0;
      const dateB = (b.date as number) || 0;
      return dateB - dateA;
    });

    // Take top 10 newest notices
    const top10Notices = processedNotices.slice(0, 10);

    const parsed = {
      notices: top10Notices,
    } as Record<string, unknown>;

    const detailsPromises = top10Notices
      .map((notice) => noticesDetailsParser.parse(context, "", notice.link as string, RequestPriority.LOW, "notices"));
    const detailsResults = await Promise.all(detailsPromises);

    top10Notices.forEach(
      (notice, index: number) => {
        Object.assign(notice, detailsResults[index]);
      },
    );

    const withMarkdown = markdownConverter.addMarkdownFields(parsed);
    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/maintenances", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const maintenances = await maintenanceParser.parse(context, "", undefined, RequestPriority.LOW);
    const parsed = {
      maintenances: {
        ...maintenances,
      },
    } as Record<string, unknown>;

    for (
      const key in (parsed.maintenances as Record<string, Record<string, unknown>>)
    ) {
      const maintenance = (parsed.maintenances as Record<string, Record<string, unknown>>)[key];
      if (maintenance?.link) {
        maintenance.link = "https://eu.finalfantasyxiv.com" + maintenance.link;
      }
    }

    const resArray = [];
    for (
      const maintenanceKey in (parsed.maintenances as Record<string, unknown>)
    ) {
      const maintenance = (parsed.maintenances as Record<string, unknown>)[maintenanceKey];
      if (maintenance) resArray.push(maintenance);
    }

    parsed.maintenances = resArray;

    const detailsPromises = (parsed.maintenances as Array<Record<string, unknown>>).map((
      maintenance,
    ) =>
      maintenanceDetailsParser.parse(
        context,
        "",
        (maintenance as Record<string, unknown>)?.link as string,
        RequestPriority.LOW,
        "maintenances",
      )
    );
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.maintenances as Array<Record<string, unknown>>).forEach(
      (maintenance, index: number) => {
        if (maintenance) {
          Object.assign(maintenance, detailsResults[index]);

          if (
            maintenance.description &&
            typeof maintenance.description === "string" &&
            maintenance.tag === "[Maintenance]"
          ) {
            const timestamps = markdownConverter.extractMaintenanceTimestamps(
              maintenance.description,
            );
            maintenance.start_timestamp = timestamps.start_timestamp ? timestamps.start_timestamp * 1000 : null;
            maintenance.end_timestamp = timestamps.end_timestamp ? timestamps.end_timestamp * 1000 : null;
          }
        }
      },
    );

    const withMarkdown = markdownConverter.addMarkdownFields(parsed);
    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/updates", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const updates = await updatesParser.parse(context, "", undefined, RequestPriority.LOW);
    const updatesFiltered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== null),
    );

    const parsed = {
      updates: {
        ...updatesFiltered,
      },
    } as Record<string, unknown>;

    for (
      const key in (parsed.updates as Record<string, Record<string, unknown>>)
    ) {
      const update = (parsed.updates as Record<string, Record<string, unknown>>)[key];
      if (update?.link) {
        update.link = "https://eu.finalfantasyxiv.com" + update.link;
      }
    }

    const resArray: unknown[] = [];
    for (const updateKey in (parsed.updates as Record<string, unknown>)) {
      const update = (parsed.updates as Record<string, unknown>)[updateKey];
      if (update) resArray.push(update);
    }

    parsed.updates = resArray;

    const detailsPromises = (parsed.updates as Array<Record<string, unknown>>)
      .map((update) => updatesDetailsParser.parse(context, "", update.link as string, RequestPriority.LOW, "updates"));
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.updates as Array<Record<string, unknown>>).forEach(
      (update, index: number) => {
        Object.assign(update, detailsResults[index]);
      },
    );

    const withMarkdown = markdownConverter.addMarkdownFields(parsed);
    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/statuses", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const status = await statusParser.parse(context, "", undefined, RequestPriority.LOW);
    const statusFiltered = Object.fromEntries(
      Object.entries(status).filter(([_, v]) => v !== null),
    );

    const parsed = {
      statuses: {
        ...statusFiltered,
      },
    } as Record<string, unknown>;

    for (
      const key in (parsed.statuses as Record<string, Record<string, unknown>>)
    ) {
      const statusItem = (parsed.statuses as Record<string, Record<string, unknown>>)[key];
      if (statusItem?.link) {
        statusItem.link = "https://eu.finalfantasyxiv.com" + statusItem.link;
      }
    }

    const resArray: unknown[] = [];
    for (const statusKey in (parsed.statuses as Record<string, unknown>)) {
      const statusItem = (parsed.statuses as Record<string, unknown>)[statusKey];
      if (statusItem) resArray.push(statusItem);
    }

    parsed.statuses = resArray;

    const detailsPromises = (parsed.statuses as Array<Record<string, unknown>>)
      .map((statusItem) =>
        statusDetailsParser.parse(context, "", statusItem.link as string, RequestPriority.LOW, "statuses")
      );
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.statuses as Array<Record<string, unknown>>).forEach(
      (statusItem, index: number) => {
        Object.assign(statusItem, detailsResults[index]);
      },
    );

    const withMarkdown = markdownConverter.addMarkdownFields(parsed);
    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/worldstatus", async (context: Context) => {
  context.header("Cache-Control", "max-age=60");

  try {
    const worldStatus = await worldStatusParser.parse(context);
    return context.json(worldStatus);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`World status fetch error: ${error.message}`);
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else if (error.message === "503") {
      return context.json({ error: "Service unavailable" }, 503);
    } else return context.json({ error: error.message }, 500);
  }
});

const port = parseInt(Deno.env.get("PORT") || "3001");
const hostname = Deno.env.get("SERVER_HOST") || "127.0.0.1";

log.debug(`Attempting to bind to hostname: ${hostname}, port: ${port}`);

try {
  Deno.serve({
    port,
    hostname,
    onListen: ({ hostname, port }) => {
      log.debug(`onListen received - hostname: ${hostname}, port: ${port}`);
      let displayHost = hostname;
      if (hostname === "0.0.0.0") {
        displayHost = "localhost";
      } else if (hostname === "127.0.0.1") {
        displayHost = "localhost";
      }
      log.info(`Server running on http://${displayHost}:${port}`);
    },
    onError: (error: unknown) => {
      const err = error as Error;
      log.error(`Server error: ${err.message}`);
      return new Response("Internal Server Error", { status: 500 });
    },
  }, app.fetch);
} catch (error) {
  const err = error as Error;
  log.error(`Failed to start server: ${err.message}`);
  Deno.exit(1);
}
