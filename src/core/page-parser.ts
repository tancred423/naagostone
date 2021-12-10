import { Request } from 'express'
import {
  CssSelectorDefinition,
  CssSelectorRegistry
} from './css-selector-registry'
// @ts-ignore
import * as RegexTranslator from 'regex-translator'
import { parseHTML } from 'linkedom'
import { snakeCase } from 'lodash'

const axios = require('axios').default

export abstract class PageParser {
  protected abstract getURL(req: Request): string

  protected abstract getCSSSelectors(): CssSelectorRegistry

  public async parse(req: Request, columnsPrefix = ''): Promise<Object> {
    // Get profile document
    const { data } = await axios.get(this.getURL(req)).catch((err: any) => {
      throw new Error(err.response.status)
    })
    const dom = parseHTML(data)
    let { document } = dom.window

    // Get classJob document
    const classJobDataAll = await axios
      .get(`${this.getURL(req)}/class_job`)
      .catch((err: any) => {
        throw new Error(err.response.status)
      })
    const classJobData = classJobDataAll.data
    const classJobDom = parseHTML(classJobData)
    let classJobDocument = classJobDom.window.document

    // Get achievements document
    const achievementsDataAll = await axios
      .get(`${this.getURL(req)}/achievement/?order=2`)
      .catch((err: any) => {
        throw new Error(err.response.status)
      })
    const achievementsData = achievementsDataAll.data
    const achievementsDom = parseHTML(achievementsData)
    let achievementsDocument = achievementsDom.window.document

    // Get mounts document
    const mountsDataAll = await axios
      .get(`${this.getURL(req)}/mount`)
      .catch((err: any) => {
        throw new Error(err.response.status)
      })
    const mountsData = mountsDataAll.data
    const mountsDom = parseHTML(mountsData)
    let mountsDocument = mountsDom.window.document

    // Get minions document
    const minionsDataAll = await axios
      .get(`${this.getURL(req)}/minion`)
      .catch((err: any) => {
        throw new Error(err.response.status)
      })
    const minionsData = minionsDataAll.data
    const minionsDom = parseHTML(minionsData)
    let minionsDocument = minionsDom.window.document

    // Columns
    const columnsQuery = req.query && req.query['columns']
    const selectors = this.getCSSSelectors()
    let columns: string[]
    if (columnsQuery && !Array.isArray(columnsQuery)) {
      columns = columnsQuery
        .toString()
        .split(',')
        .filter((column) => {
          return column.startsWith(columnsPrefix)
        })
        .map((column) => column.replace(columnsPrefix, ''))
    } else if (columnsQuery && Array.isArray(columnsQuery)) {
      columns = columnsQuery
        .map((c) => c.toString())
        .filter((column) => {
          return column.startsWith(columnsPrefix)
        })
        .map((column) => column.replace(columnsPrefix, ''))
    } else {
      columns = Object.keys(selectors)
        .map((key) => {
          return this.definitionNameToColumnName(key)
        })
        .filter((column) => column !== 'default')
    }
    return columns.reduce((acc, column) => {
      const definition = this.getDefinition(selectors, column)
      if (column === 'Root') {
        const context = this.handleColumn(definition, document)?.data
        const contextDOM = parseHTML(context)
        document = contextDOM.window.document
        return {
          ...acc
        }
      }

      let correctDocument = document
      if (
        [
          'bozja',
          'eureka',
          'paladin',
          'warrior',
          'darkknight',
          'gunbreaker',
          'monk',
          'dragoon',
          'ninja',
          'samurai',
          'whitemage',
          'scholar',
          'astrologian',
          'bard',
          'machinist',
          'dancer',
          'blackmage',
          'summoner',
          'redmage',
          'bluemage',
          'carpenter',
          'blacksmith',
          'armorer',
          'goldsmith',
          'leatherworker',
          'weaver',
          'alchemist',
          'culinarian',
          'miner',
          'botanist',
          'fisher',
          'sage',
          'reaper'
        ].includes(column)
      ) {
        correctDocument = classJobDocument
      } else if (['started', 'ap', 'amount_achievements'].includes(column)) {
        correctDocument = achievementsDocument
      } else if (column === 'amount_mounts') {
        correctDocument = mountsDocument
      } else if (column === 'amount_minions') {
        correctDocument = minionsDocument
      } else correctDocument = document

      const parsed = this.handleColumn(definition, correctDocument)
      if (parsed.isPatch || column === 'Entry') {
        return {
          ...acc,
          ...(parsed.data || {})
        }
      }
      return {
        ...acc,
        [column]: parsed.data
      }
    }, {})
  }

  private handleColumn(
    definition: CssSelectorRegistry | CssSelectorDefinition | null,
    document: Document
  ): { isPatch: boolean; data: any } {
    if (definition === null) {
      return { isPatch: false, data: null }
    }
    if (this.isDefinition(definition)) {
      if (definition.multiple) {
        const elements: Element[] = []
        document
          .querySelectorAll(definition.selector as any)
          .forEach((e) => elements.push(e))
        return {
          isPatch: false,
          data: elements.map((element) =>
            this.handleElement(element, definition)
          )
        }
      }
      const element = document.querySelector(definition.selector as any)
      const data = this.handleElement(element, definition)
      return {
        isPatch: typeof data === 'object',
        data
      }
    }
    if (definition['ROOT']) {
      return {
        isPatch: false,
        data: this.handleDefinitionWithRoot(definition, document)
      }
    }
    return {
      isPatch: false,
      data: Object.keys(definition).reduce((acc, key) => {
        const parsed = this.handleColumn(
          this.getDefinition(definition, key),
          document
        )
        if (parsed.data) {
          if (parsed.isPatch) {
            return {
              ...(acc || {}),
              ...(parsed.data || {})
            }
          }
          return {
            ...(acc || {}),
            [this.definitionNameToColumnName(key)]: parsed.data
          }
        }
        return acc
      }, null)
    }
  }

  private getDefinition(
    selectors: CssSelectorRegistry,
    name: string
  ): CssSelectorDefinition | CssSelectorRegistry | null {
    if (selectors[name.toUpperCase()]) {
      return selectors[name.toUpperCase()]
    }
    if (selectors[snakeCase(name).toUpperCase()]) {
      return selectors[snakeCase(name).toUpperCase()]
    }
    return null
  }

  private handleElement(
    element: Element,
    definition: CssSelectorDefinition
  ): string | number | Record<string, string | number> | null {
    if (!element) {
      return null
    }
    let res: string
    if (definition.attribute) {
      res = element.attributes.getNamedItem(definition.attribute)?.value || ''
    } else {
      res = element.innerHTML || ''
    }
    if (definition.regex) {
      const mediary = RegexTranslator.getMediaryObjectFromRegexString(
        definition.regex
      )
      const regex = RegexTranslator.getRegexStringFromMediaryObject(
        mediary,
        'ecma'
      )
        .replace(/\(\?P/gm, '(?')
        .replace(/\\f\\n\\r\\t\\v/gm, '\\s\\f\\n\\r\\t\\v&nbsp;')
      const match = new RegExp(regex).exec(res)
      if (match) {
        return (
          Object.entries<any>(match.groups as Record<string, any>).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: isNaN(value) ? value : +value
            }),
            {}
          ) || null
        )
      }
      return null
    }
    return (isNaN(+res) ? res : +res) || null
  }

  private isDefinition(
    definition: CssSelectorDefinition | CssSelectorRegistry
  ): definition is CssSelectorDefinition {
    return definition.selector !== undefined
  }

  private definitionNameToColumnName(key: string): string {
    // return key.split('_')
    //     .map(str => `${str.slice(0, 1)}${str.slice(1).toLowerCase()}`)
    //     .join('')
    //     .replace(/Id/gmi, 'ID')
    return key.toLocaleLowerCase()
  }

  private handleDefinitionWithRoot(
    definition: CssSelectorRegistry,
    document: Document
  ): any {
    const { ROOT, ...definitions } = definition
    const mainList = this.handleColumn(ROOT, document)?.data
    if (!mainList) {
      return null
    }
    return {
      List: mainList
        .map((element: string) => {
          const miniDOM = parseHTML(element)
          const miniDocument = miniDOM.window.document
          return this.handleColumn(definitions, miniDocument)?.data
        })
        .filter((row: any | null) => !!row)
    }
  }
}
