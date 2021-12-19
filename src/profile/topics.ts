import { Request } from 'express'
import { PageParser } from '../core/lodestone-parser'
import * as topics from '../lib/lodestone-css-selectors/lodestone/topics.json'
import { CssSelectorRegistry } from '../core/css-selector-registry'

export class Topics extends PageParser {
  protected getURL(req: Request): string {
    return 'https://eu.finalfantasyxiv.com/lodestone/'
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return { ...topics }
  }
}
