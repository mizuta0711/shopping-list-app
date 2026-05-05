import type { ShoppingItem } from "@/features/shopping/types";
import type { ShoppingItemDTO, SyncPushResponse } from "@/types/sync";

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
