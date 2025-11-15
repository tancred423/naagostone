import type { Context } from "hono";
import type { CssSelectorDefinition } from "../interface/CssSelectorDefinition.ts";
import type { CssSelectorRegistry } from "../interface/CssSelectorRegistry.ts";
import * as RegexTranslator from "regex-translator";
import { Document, DOMParser, Element } from "deno-dom";
import { StringFormatter } from "./StringFormatter.ts";
import { HttpClient } from "./HttpClient.ts";

const domParser = new DOMParser();

export abstract class LodestoneParser {
  protected abstract getURL(ctx: Context): string;

  protected abstract getCSSSelectors(): CssSelectorRegistry;

  public async parse(
    ctx: Context,
    columnsPrefix: string = "",
    customUrl: string | undefined = undefined,
  ): Promise<object> {
    const url = customUrl ? customUrl : this.getURL(ctx);

    const response = await HttpClient.fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(response.status.toString());
    }
    const data = await response.text();
    const dom = domParser.parseFromString(data, "text/html");
    let document = dom as unknown as Document;

    const columnsQuery = ctx.req.query("columns");
    const selectors = this.getCSSSelectors();
    let columns: string[];
    if (columnsQuery && !Array.isArray(columnsQuery)) {
      columns = columnsQuery
        .toString()
        .split(",")
        .filter((column) => {
          return column.startsWith(columnsPrefix);
        })
        .map((column) => column.replace(columnsPrefix, ""));
    } else if (columnsQuery && Array.isArray(columnsQuery)) {
      columns = columnsQuery
        .map((c) => c.toString())
        .filter((column) => {
          return column.startsWith(columnsPrefix);
        })
        .map((column) => column.replace(columnsPrefix, ""));
    } else {
      columns = Object.keys(selectors)
        .map((key) => {
          return this.definitionNameToColumnName(key);
        })
        .filter((column) => column !== "default");
    }
    return columns.reduce((acc, column) => {
      const definition = this.getDefinition(selectors, column);
      if (column === "Root") {
        const context = this.handleColumn(definition, document)?.data;
        const contextDOM = domParser.parseFromString(
          context as string,
          "text/html",
        );
        document = contextDOM as unknown as Document;
        return {
          ...acc,
        };
      }

      const parsed = this.handleColumn(definition, document);
      if (parsed.isPatch || column === "Entry") {
        return {
          ...acc,
          ...(parsed.data || {}),
        };
      }
      return {
        ...acc,
        [column]: parsed.data,
      };
    }, {});
  }

  private handleColumn(
    definition: CssSelectorRegistry | CssSelectorDefinition | null,
    document: Document,
  ): { isPatch: boolean; data: unknown } {
    if (definition === null) {
      return { isPatch: false, data: null };
    }
    if (this.isDefinition(definition)) {
      if (definition.multiple) {
        const elements: Element[] = [];
        document
          .querySelectorAll(definition.selector as string)
          .forEach((e) => elements.push(e as Element));
        return {
          isPatch: false,
          data: elements.map((element) => this.handleElement(element, definition)),
        };
      }
      const element = document.querySelector(definition.selector as string);
      const data = this.handleElement(element as Element, definition);
      return {
        isPatch: typeof data === "object",
        data,
      };
    }
    if (definition["ROOT"]) {
      return {
        isPatch: false,
        data: this.handleDefinitionWithRoot(definition, document),
      };
    }
    return {
      isPatch: false,
      data: Object.keys(definition).reduce<Record<string, unknown> | null>(
        (acc, key) => {
          const parsed = this.handleColumn(
            this.getDefinition(definition, key),
            document,
          );
          if (parsed.data) {
            if (parsed.isPatch) {
              return {
                ...(acc || {}),
                ...(parsed.data || {}),
              };
            }
            return {
              ...(acc || {}),
              [this.definitionNameToColumnName(key)]: parsed.data,
            };
          }
          return acc;
        },
        null,
      ),
    };
  }

  private getDefinition(
    selectors: CssSelectorRegistry,
    name: string,
  ): CssSelectorDefinition | CssSelectorRegistry | null {
    if (selectors[name.toUpperCase()]) {
      return selectors[name.toUpperCase()];
    }
    if (selectors[StringFormatter.snakeCase(name).toUpperCase()]) {
      return selectors[StringFormatter.snakeCase(name).toUpperCase()];
    }
    return null;
  }

  private handleElement(
    element: Element,
    definition: CssSelectorDefinition,
  ): string | number | Record<string, string | number> | null {
    if (!element) {
      return null;
    }
    let res: string;
    if (definition.attribute) {
      res = element.getAttribute(definition.attribute) || "";
    } else {
      res = element.innerHTML || "";
    }
    if (definition.regex) {
      const mediary = RegexTranslator.getMediaryObjectFromRegexString(
        definition.regex,
      );
      const regex = RegexTranslator.getRegexStringFromMediaryObject(
        mediary,
        "ecma",
      )
        .replace(/\(\?P/gm, "(?")
        .replace(/\\f\\n\\r\\t\\v/gm, "\\s\\f\\n\\r\\t\\v&nbsp;");
      const match = new RegExp(regex).exec(res);
      if (match) {
        return (
          Object.entries<string>(match.groups as Record<string, string>).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [StringFormatter.snakeCase(key)]: value !== undefined ? (isNaN(+value) ? value : +value) : null,
            }),
            {},
          ) || null
        );
      }
      return null;
    }
    return (isNaN(+res) ? res : +res) || null;
  }

  private isDefinition(
    definition: CssSelectorDefinition | CssSelectorRegistry,
  ): definition is CssSelectorDefinition {
    return definition.selector !== undefined;
  }

  private definitionNameToColumnName(key: string): string {
    return key.toLocaleLowerCase();
  }

  private handleDefinitionWithRoot(
    definition: CssSelectorRegistry,
    document: Document,
  ): unknown {
    const { ROOT, ...definitions } = definition;
    const mainList = this.handleColumn(ROOT, document)?.data;
    if (!mainList) {
      return null;
    }
    return {
      list: (mainList as unknown as string[])
        .map((element: string) => {
          const miniDOM = domParser.parseFromString(element, "text/html");
          return this.handleColumn(definitions, miniDOM as unknown as Document)
            ?.data;
        })
        .filter((row: unknown) => !!row),
    };
  }
}
