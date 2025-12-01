import { type FetchOptions, HttpClient } from "./HttpClient.ts";
import * as log from "@std/log";

interface QueuedRequest {
  url: string;
  options: FetchOptions;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  priority: number;
}

interface CachedResponse {
  body: string;
  status: number;
  headers: Headers;
  cachedAt: number;
}

type CacheType = "news" | "maintenance" | "updates" | "status";

export enum RequestPriority {
  HIGH = 1, // Character search, character by ID - user-facing, needs fast response
  NORMAL = 5, // Default priority
  LOW = 10, // News endpoints - less critical, can wait
}

export class LodestoneRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly delayBetweenRequests: number;
  private lastRequestTime = 0;
  private readonly caches: Map<CacheType, Map<string, CachedResponse>>;
  private readonly maxCacheSizePerType: number;

  constructor(
    delayBetweenRequests: number = 200,
    maxCacheSizePerType: number = 10,
  ) {
    this.delayBetweenRequests = delayBetweenRequests;
    this.maxCacheSizePerType = maxCacheSizePerType;
    this.caches = new Map([
      ["news", new Map()],
      ["maintenance", new Map()],
      ["updates", new Map()],
      ["status", new Map()],
    ]);
  }

  private getCacheType(url: string): CacheType | null {
    if (url.includes("/news/detail/")) return "news";
    if (url.includes("/maintenance/detail/")) return "maintenance";
    if (url.includes("/updates/detail/")) return "updates";
    if (url.includes("/status/detail/")) return "status";
    return null;
  }

  fetchWithTimeout(
    url: string,
    options: FetchOptions = {},
    priority: number = RequestPriority.NORMAL,
  ): Promise<Response> {
    const cacheType = this.getCacheType(url);
    if (cacheType) {
      const cache = this.caches.get(cacheType)!;
      const cached = cache.get(url);
      if (cached) {
        log.debug(`Cache hit for ${cacheType}: ${url}`);
        return Promise.resolve(
          new Response(cached.body, {
            status: cached.status,
            headers: cached.headers,
          }),
        );
      }
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        url,
        options,
        resolve,
        reject,
        queuedAt: Date.now(),
        priority,
      };

      const insertIndex = this.queue.findIndex((req) => req.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      const queueWaitTime = Date.now() - request.queuedAt;

      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      let throttleDelay = 0;
      if (timeSinceLastRequest < this.delayBetweenRequests) {
        throttleDelay = this.delayBetweenRequests - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, throttleDelay));
      }

      const totalDelay = queueWaitTime + throttleDelay;
      log.debug(
        `Request queue delay: ${totalDelay}ms (queued: ${queueWaitTime}ms, throttled: ${throttleDelay}ms) for ${request.url}`,
      );

      try {
        const response = await HttpClient.fetchWithTimeout(request.url, request.options);

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.delayBetweenRequests * 5;

          log.warn(`Rate limited (429) for ${request.url}, waiting ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          const insertIndex = this.queue.findIndex((req) => req.priority > request.priority);
          if (insertIndex === -1) {
            this.queue.push(request);
          } else {
            this.queue.splice(insertIndex, 0, request);
          }
          this.lastRequestTime = Date.now();
          continue;
        }

        this.lastRequestTime = Date.now();

        const cacheType = this.getCacheType(request.url);
        if (response.ok && cacheType) {
          const body = await response.text();
          this.addToCache(cacheType, request.url, {
            body,
            status: response.status,
            headers: new Headers(response.headers),
            cachedAt: Date.now(),
          });

          request.resolve(
            new Response(body, {
              status: response.status,
              headers: response.headers,
            }),
          );
        } else {
          request.resolve(response);
        }
      } catch (error) {
        this.lastRequestTime = Date.now();
        request.reject(error as Error);
      }
    }

    this.processing = false;
  }

  private addToCache(cacheType: CacheType, url: string, entry: CachedResponse): void {
    const cache = this.caches.get(cacheType)!;

    if (cache.size >= this.maxCacheSizePerType) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, value] of cache) {
        if (value.cachedAt < oldestTime) {
          oldestTime = value.cachedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        cache.delete(oldestKey);
        log.debug(`Cache evicted oldest ${cacheType} entry: ${oldestKey}`);
      }
    }

    cache.set(url, entry);
    log.debug(`Cached ${cacheType}: ${url} (${cacheType} cache size: ${cache.size})`);
  }

  clearCache(cacheType?: CacheType): void {
    if (cacheType) {
      this.caches.get(cacheType)?.clear();
      log.debug(`${cacheType} cache cleared`);
    } else {
      for (const cache of this.caches.values()) {
        cache.clear();
      }
      log.debug("All caches cleared");
    }
  }

  getCacheStats(): Record<CacheType, { size: number; entries: string[] }> {
    const stats: Record<string, { size: number; entries: string[] }> = {};
    for (const [type, cache] of this.caches) {
      stats[type] = {
        size: cache.size,
        entries: Array.from(cache.keys()),
      };
    }
    return stats as Record<CacheType, { size: number; entries: string[] }>;
  }
}

export const lodestoneQueue = new LodestoneRequestQueue(200, 10);
