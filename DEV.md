# Development

Deno 2 + TypeScript project using [Hono](https://hono.dev/) for HTTP routing.

## Setup

Create and fill `.env` if needed. I recommend log level `DEBUG` for development.

```bash
cp .env.skel .env
```

Start the app.

```
./dev.sh up:build
```

`dev.sh` commands:

| Command    | Description                                                        |
| ---------- | ------------------------------------------------------------------ |
| `up`       | Start container                                                    |
| `up:build` | Start container and rebuild image                                  |
| `down`     | Stop container                                                     |
| `purge`    | Stop container and remove volumes (deletes data!)                  |
| `rebuild`  | Rebuild container                                                  |
| `restart`  | Restart container                                                  |
| `logs`     | Tail app logs                                                      |
| `check`    | Runs `deno fmt`, `deno lint` and `deno check` inside the container |

## Project Structure

```
src/
├── server.ts                    Hono server & route definitions
├── core/
│   ├── HtmlToMarkdownConverter  HTML → Markdown + Discord Components v2
│   ├── HttpClient               Fetch wrapper for Lodestone requests
│   ├── LodestoneParser          Base parser that loads CSS selectors
│   ├── LodestoneRequestQueue    Request queue with concurrency control
│   ├── PageParser               Single-page parser
│   ├── PaginatedPageParser      Multi-page parser (news lists)
│   └── StringFormatter          Text normalisation helpers
├── documentation/
│   ├── DocumentationBuilder     Returns API json documentation for root routes
│   ├── openapi.ts               Generates openApi specs (viewable under `/docs`)
├── interface/
│   ├── CssSelectorDefinition    Types for CSS selector JSON files
│   └── CssSelectorRegistry      Loads selectors from lib/
├── middleware/
│   ├── InputValidator            Route param validation
│   └── RateLimiter               Per-IP rate limiting
└── parser/                      One parser per Lodestone page type
```

## CSS Selectors

Lodestone pages are scraped with CSS selectors defined in `lib/lodestone-css-selectors/`. The selector JSON files are
based on [xivapi/lodestone-css-selectors](https://github.com/xivapi/lodestone-css-selectors) with custom edits.

All selectors target non-browser DOM (parsed with deno-dom WASM). They may break in browsers that inject extra DOM
elements.

### Character Profile

Selector files live in `lib/lodestone-css-selectors/profile/`.

| File                | Lodestone endpoint | Notes                                                    |
| ------------------- | ------------------ | -------------------------------------------------------- |
| `character.json`    | Main profile page  | Basic character data                                     |
| `attributes.json`   | Main profile page  | Stats / attributes                                       |
| `gearset.json`      | Main profile page  | Equipped gear                                            |
| `classjob.json`     | `/class_job`       | Class & job levels                                       |
| `minion.json`       | `/minion`          | Requires mobile UA                                       |
| `mount.json`        | `/mount`           | Requires mobile UA                                       |
| `achievements.json` | `/achievement`     | Paginated — follow next link until `javascript:void(0);` |

Mounts and minions **must** be fetched with a mobile user agent. With a desktop UA the names are loaded via AJAX and
require separate requests per item.

### News / Lodestone

Selector files live in `lib/lodestone-css-selectors/lodestone/`.

Covers topics, notices, maintenances, updates, and status pages — both list views and detail pages.

### Free Company, Linkshell, PvP Team

Selector files in their respective directories under `lib/lodestone-css-selectors/`.

## CI / CD

On push to `main`, the GitHub Actions workflow:

1. Checks formatting (`deno fmt --check`), linting (`deno lint`), and types (`deno check`)
2. Builds and pushes a Docker image to GHCR
3. SSHs into the production server, pulls the new image, and restarts with `docker compose`

# Contributing

1. If you want to contribute, please open an [issue](https://github.com/tancred423/naagostone/issues) if you haven't yet
   and discuss your ideas first.
2. Then you can create a branch and pull request from there.

# Self Hosting

Requires Docker and Docker Compose v2 to be installed on the server.

1. Create a new dir on your server for this app.
2. Add `docker-compose.yml` and `.env` (if needed) to this directory.
3. Run `docker compose up -d`
