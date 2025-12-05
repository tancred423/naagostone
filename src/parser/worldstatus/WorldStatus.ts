import type { Context } from "hono";
import { Document, DOMParser, Element } from "deno-dom";
import { lodestoneQueue, RequestPriority } from "../../core/LodestoneRequestQueue.ts";

const domParser = new DOMParser();

interface World {
  world: string;
  status: string;
  category: string;
  canCreateNewCharacter: boolean;
}

interface LogicalDataCenter {
  logicalDataCenter: string;
  worlds: World[];
}

interface PhysicalDataCenter {
  physicalDataCenter: string;
  logicalDataCenters: LogicalDataCenter[];
}

export class WorldStatus {
  private readonly url = "https://eu.finalfantasyxiv.com/lodestone/worldstatus/";
  private readonly physicalDCNames = ["Europe", "Oceania", "North America", "Japan"];

  public async parse(_ctx: Context): Promise<{ worldStatus: PhysicalDataCenter[] }> {
    const response = await lodestoneQueue.fetchWithTimeout(this.url, {}, RequestPriority.LOW);
    if (!response.ok) {
      throw new Error(response.status.toString());
    }
    const data = await response.text();
    const dom = domParser.parseFromString(data, "text/html");
    const document = dom as unknown as Document;

    const worldStatus = this.parseWorldStatus(document);
    return { worldStatus };
  }

  private parseWorldStatus(document: Document): PhysicalDataCenter[] {
    const result: PhysicalDataCenter[] = [];
    const dcGroups = document.querySelectorAll(".world-dcgroup");

    let physDCIndex = 0;
    dcGroups.forEach((dcGroup) => {
      const physicalDCName = this.physicalDCNames[physDCIndex] || `Unknown-${physDCIndex}`;
      const logicalDataCenters = this.parseLogicalDataCenters(dcGroup as Element);

      result.push({
        physicalDataCenter: physicalDCName,
        logicalDataCenters,
      });

      physDCIndex++;
    });

    return result;
  }

  private parseLogicalDataCenters(dcGroup: Element): LogicalDataCenter[] {
    const logicalDCs: LogicalDataCenter[] = [];
    const dcItems = dcGroup.querySelectorAll(".world-dcgroup__item");

    dcItems.forEach((dcItem) => {
      const header = (dcItem as Element).querySelector(".world-dcgroup__header");
      const logicalDCName = header?.textContent?.trim() || "Unknown";
      const worlds = this.parseWorlds(dcItem as Element);

      logicalDCs.push({
        logicalDataCenter: logicalDCName,
        worlds,
      });
    });

    return logicalDCs;
  }

  private parseWorlds(dcItem: Element): World[] {
    const worlds: World[] = [];
    const worldItems = dcItem.querySelectorAll(".world-list__item");

    worldItems.forEach((worldItem) => {
      const worldElement = worldItem as Element;

      const worldName = worldElement.querySelector(".world-list__world_name p")?.textContent?.trim() || "Unknown";
      const category = worldElement.querySelector(".world-list__world_category p")?.textContent?.trim() || "Unknown";
      const statusIcon = worldElement.querySelector(".world-list__status_icon i");
      const status = statusIcon?.getAttribute("data-tooltip")?.trim() || "Unknown";
      const createCharIcon = worldElement.querySelector(".world-list__create_character i");
      const createCharClass = createCharIcon?.getAttribute("class") || "";
      const canCreateNewCharacter = createCharClass.includes("world-ic__available") &&
        !createCharClass.includes("world-ic__unavailable");

      worlds.push({
        world: worldName,
        status,
        category,
        canCreateNewCharacter,
      });
    });

    return worlds;
  }
}
