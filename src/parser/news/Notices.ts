import type { Context } from "hono";
import { LodestoneParser } from "../../core/LodestoneParser.ts";
import notices from "../../../lib/lodestone-css-selectors/lodestone/notices.json" with {
  type: "json",
};
import type { CssSelectorRegistry } from "../../interface/CssSelectorRegistry.ts";

export class Notices extends LodestoneParser {
  protected getURL(_ctx: Context): string {
    return "https://eu.finalfantasyxiv.com/lodestone/news/category/1";
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return { ...notices };
  }
}
