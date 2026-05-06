import type {
  ShoppingItem,
  ShoppingList,
  ShoppingSet,
} from "@/features/shopping/types";
import type {
  ListsSyncPushResponse,
  SetsSyncPushResponse,
  ShoppingItemDTO,
  ShoppingListDTO,
  ShoppingSetDTO,
  SyncPushResponse,
} from "@/types/sync";

/**
 * サーバーからの差分をローカル状態にマージする純粋関数。
 *
 * - LWW: `updatedAt` 文字列を辞書順比較で評価（ISO 8601 UTC）
 * - クロックずれ補正は発行時のみ適用、比較時には適用しない（受信値をそのまま使う）
 *
 * @returns 反映後の items 配列 + 上書き発生件数（事後トースト用）
 */
export function reconcile(params: {
  local: ShoppingItem[];
  serverChanges: ShoppingItemDTO[];
  serverDeletes: string[];
  rejected: SyncPushResponse["rejected"];
}): { next: ShoppingItem[]; overwrittenCount: number } {
  const { local, serverChanges, serverDeletes, rejected } = params;

  const map = new Map<string, ShoppingItem>(local.map((i) => [i.id, i]));

  // 1. サーバーからの差分を LWW で適用
  for (const s of serverChanges) {
    const l = map.get(s.id);
    if (!l || l.updatedAt < s.updatedAt) {
      map.set(s.id, s as ShoppingItem);
    }
  }

  // 2. PUT で reject された分（サーバー側が新しかった）を採用
  let overwrittenCount = 0;
  for (const r of rejected) {
    map.set(r.id, r.serverItem as ShoppingItem);
    overwrittenCount++;
  }

  // 3. サーバー側の削除を反映
  for (const id of serverDeletes) map.delete(id);

  return { next: Array.from(map.values()), overwrittenCount };
}

/**
 * Phase 10.1b: ShoppingSet 用 reconcile。
 * 構造は items と同じ（LWW + rejected 採用 + serverDeletes 反映）。
 */
export function reconcileSets(params: {
  local: ShoppingSet[];
  serverChanges: ShoppingSetDTO[];
  serverDeletes: string[];
  rejected: SetsSyncPushResponse["rejected"];
}): { next: ShoppingSet[]; overwrittenCount: number } {
  const { local, serverChanges, serverDeletes, rejected } = params;

  const map = new Map<string, ShoppingSet>(local.map((s) => [s.id, s]));

  for (const s of serverChanges) {
    const l = map.get(s.id);
    if (!l || l.updatedAt < s.updatedAt) {
      // サーバーから受信したデータは常に listId を持つことをアサート
      // listId が未定義の場合はローカルの既存値か空文字で補完（旧クライアント互換）
      const withListId: ShoppingSet = {
        ...s,
        listId: s.listId ?? l?.listId ?? "",
      };
      map.set(s.id, withListId);
    }
  }

  let overwrittenCount = 0;
  for (const r of rejected) {
    const withListId: ShoppingSet = {
      ...r.serverSet,
      listId: r.serverSet.listId ?? map.get(r.id)?.listId ?? "",
    };
    map.set(r.id, withListId);
    overwrittenCount++;
  }

  for (const id of serverDeletes) map.delete(id);

  return { next: Array.from(map.values()), overwrittenCount };
}

/**
 * Phase 10.2: ShoppingList 用 reconcile。
 * SYSTEM_PROTECTED でサーバーが拒否した場合は serverList を採用 (overwrittenCount に算入)。
 */
export function reconcileLists(params: {
  local: ShoppingList[];
  serverChanges: ShoppingListDTO[];
  serverDeletes: string[];
  rejected: ListsSyncPushResponse["rejected"];
}): { next: ShoppingList[]; overwrittenCount: number } {
  const { local, serverChanges, serverDeletes, rejected } = params;

  const map = new Map<string, ShoppingList>(local.map((l) => [l.id, l]));

  for (const s of serverChanges) {
    const l = map.get(s.id);
    if (!l || l.updatedAt < s.updatedAt) {
      map.set(s.id, s);
    }
  }

  let overwrittenCount = 0;
  for (const r of rejected) {
    if (r.serverList) {
      map.set(r.id, r.serverList);
      overwrittenCount++;
    }
  }

  for (const id of serverDeletes) map.delete(id);

  return { next: Array.from(map.values()), overwrittenCount };
}
