import type { Context } from "hono";
import { Document, DOMParser, Element } from "deno-dom";
import { lodestoneQueue, RequestPriority } from "../../core/LodestoneRequestQueue.ts";

const domParser = new DOMParser();

interface RaidClear {
  cleared: boolean;
  date: number | null;
  week: number | null;
}

interface UltimateProgression {
  ucob: RaidClear;
  uwu: RaidClear;
  tea: RaidClear;
  dsr: RaidClear;
  top: RaidClear;
  fru: RaidClear;
  ultimate_count: number;
}

interface SavageProgression {
  arr: {
    the_binding_coil_of_bahamut: RaidClear;
    the_second_coil_of_bahamut: RaidClear;
    the_final_coil_of_bahamut: RaidClear;
  };
  hw: {
    alexander_gordias: RaidClear;
    alexander_midas: RaidClear;
    alexander: RaidClear;
  };
  sb: {
    omega_deltascape: RaidClear;
    omega_sigmascape: RaidClear;
    omega_alphascape: RaidClear;
  };
  shb: {
    edens_gate: RaidClear;
    edens_verse: RaidClear;
    edens_promise: RaidClear;
  };
  ew: {
    pandaemonium_asphodelos: RaidClear;
    pandaemonium_abyssos: RaidClear;
    pandaemonium_anabaseios: RaidClear;
  };
  dt: {
    aac_light_heavyweight_tier: RaidClear;
    aac_cruiserweight_tier: RaidClear;
    aac_heavyweight_tier: RaidClear;
  };
}

export interface RaidProgressionResult {
  ultimates: UltimateProgression;
  savage: SavageProgression;
}

const ULTIMATE_ACHIEVEMENTS: Record<
  string,
  { key: keyof Omit<UltimateProgression, "ultimate_count">; release_date: string }
> = {
  "Resistance Is Futile": { key: "ucob", release_date: "October 23, 2017" },
  "Ultimatum": { key: "uwu", release_date: "June 5, 2018" },
  "When I Ruled the World": { key: "tea", release_date: "November 11, 2019" },
  "As Suits a Hero": { key: "dsr", release_date: "April 25, 2022" },
  "Heart to Heartless": { key: "top", release_date: "January 23, 2023" },
  "Alternative Destiny": { key: "fru", release_date: "November 26, 2024" },
};

const RELEASE_DATE_CACHE = new Map<string, number>();

function parseReleaseDate(releaseDateStr: string): number {
  const cached = RELEASE_DATE_CACHE.get(releaseDateStr);
  if (cached !== undefined) return cached;

  const cleanStr = releaseDateStr.replace(/,\s*$/, "").trim();
  const timestamp = new Date(cleanStr + " UTC").getTime();
  RELEASE_DATE_CACHE.set(releaseDateStr, timestamp);
  return timestamp;
}

function getTuesdayOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysFromTuesday = (day + 5) % 7;
  return timestamp - daysFromTuesday * 86400000;
}

function calculateClearWeek(clearTimestamp: number, releaseDateStr: string): number {
  const releaseTimestamp = parseReleaseDate(releaseDateStr);
  const releaseTuesday = getTuesdayOfWeek(releaseTimestamp);
  const clearTuesday = getTuesdayOfWeek(clearTimestamp);
  const weeksDiff = Math.floor((clearTuesday - releaseTuesday) / (7 * 86400000));
  return weeksDiff + 1;
}

const SAVAGE_ACHIEVEMENTS: Record<string, { expansion: keyof SavageProgression; raid: string; release_date: string }> =
  {
    "The Binds That Tie I": { expansion: "arr", raid: "the_binding_coil_of_bahamut", release_date: "August 27, 2013" },
    "In Another Bind I": { expansion: "arr", raid: "the_second_coil_of_bahamut", release_date: "March 27, 2014" },
    "Out of a Bind I": { expansion: "arr", raid: "the_final_coil_of_bahamut", release_date: "October 28, 2014" },
    "Sins of the Savage Father I": { expansion: "hw", raid: "alexander_gordias", release_date: "July 21, 2015" },
    "Sins of the Savage Son I": { expansion: "hw", raid: "alexander_midas", release_date: "February 23, 2016" },
    "Sins of the Savage Creator I": { expansion: "hw", raid: "alexander", release_date: "September 27, 2016" },
    "I Am the Savage Delta, I Am the Savage Omega I": {
      expansion: "sb",
      raid: "omega_deltascape",
      release_date: "July 18, 2017",
    },
    "I Am the Savage Sigma, I Am the Savage Omega I": {
      expansion: "sb",
      raid: "omega_sigmascape",
      release_date: "January 30, 2018",
    },
    "I Am the Savage Alpha, I Am the Savage Omega I": {
      expansion: "sb",
      raid: "omega_alphascape",
      release_date: "September 18, 2018",
    },
    "Savage Paradise Found I": { expansion: "shb", raid: "edens_gate", release_date: "July 30, 2019" },
    "Savage Trouble in Paradise I": { expansion: "shb", raid: "edens_verse", release_date: "February 18, 2020" },
    "Paradise Within Thee I": { expansion: "shb", raid: "edens_promise", release_date: "December 8, 2020" },
    "Could Be Savage I": { expansion: "ew", raid: "pandaemonium_asphodelos", release_date: "January 4, 2022" },
    "Savage Gaze of the Abyss I": { expansion: "ew", raid: "pandaemonium_abyssos", release_date: "August 30, 2022" },
    "Apotheosis Agria I": { expansion: "ew", raid: "pandaemonium_anabaseios", release_date: "May 30, 2023" },
    "Savage Someone Your Own Size I": {
      expansion: "dt",
      raid: "aac_light_heavyweight_tier",
      release_date: "July 30, 2024",
    },
    "Cruising at the Savage Apex I": {
      expansion: "dt",
      raid: "aac_cruiserweight_tier",
      release_date: "April 1, 2025, ",
    },
    "On Top of the Savage World I": { expansion: "dt", raid: "aac_heavyweight_tier", release_date: "January 6, 2026" },
  };

export class RaidProgression {
  public async parse(ctx: Context, priority: number = RequestPriority.NORMAL): Promise<RaidProgressionResult | null> {
    const characterId = ctx.req.param("characterId");
    const url = `https://eu.finalfantasyxiv.com/lodestone/character/${characterId}/achievement/category/4/`;

    const response = await lodestoneQueue.fetchWithTimeout(url, {}, priority);
    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        return null;
      }
      throw new Error(response.status.toString());
    }

    const data = await response.text();
    const dom = domParser.parseFromString(data, "text/html");
    if (!dom) {
      return null;
    }

    const achievementMap = this.parseAchievements(dom as unknown as Document);
    return this.buildResult(achievementMap);
  }

  private parseAchievements(document: Document): Map<string, { cleared: boolean; date: number | null }> {
    const achievementMap = new Map<string, { cleared: boolean; date: number | null }>();
    const entries: Element[] = [];
    document.querySelectorAll("li.entry").forEach((e) => entries.push(e as Element));

    entries.forEach((entry) => {
      const element = entry;
      const nameElement = element.querySelector("p.entry__activity__txt");
      if (!nameElement) return;

      const name = nameElement.textContent?.trim();
      if (!name) return;

      const isAchieved = element.getAttribute("data-achieved") === "1";
      let timestamp: number | null = null;

      if (isAchieved) {
        const scriptTags = element.querySelectorAll("script");
        scriptTags.forEach((script) => {
          const scriptContent = (script as Element).textContent || "";
          const match = scriptContent.match(/ldst_strftime\((\d+),/);
          if (match) {
            timestamp = parseInt(match[1], 10) * 1000;
          }
        });
      }

      achievementMap.set(name, { cleared: isAchieved, date: timestamp });
    });

    return achievementMap;
  }

  private buildResult(achievementMap: Map<string, { cleared: boolean; date: number | null }>): RaidProgressionResult {
    const createEmptyClear = (): RaidClear => ({ cleared: false, date: null, week: null });

    const ultimates: UltimateProgression = {
      ucob: createEmptyClear(),
      uwu: createEmptyClear(),
      tea: createEmptyClear(),
      dsr: createEmptyClear(),
      top: createEmptyClear(),
      fru: createEmptyClear(),
      ultimate_count: 0,
    };

    const savage: SavageProgression = {
      arr: {
        the_binding_coil_of_bahamut: createEmptyClear(),
        the_second_coil_of_bahamut: createEmptyClear(),
        the_final_coil_of_bahamut: createEmptyClear(),
      },
      hw: {
        alexander_gordias: createEmptyClear(),
        alexander_midas: createEmptyClear(),
        alexander: createEmptyClear(),
      },
      sb: {
        omega_deltascape: createEmptyClear(),
        omega_sigmascape: createEmptyClear(),
        omega_alphascape: createEmptyClear(),
      },
      shb: {
        edens_gate: createEmptyClear(),
        edens_verse: createEmptyClear(),
        edens_promise: createEmptyClear(),
      },
      ew: {
        pandaemonium_asphodelos: createEmptyClear(),
        pandaemonium_abyssos: createEmptyClear(),
        pandaemonium_anabaseios: createEmptyClear(),
      },
      dt: {
        aac_light_heavyweight_tier: createEmptyClear(),
        aac_cruiserweight_tier: createEmptyClear(),
        aac_heavyweight_tier: createEmptyClear(),
      },
    };

    for (const [achievementName, { key: raidKey, release_date }] of Object.entries(ULTIMATE_ACHIEVEMENTS)) {
      const achievement = achievementMap.get(achievementName);
      if (achievement) {
        const week = achievement.cleared && achievement.date
          ? calculateClearWeek(achievement.date, release_date)
          : null;
        ultimates[raidKey] = {
          cleared: achievement.cleared,
          date: achievement.date,
          week,
        };
        if (achievement.cleared) {
          ultimates.ultimate_count++;
        }
      }
    }

    for (const [achievementName, { expansion, raid, release_date }] of Object.entries(SAVAGE_ACHIEVEMENTS)) {
      const achievement = achievementMap.get(achievementName);
      if (achievement) {
        const week = achievement.cleared && achievement.date
          ? calculateClearWeek(achievement.date, release_date)
          : null;
        const expansionData = savage[expansion] as Record<string, RaidClear>;
        expansionData[raid] = {
          cleared: achievement.cleared,
          date: achievement.date,
          week,
        };
      }
    }

    return { ultimates, savage };
  }
}
