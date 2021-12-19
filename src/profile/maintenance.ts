import { Request } from 'express'
import { PageParser } from '../core/maintenance-parser'
import * as maintenance from '../lib/lodestone-css-selectors/lodestone/maintenance.json'
import { CssSelectorRegistry } from '../core/css-selector-registry'

export class Maintenance extends PageParser {
  protected getURL(req: Request): string {
    return 'https://eu.finalfantasyxiv.com/lodestone/'
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return { ...maintenance }
  }
}
