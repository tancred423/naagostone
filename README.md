# Naagostone

A self-hosted REST API for [FFXIV's Lodestone](https://eu.finalfantasyxiv.com/lodestone/) — look up characters, search
players, track maintenance windows, and get Lodestone news in structured JSON with Discord-ready markdown.

## What can it do?

| Endpoint                                           | What you get                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/`                                                | API overview and documentation                                                  |
| `/characters`                                      | Characters endpoint overview and documentation                                  |
| `/characters?firstname=...&lastname=...&world=...` | Search for characters by name and world                                         |
| `/characters/:id`                                  | Full character profile — gear, jobs, Free Company, raid progression, item level |
| `/worlds`                                          | All FFXIV worlds and data centers                                               |
| `/worldstatus`                                     | Live world/data center status                                                   |
| `/news/topics`                                     | Lodestone topics (live shows, campaigns, events)                                |
| `/news/notices`                                    | Secondary news                                                                  |
| `/news/maintenances`                               | Maintenance schedules with start/end timestamps                                 |
| `/news/updates`                                    | Patch & game updates                                                            |
| `/news/statuses`                                   | Service status reports                                                          |

Every news endpoint returns the original HTML, a cleaned-up markdown version and Discord Components v2 payload — ready
to forward straight into a Discord webhook or bot.

## Development, Contributing and Self Hosting

Instructions can be found in the [DEV.md](DEV.md)

## License

[MIT](LICENSE)
