import { type FetchOptions, HttpClient } from "./HttpClient.ts";
import * as log from "@std/log";

interface QueuedRequest {
  url: string;
  options: FetchOptions;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  queuedAt: number;
}

export class LodestoneRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly delayBetweenRequests: number;
  private lastRequestTime = 0;

  constructor(delayBetweenRequests: number = 200) {
    this.delayBetweenRequests = delayBetweenRequests;
  }

  fetchWithTimeout(
    url: string,
    options: FetchOptions = {},
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        url,
        options,
        resolve,
        reject,
        queuedAt: Date.now(),
      });

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
      if (!request) {
        break;
      }

      const queueWaitTime = Date.now() - request.queuedAt;

      // Ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      let throttleDelay = 0;
      if (timeSinceLastRequest < this.delayBetweenRequests) {
        throttleDelay = this.delayBetweenRequests - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, throttleDelay));
      }

      const totalDelay = queueWaitTime + throttleDelay;
      if (totalDelay > 0) {
        log.debug(
          `Lodestone request queue delay: ${totalDelay}ms (queued: ${queueWaitTime}ms, throttled: ${throttleDelay}ms) for ${request.url}`,
        );
      }

      try {
        const response = await HttpClient.fetchWithTimeout(
          request.url,
          request.options,
        );

        // If we get a 429, wait longer before retrying
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.delayBetweenRequests * 5;

          log.warn(`Lodestone rate limited (429) for ${request.url}, waiting ${waitTime}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          // Retry the request (preserve original queue time for accurate delay tracking)
          this.queue.unshift(request);
          this.lastRequestTime = Date.now();
          continue;
        }

        this.lastRequestTime = Date.now();
        request.resolve(response);
      } catch (error) {
        this.lastRequestTime = Date.now();
        request.reject(error as Error);
      }
    }

    this.processing = false;
  }
}

// Singleton instance for all Lodestone requests
export const lodestoneQueue = new LodestoneRequestQueue(200);
