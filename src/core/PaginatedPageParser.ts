import { PageParser } from "./PageParser.ts";
import { RequestPriority } from "./LodestoneRequestQueue.ts";
import type { Context } from "hono";

export abstract class PaginatedPageParser extends PageParser {
  protected abstract getBaseURL(ctx: Context): string;

  protected getURL(ctx: Context): string {
    let query = "";
    const page = ctx.req.query("page");
    if (page) {
      query = `?page=${page}`;
    }
    return `${this.getBaseURL(ctx)}${query}`;
  }

  override async parse(
    ctx: Context,
    columnsPrefix: string = "",
    priority: number = RequestPriority.NORMAL,
  ): Promise<object> {
    let baseParse = await super.parse(ctx, columnsPrefix, priority) as Record<
      string,
      unknown
    >;
    baseParse = baseParse.entry as Record<string, unknown>;

    try {
      const queryName = ctx.req.query("name")?.toString().toLowerCase();
      if (queryName) {
        baseParse.list = (baseParse.list as Array<Record<string, unknown>>)
          .filter((parses) => {
            const parseName = (parses.name as string)?.toLowerCase();
            return parseName === queryName;
          });
      }

      const queryWorld = ctx.req.query("worldname")?.toString().toLowerCase();
      if (queryWorld) {
        baseParse.list = (baseParse.list as Array<Record<string, unknown>>)
          .filter((parses) => {
            const parseWorld = (parses.world as string)?.toLowerCase();
            return parseWorld === queryWorld;
          });
      }
    } catch (err) {
      console.log(err);
    }

    delete baseParse.list_next_button;
    const currentPage = baseParse.current_page as number;
    const numPages = baseParse.num_pages as number;
    baseParse.pagination = {
      page: +currentPage,
      page_total: +numPages,
      page_next: +currentPage < +numPages ? +currentPage + 1 : null,
      page_prev: +currentPage < 1 ? null : +currentPage - 1,
    };
    delete baseParse.current_page;
    delete baseParse.num_pages;
    return baseParse;
  }
}
