import type { Context } from "hono";
import { LodestoneParser } from "../../core/LodestoneParser.ts";
import freecompany from "../../../lib/lodestone-css-selectors/freecompany/freecompany.json" with {
  type: "json",
};
import type { CssSelectorRegistry } from "../../interface/CssSelectorRegistry.ts";

export class FreeCompany extends LodestoneParser {
  protected getURL(ctx: Context): string {
    const freeCompanyId = ctx.req.param("freeCompanyId");
    return `https://eu.finalfantasyxiv.com/lodestone/freecompany/${freeCompanyId}/`;
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return { ...freecompany };
  }
}
