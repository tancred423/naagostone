export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Naagostone – FFXIV Lodestone API",
    description:
      "Self-hosted REST API for FFXIV's Lodestone. Scrapes character data, news, maintenance schedules, and world status, returning structured JSON with Discord-ready markdown.",
    version: "1.0.0",
    license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
  },
  servers: [{ url: "/" }],
  paths: {
    "/characters": {
      get: {
        tags: ["Characters"],
        summary: "Search characters",
        description:
          "Search for FFXIV characters by first name, last name, and world. All three query parameters are required. Returns matching characters from the Lodestone.",
        parameters: [
          {
            name: "firstname",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Character first name",
            example: "Luna",
          },
          {
            name: "lastname",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Character last name",
            example: "Tancredi",
          },
          {
            name: "world",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "World name",
            example: "Phoenix",
          },
        ],
        responses: {
          "200": {
            description: "List of matching characters",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CharacterSearchResult" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "503": {
            description: "Lodestone unavailable",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/characters/{characterId}": {
      get: {
        tags: ["Characters"],
        summary: "Get character profile",
        description:
          "Full character profile including gear, jobs, Free Company tag, raid progression, and calculated average item level.",
        parameters: [
          {
            name: "characterId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "Lodestone character ID",
            example: 24979564,
          },
        ],
        responses: {
          "200": { description: "Character profile", content: { "application/json": { schema: { type: "object" } } } },
          "400": {
            description: "Invalid character ID",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "Character not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "503": {
            description: "Lodestone unavailable",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/worlds": {
      get: {
        tags: ["Worlds"],
        summary: "Get all worlds and data centers",
        description:
          "Returns every FFXIV world name and logical data center, both as flat sorted arrays and grouped by data center.",
        responses: {
          "200": {
            description: "Worlds and data centers",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Worlds" },
                example: {
                  allWorlds: ["Adamantoise", "Aegis", "Alexander"],
                  allDatacenters: ["Aether", "Chaos", "Crystal"],
                  grouped: { Chaos: ["Cerberus", "Louisoix", "Moogle", "Omega"] },
                },
              },
            },
          },
        },
      },
    },
    "/worldstatus": {
      get: {
        tags: ["Worlds"],
        summary: "Get live world status",
        description:
          "Live status of every FFXIV world grouped by physical and logical data center. Includes online/offline status, category (Standard, Preferred, Congested), and whether new characters can be created.",
        responses: {
          "200": { description: "World status", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/news/topics": {
      get: {
        tags: ["News"],
        summary: "Get topics",
        description:
          "Lodestone topics including live shows, campaigns, and events. Each entry includes HTML, Discord-ready markdown, and Discord Components v2 payload. Topics may include event timeframe data and Live Letter timestamps.",
        responses: {
          "200": {
            description: "Topics list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/NewsResponse" } } },
          },
        },
      },
    },
    "/news/notices": {
      get: {
        tags: ["News"],
        summary: "Get notices",
        description:
          "Official Lodestone notices (up to 10 newest). Includes full detail text with HTML, markdown, and Discord Components v2.",
        responses: {
          "200": {
            description: "Notices list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/NewsResponse" } } },
          },
        },
      },
    },
    "/news/maintenances": {
      get: {
        tags: ["News"],
        summary: "Get maintenances",
        description:
          "Current and upcoming maintenance windows. Entries tagged `[Maintenance]` include parsed `start_timestamp` and `end_timestamp` (milliseconds).",
        responses: {
          "200": {
            description: "Maintenances list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/NewsResponse" } } },
          },
        },
      },
    },
    "/news/updates": {
      get: {
        tags: ["News"],
        summary: "Get updates",
        description: "Patch notes and game updates with full detail text.",
        responses: {
          "200": {
            description: "Updates list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/NewsResponse" } } },
          },
        },
      },
    },
    "/news/statuses": {
      get: {
        tags: ["News"],
        summary: "Get statuses",
        description: "Service status reports with full detail text.",
        responses: {
          "200": {
            description: "Statuses list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/NewsResponse" } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      CharacterSearchResult: {
        type: "object",
        properties: {
          list: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer" },
                name: { type: "string" },
                world: { type: "string" },
                avatar: { type: "string" },
              },
            },
          },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              page_total: { type: "integer" },
              page_next: { type: "integer", nullable: true },
              page_prev: { type: "integer", nullable: true },
            },
          },
        },
      },
      Worlds: {
        type: "object",
        properties: {
          allWorlds: { type: "array", items: { type: "string" } },
          allDatacenters: { type: "array", items: { type: "string" } },
          grouped: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
        },
        required: ["allWorlds", "allDatacenters", "grouped"],
      },
      NewsDescription: {
        type: "object",
        properties: {
          html: { type: "string" },
          markdown: { type: "string" },
          discord_components_v2: { type: "object" },
        },
      },
      NewsItem: {
        type: "object",
        properties: {
          title: { type: "string" },
          link: { type: "string", format: "uri" },
          date: { type: "integer", description: "Unix timestamp in milliseconds" },
          banner: { type: "string", format: "uri", nullable: true },
          description: { $ref: "#/components/schemas/NewsDescription" },
        },
      },
      NewsResponse: {
        type: "object",
        additionalProperties: {
          type: "array",
          items: { $ref: "#/components/schemas/NewsItem" },
        },
      },
    },
  },
};

export function swaggerHtml(specUrl: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Naagostone API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
      });
    </script>
  </body>
  </html>`;
}
