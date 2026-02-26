import { PaginatedPageParser } from "../../core/PaginatedPageParser.ts";
import type { CssSelectorRegistry } from "../../interface/CssSelectorRegistry.ts";
import characterSearch from "../../../lib/lodestone-css-selectors/search/character.json" with {
  type: "json",
};
import type { Context } from "hono";

export class CharacterSearch extends PaginatedPageParser {
  protected getBaseURL(ctx: Context): string {
    const firstname = ctx.req.query("firstname");
    const lastname = ctx.req.query("lastname");
    const world = ctx.req.query("world");
    const name = `${firstname} ${lastname}`;
    let query = `?q=${name.replace(" ", "+")}`;

    if (world) {
      query += `&worldname=${this.formatWorldname(world)}`;
    }
    return `https://eu.finalfantasyxiv.com/lodestone/character/${query}`;
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return characterSearch;
  }

  private formatWorldname(worldname: string) {
    return (
      worldname.substring(0, 1).toUpperCase() +
      worldname.substring(1).toLowerCase()
    );
  }
}
