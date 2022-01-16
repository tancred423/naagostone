import { PaginatedPageParser } from '../core/paginated-page-parser'
import { CssSelectorRegistry } from '../core/css-selector-registry'
import * as characterSearch from '../lib/lodestone-css-selectors/search/character.json'
import { Request } from 'express'

export class CharacterSearch extends PaginatedPageParser {
  protected getBaseURL(req: Request): string {
    let query = `?q=${req.query.name?.toString()?.replace(' ', '+')}`
    if (req.query.dc) {
      query += `&worldname=_dc_${req.query.dc}`
    } else if (req.query.worldname) {
      query += `&worldname=${this.formatWorldname(
        req.query.worldname.toString()
      )}`
    }
    return `https://na.finalfantasyxiv.com/lodestone/character/${query}`
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return characterSearch
  }

  private formatWorldname(worldname: string) {
    return (
      worldname.substring(0, 1).toUpperCase() +
      worldname.substring(1).toLowerCase()
    )
  }
}
