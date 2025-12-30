import type { Context } from "hono";
import { PageParser } from "../../core/PageParser.ts";
import character from "../../../lib/lodestone-css-selectors/profile/character.json" with {
  type: "json",
};
import attributes from "../../../lib/lodestone-css-selectors/profile/attributes.json" with {
  type: "json",
};
import classjob from "../../../lib/lodestone-css-selectors/profile/classjob.json" with {
  type: "json",
};
import gearset from "../../../lib/lodestone-css-selectors/profile/gearset.json" with {
  type: "json",
};
import type { CssSelectorRegistry } from "../../interface/CssSelectorRegistry.ts";
import { RequestPriority } from "../../core/LodestoneRequestQueue.ts";

const GEAR_SLOTS = [
  "mainhand",
  "offhand",
  "head",
  "body",
  "hands",
  "legs",
  "feet",
  "earrings",
  "necklace",
  "bracelets",
  "ring1",
  "ring2",
];

export class Character extends PageParser {
  protected getURL(ctx: Context): string {
    return (
      "https://eu.finalfantasyxiv.com/lodestone/character/" +
      ctx.req.param("characterId")
    );
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return { ...character, ...attributes, ...classjob, ...gearset };
  }

  public override async parse(
    ctx: Context,
    columnsPrefix = "",
    priority: number = RequestPriority.NORMAL,
  ): Promise<object> {
    const result = (await super.parse(ctx, columnsPrefix, priority)) as Record<
      string,
      unknown
    >;
    return this.processMateria(result);
  }

  private processMateria(result: Record<string, unknown>): Record<string, unknown> {
    for (const gearSlot of GEAR_SLOTS) {
      const gear = result[gearSlot] as Record<string, unknown> | null | undefined;
      if (!gear || typeof gear !== "object") {
        continue;
      }
      if (!gear["name"]) {
        result[gearSlot] = null;
        continue;
      }
      const materiaSlots = gear["materia_slots"] as unknown[] | null | undefined;
      const slotCount = Array.isArray(materiaSlots) ? materiaSlots.length : 0;
      for (let i = 1; i <= 5; i++) {
        const materiaKey = `materia_${i}`;
        const materiaStatsKey = `materia_${i}_stats`;
        const existingMateria = gear[materiaKey];
        if (i <= slotCount) {
          if (!existingMateria) {
            gear[materiaKey] = "empty";
            gear[materiaStatsKey] = "empty";
          }
        } else {
          gear[materiaKey] = null;
          gear[materiaStatsKey] = null;
        }
      }
      delete gear["materia_slots"];
    }
    return result;
  }
}
