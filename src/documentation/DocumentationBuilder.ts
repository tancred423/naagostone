export class DocumentationBuilder {
  static buildCharactersDocumentation(): object {
    return {
      search: {
        method: "GET",
        path: "/characters",
        example: "/characters?firstname=luna&lastname=tancredi&world=phoenix",
        description: "Search for characters by first name, last name, and world",
        queryParams: {
          firstname: "Character first name (required)",
          lastname: "Character last name (required)",
          world: "World name (required)",
        },
      },
      profile: {
        method: "GET",
        path: "/characters/:characterId",
        example: "/characters/24979564",
        description: "Get character profile by ID",
      },
    };
  }

  static buildWorldsDocumentation(): object {
    return {
      method: "GET",
      path: "/worlds",
      description: "Get all FFXIV worlds and data centers",
    };
  }

  static buildWorldStatusDocumentation(): object {
    return {
      method: "GET",
      path: "/worldstatus",
      description: "Get world status for all data centers",
    };
  }

  static buildNewsDocumentation(): object {
    return {
      topics: {
        method: "GET",
        path: "/news/topics",
        description: "Get topics with details. Possible event types: 'Special Event' | 'Moogle Treasure Trove'",
      },
      notices: {
        method: "GET",
        path: "/news/notices",
        description: "Get notices with details",
      },
      maintenances: {
        method: "GET",
        path: "/news/maintenances",
        description: "Get maintenances with details",
      },
      updates: {
        method: "GET",
        path: "/news/updates",
        description: "Get updates with details",
      },
      statuses: {
        method: "GET",
        path: "/news/statuses",
        description: "Get statuses with details",
      },
    };
  }
}
