import type {
  ApiResponse,
  ListsSyncMergeRequest,
  ListsSyncMergeResponse,
  ListsSyncPullResponse,
  ListsSyncPushRequest,
  ListsSyncPushResponse,
  SetsSyncMergeRequest,
  SetsSyncMergeResponse,
  SetsSyncPullResponse,
  SetsSyncPushRequest,
  SetsSyncPushResponse,
  SyncMergeRequest,
  SyncMergeResponse,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from "@/types/sync";

const MAX_RETRY = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function fetchWithRetry<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal });
      const json = (await res.json().catch(() => null)) as
        | ApiResponse<T>
        | null;

      if (res.ok && json?.success === true) {
        return json.data;
      }

      const code =
        json && json.success === false ? json.error.code : "UNKNOWN";
      const message =
        json && json.success === false
          ? json.error.message
          : `HTTP ${res.status}`;

      // 401 はリトライしない（呼び出し側で signOut へ）
      if (res.status === 401) throw new HttpError(401, code, message);
      // 4xx はクライアント側の問題なのでリトライしない
      if (res.status >= 400 && res.status < 500) {
        throw new HttpError(res.status, code, message);
      }
      throw new HttpError(res.status, code, message);
    } catch (e) {
      lastError = e;
      // 401 や 4xx は即時 throw
      if (e instanceof HttpError && e.status < 500) throw e;
      // AbortError は即時 throw
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      // 残りリトライがある場合は待機
      if (attempt < MAX_RETRY - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BACKOFF_MS[attempt]),
        );
      }
    }
  }
  throw lastError;
}

export const syncClient = {
  async pull(
    args: { since: string | null },
    signal?: AbortSignal,
  ): Promise<SyncPullResponse> {
    const url = args.since
      ? `/api/sync/items?since=${encodeURIComponent(args.since)}`
      : `/api/sync/items`;
    return fetchWithRetry<SyncPullResponse>(url, { method: "GET" }, signal);
  },

  async push(
    body: SyncPushRequest,
    signal?: AbortSignal,
  ): Promise<SyncPushResponse> {
    return fetchWithRetry<SyncPushResponse>(
      "/api/sync/items",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },

  async mergeOnLogin(
    body: SyncMergeRequest,
    signal?: AbortSignal,
  ): Promise<SyncMergeResponse> {
    return fetchWithRetry<SyncMergeResponse>(
      "/api/sync/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },

  // ---------- Phase 10.1b: ShoppingSet 同期 ----------

  async pullSets(
    args: { since: string | null },
    signal?: AbortSignal,
  ): Promise<SetsSyncPullResponse> {
    const url = args.since
      ? `/api/sync/sets?since=${encodeURIComponent(args.since)}`
      : `/api/sync/sets`;
    return fetchWithRetry<SetsSyncPullResponse>(url, { method: "GET" }, signal);
  },

  async pushSets(
    body: SetsSyncPushRequest,
    signal?: AbortSignal,
  ): Promise<SetsSyncPushResponse> {
    return fetchWithRetry<SetsSyncPushResponse>(
      "/api/sync/sets",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },

  async mergeSetsOnLogin(
    body: SetsSyncMergeRequest,
    signal?: AbortSignal,
  ): Promise<SetsSyncMergeResponse> {
    return fetchWithRetry<SetsSyncMergeResponse>(
      "/api/sync/sets/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },

  // ---------- Phase 10.2: ShoppingList 同期 ----------

  async pullLists(
    args: { since: string | null },
    signal?: AbortSignal,
  ): Promise<ListsSyncPullResponse> {
    const url = args.since
      ? `/api/sync/lists?since=${encodeURIComponent(args.since)}`
      : `/api/sync/lists`;
    return fetchWithRetry<ListsSyncPullResponse>(
      url,
      { method: "GET" },
      signal,
    );
  },

  async pushLists(
    body: ListsSyncPushRequest,
    signal?: AbortSignal,
  ): Promise<ListsSyncPushResponse> {
    return fetchWithRetry<ListsSyncPushResponse>(
      "/api/sync/lists",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },

  async mergeListsOnLogin(
    body: ListsSyncMergeRequest,
    signal?: AbortSignal,
  ): Promise<ListsSyncMergeResponse> {
    return fetchWithRetry<ListsSyncMergeResponse>(
      "/api/sync/lists/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },
};

export { HttpError };
