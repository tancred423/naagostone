import { PageParser } from './page-parser'
import { Request } from 'express'

export abstract class PaginatedPageParser extends PageParser {
  protected abstract getBaseURL(req: Request): string

  protected getURL(req: Request): string {
    let query = ''
    if (req.query && req.query.page) {
      query = `?page=${req.query?.page}`
    }
    return `${this.getBaseURL(req)}${query}`
  }

  async parse(req: Request, columnsPrefix: string = ''): Promise<Object> {
    let baseParse: any = await super.parse(req, columnsPrefix)
    baseParse = baseParse.entry

    try {
      baseParse.List = baseParse.List.filter((parses: any) => {
        const parseName = parses.name?.toLowerCase()
        const queryName = req.query.name?.toString().toLowerCase()
        return parseName === queryName
      })

      baseParse.List = baseParse.List.filter((parses: any) => {
        const parseWorld = parses.World?.toLowerCase()
        const queryWorld = req.query.worldname?.toString().toLowerCase()
        return parseWorld === queryWorld
      })
    } catch (err) {
      console.log(err)
    }

    delete baseParse.ListNextButton
    baseParse.Pagination = {
      Page: +baseParse.CurrentPage,
      PageTotal: +baseParse.NumPages,
      PageNext:
        +baseParse.CurrentPage < +baseParse.NumPages
          ? +baseParse.CurrentPage + 1
          : null,
      PagePrev: +baseParse.CurrentPage < 1 ? null : +baseParse.CurrentPage - 1
    }
    delete baseParse.CurrentPage
    delete baseParse.NumPages
    return baseParse
  }
}
