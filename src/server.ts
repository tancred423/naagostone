import { Context, Hono } from "hono";
import { cors } from "hono/middleware";
import * as log from "@std/log";
import { HtmlToMarkdownConverter } from "./core/HtmlToMarkdownConverter.ts";
import { Character } from "./parser/character/Character.ts";
import { ItemLevel } from "./parser/character/ItemLevel.ts";
import { CharacterSearch } from "./parser/character/CharacterSearch.ts";
import { RateLimiter } from "./middleware/RateLimiter.ts";
import { InputValidator } from "./middleware/InputValidator.ts";
import { ResponseCache } from "./middleware/ResponseCache.ts";
import { Topics } from "./parser/news/Topics.ts";
import { Notices } from "./parser/news/Notices.ts";
import { NoticesDetails } from "./parser/news/NoticesDetails.ts";
import { Maintenances } from "./parser/news/Maintenances.ts";
import { MaintenancesDetails } from "./parser/news/MaintenancesDetails.ts";
import { Updates } from "./parser/news/Updates.ts";
import { UpdatesDetails } from "./parser/news/UpdatesDetails.ts";
import { Status } from "./parser/news/Status.ts";
import { StatusDetails } from "./parser/news/StatusDetails.ts";

log.setup({
  handlers: {
    console: new log.ConsoleHandler("DEBUG", {
      formatter: (logRecord) => {
        const timestamp = new Date().toISOString();
        return `${timestamp} [${logRecord.levelName}] ${logRecord.msg}`;
      },
    }),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

const markdownConverter = new HtmlToMarkdownConverter();
const rateLimiter = new RateLimiter(60000, 100);
const newsCache = new ResponseCache(300);
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
  const ms = Date.now() - start;
  log.info(
    `${context.req.method} ${context.req.path} - ${context.res.status} (${ms}ms)`,
  );
});

app.get("/", (context: Context) => {
  return context.json({
    name: "FFXIV Lodestone API",
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
          description: "Get topics with details",
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
      },
    },
  });
});

const characterParser = new Character();
const characterSearch = new CharacterSearch();
const topicsParser = new Topics();
const noticesParser = new Notices();
const noticesDetailsParser = new NoticesDetails();
const maintenanceParser = new Maintenances();
const maintenanceDetailsParser = new MaintenancesDetails();
const updatesParser = new Updates();
const updatesDetailsParser = new UpdatesDetails();
const statusParser = new Status();
const statusDetailsParser = new StatusDetails();

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
    const parsed = await characterSearch.parse(context);
    return context.json(parsed as Record<string, unknown>);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`Character search error: ${error.message}`);
    return context.json({ error: error.message }, 500);
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
    const character = await characterParser.parse(context, "Character.");
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

    return context.json(parsed);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`Character fetch error for ID ${characterId}: ${error.message}`);
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
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
    character.mainhand.amount_dye_slots =
      ((character.mainhand.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.offhand?.amount_dye_slots) {
    character.offhand.amount_dye_slots =
      ((character.offhand.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.head?.amount_dye_slots) {
    character.head.amount_dye_slots =
      ((character.head.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.body?.amount_dye_slots) {
    character.body.amount_dye_slots =
      ((character.body.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.hands?.amount_dye_slots) {
    character.hands.amount_dye_slots =
      ((character.hands.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.legs?.amount_dye_slots) {
    character.legs.amount_dye_slots =
      ((character.legs.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.feet?.amount_dye_slots) {
    character.feet.amount_dye_slots =
      ((character.feet.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.earrings?.amount_dye_slots) {
    character.earrings.amount_dye_slots =
      ((character.earrings.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.necklace?.amount_dye_slots) {
    character.necklace.amount_dye_slots =
      ((character.necklace.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.bracelets?.amount_dye_slots) {
    character.bracelets.amount_dye_slots =
      ((character.bracelets.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.ring1?.amount_dye_slots) {
    character.ring1.amount_dye_slots =
      ((character.ring1.amount_dye_slots as string).split("<img")[0].match(
        /staining/g,
      ) || []).length;
  }

  if (character.ring2?.amount_dye_slots) {
    character.ring2.amount_dye_slots =
      ((character.ring2.amount_dye_slots as string).split("<img")[0].match(
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
  const cacheKey = "lodestone:topics";
  const cached = newsCache.get(cacheKey);

  if (cached) {
    context.header("X-Cache", "HIT");
    context.header("Cache-Control", "public, max-age=300");
    context.header("ETag", cached.etag);

    if (context.req.header("If-None-Match") === cached.etag) {
      return context.body(null, 304);
    }

    return context.json(cached.data);
  }

  context.header("X-Cache", "MISS");
  context.header("Cache-Control", "public, max-age=300");

  try {
    const topics = await topicsParser.parse(context);
    const topicsFiltered = Object.fromEntries(
      Object.entries(topics).filter(([_, v]) => v !== null),
    );

    const parsed = {
      Topics: {
        ...topicsFiltered,
      },
    } as Record<string, Record<string, unknown>>;

    for (const key in parsed.Topics) {
      const topic = parsed.Topics[key];
      if (topic && (topic as Record<string, unknown>).link) {
        (topic as Record<string, unknown>).link =
          "https://eu.finalfantasyxiv.com" +
          (topic as Record<string, unknown>).link;
      }
    }

    const resArray = [];
    for (const topicKey in parsed.Topics) {
      const topic = parsed.Topics[topicKey];
      if (topic) resArray.push(topic);
    }

    parsed.Topics = resArray as unknown as Record<string, unknown>;

    const withMarkdown = markdownConverter.addMarkdownFields(parsed);
    newsCache.set(cacheKey, withMarkdown);

    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    log.error(`Topics fetch error: ${error.message}`);
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/notices", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const notices = await noticesParser.parse(context);
    const noticesFiltered = Object.fromEntries(
      Object.entries(notices).filter(([_, v]) => v !== null),
    );

    const parsed = {
      Notices: {
        ...noticesFiltered,
      },
    } as Record<string, unknown>;

    for (const key in (parsed.Notices as Record<string, unknown>)) {
      const notice =
        (parsed.Notices as Record<string, Record<string, unknown>>)[key];
      if (notice?.link) {
        notice.link = "https://eu.finalfantasyxiv.com" + notice.link;
      }
    }

    const resArray = [];
    for (const noticeKey in (parsed.Notices as Record<string, unknown>)) {
      const notice = (parsed.Notices as Record<string, unknown>)[noticeKey];
      if (notice) resArray.push(notice);
    }

    parsed.Notices = resArray;

    const detailsPromises = (parsed.Notices as Array<Record<string, unknown>>)
      .map((notice) =>
        noticesDetailsParser.parse(context, "", notice.link as string)
      );
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.Notices as Array<Record<string, unknown>>).forEach(
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
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/maintenances", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const maintenances = await maintenanceParser.parse(context);
    const parsed = {
      Maintenances: {
        ...maintenances,
      },
    } as Record<string, unknown>;

    for (
      const key
        in (parsed.Maintenances as Record<string, Record<string, unknown>>)
    ) {
      const maintenance =
        (parsed.Maintenances as Record<string, Record<string, unknown>>)[key];
      if (maintenance?.link) {
        maintenance.link = "https://eu.finalfantasyxiv.com" + maintenance.link;
      }
    }

    const resArray = [];
    for (
      const maintenanceKey in (parsed.Maintenances as Record<string, unknown>)
    ) {
      const maintenance =
        (parsed.Maintenances as Record<string, unknown>)[maintenanceKey];
      if (maintenance) resArray.push(maintenance);
    }

    parsed.Maintenances = resArray;

    const detailsPromises =
      (parsed.Maintenances as Array<Record<string, unknown>>).map((
        maintenance,
      ) =>
        maintenanceDetailsParser.parse(
          context,
          "",
          (maintenance as Record<string, unknown>)?.link as string,
        )
      );
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.Maintenances as Array<Record<string, unknown>>).forEach(
      (maintenance, index: number) => {
        if (maintenance) {
          Object.assign(maintenance, detailsResults[index]);
        }
      },
    );

    const withMarkdown = markdownConverter.addMarkdownFields(parsed);
    return context.json(withMarkdown);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "404") {
      return context.json({ error: "Not found" }, 404);
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/updates", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const updates = await updatesParser.parse(context);
    const updatesFiltered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== null),
    );

    const parsed = {
      Updates: {
        ...updatesFiltered,
      },
    } as Record<string, unknown>;

    for (
      const key in (parsed.Updates as Record<string, Record<string, unknown>>)
    ) {
      const update =
        (parsed.Updates as Record<string, Record<string, unknown>>)[key];
      if (update?.link) {
        update.link = "https://eu.finalfantasyxiv.com" + update.link;
      }
    }

    const resArray: unknown[] = [];
    for (const updateKey in (parsed.Updates as Record<string, unknown>)) {
      const update = (parsed.Updates as Record<string, unknown>)[updateKey];
      if (update) resArray.push(update);
    }

    parsed.Updates = resArray;

    const detailsPromises = (parsed.Updates as Array<Record<string, unknown>>)
      .map((update) =>
        updatesDetailsParser.parse(context, "", update.link as string)
      );
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.Updates as Array<Record<string, unknown>>).forEach(
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
    } else return context.json({ error: error.message }, 500);
  }
});

app.get("/lodestone/statuses", async (context: Context) => {
  context.header("Cache-Control", "max-age=0");

  try {
    const status = await statusParser.parse(context);
    const statusFiltered = Object.fromEntries(
      Object.entries(status).filter(([_, v]) => v !== null),
    );

    const parsed = {
      Status: {
        ...statusFiltered,
      },
    } as Record<string, unknown>;

    for (
      const key in (parsed.Status as Record<string, Record<string, unknown>>)
    ) {
      const statusItem =
        (parsed.Status as Record<string, Record<string, unknown>>)[key];
      if (statusItem?.link) {
        statusItem.link = "https://eu.finalfantasyxiv.com" + statusItem.link;
      }
    }

    const resArray: unknown[] = [];
    for (const statusKey in (parsed.Status as Record<string, unknown>)) {
      const statusItem = (parsed.Status as Record<string, unknown>)[statusKey];
      if (statusItem) resArray.push(statusItem);
    }

    parsed.Status = resArray;

    const detailsPromises = (parsed.Status as Array<Record<string, unknown>>)
      .map((statusItem) =>
        statusDetailsParser.parse(context, "", statusItem.link as string)
      );
    const detailsResults = await Promise.all(detailsPromises);

    (parsed.Status as Array<Record<string, unknown>>).forEach(
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
