import type { Context } from "hono";
import { Document, DOMParser, Element } from "deno-dom";
import { lodestoneQueue, RequestPriority } from "../../core/LodestoneRequestQueue.ts";

const domParser = new DOMParser();

interface RaidClear {
  cleared: boolean;
  date: number | null;
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

const ULTIMATE_ACHIEVEMENTS: Record<string, keyof Omit<UltimateProgression, "ultimate_count">> = {
  "Resistance Is Futile": "ucob",
  "Ultimatum": "uwu",
  "When I Ruled the World": "tea",
  "As Suits a Hero": "dsr",
  "Heart to Heartless": "top",
  "Alternative Destiny": "fru",
};

const SAVAGE_ACHIEVEMENTS: Record<string, { expansion: keyof SavageProgression; raid: string }> = {
  "The Binds That Tie I": { expansion: "arr", raid: "the_binding_coil_of_bahamut" },
  "In Another Bind I": { expansion: "arr", raid: "the_second_coil_of_bahamut" },
  "Out of a Bind I": { expansion: "arr", raid: "the_final_coil_of_bahamut" },
  "Sins of the Savage Father I": { expansion: "hw", raid: "alexander_gordias" },
  "Sins of the Savage Son I": { expansion: "hw", raid: "alexander_midas" },
  "Sins of the Savage Creator I": { expansion: "hw", raid: "alexander" },
  "I Am the Savage Delta, I Am the Savage Omega I": { expansion: "sb", raid: "omega_deltascape" },
  "I Am the Savage Sigma, I Am the Savage Omega I": { expansion: "sb", raid: "omega_sigmascape" },
  "I Am the Savage Alpha, I Am the Savage Omega I": { expansion: "sb", raid: "omega_alphascape" },
  "Savage Paradise Found I": { expansion: "shb", raid: "edens_gate" },
  "Savage Trouble in Paradise I": { expansion: "shb", raid: "edens_verse" },
  "Paradise Within Thee I": { expansion: "shb", raid: "edens_promise" },
  "Could Be Savage I": { expansion: "ew", raid: "pandaemonium_asphodelos" },
  "Savage Gaze of the Abyss I": { expansion: "ew", raid: "pandaemonium_abyssos" },
  "Apotheosis Agria I": { expansion: "ew", raid: "pandaemonium_anabaseios" },
  "Savage Someone Your Own Size I": { expansion: "dt", raid: "aac_light_heavyweight_tier" },
  "Cruising at the Savage Apex I": { expansion: "dt", raid: "aac_cruiserweight_tier" },
  "On Top of the Savage World I": { expansion: "dt", raid: "aac_heavyweight_tier" },
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
    const createEmptyClear = (): RaidClear => ({ cleared: false, date: null });

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

    for (const [achievementName, raidKey] of Object.entries(ULTIMATE_ACHIEVEMENTS)) {
      const achievement = achievementMap.get(achievementName);
      if (achievement) {
        ultimates[raidKey] = {
          cleared: achievement.cleared,
          date: achievement.date,
        };
        if (achievement.cleared) {
          ultimates.ultimate_count++;
        }
      }
    }

    for (const [achievementName, { expansion, raid }] of Object.entries(SAVAGE_ACHIEVEMENTS)) {
      const achievement = achievementMap.get(achievementName);
      if (achievement) {
        const expansionData = savage[expansion] as Record<string, RaidClear>;
        expansionData[raid] = {
          cleared: achievement.cleared,
          date: achievement.date,
        };
      }
    }

    return { ultimates, savage };
  }
}
