import { Request } from 'express'
import { PageParser } from '../core/lodestone-parser'
import * as maintenanceDetails from '../lib/lodestone-css-selectors/lodestone/maintenance_details.json'
import { CssSelectorRegistry } from '../core/css-selector-registry'

export class MaintenanceDetails extends PageParser {
  protected getURL(req: Request): string {
    return 'https://eu.finalfantasyxiv.com/lodestone/'
  }

  protected getCSSSelectors(): CssSelectorRegistry {
    return { ...maintenanceDetails }
  }
}
