/**
 * LocalStorage setsStore v1 → v2 マイグレーション
 *
 * v1: ShoppingSet に listId なし
 * v2: ShoppingSet に listId: string を追加
 *
 * 設計方針:
 * - migrate コールバックは Zustand persist のリハイドレート時に同期で呼ばれる。
 *   その時点では listsStore が未初期化の場合があるため（循環依存・モジュールロード順序問題）、
 *   ここでは listsStore へアクセスせず listId: "" を埋めるだけにする。
 * - listId: "" のセットは、setsStore の repairMissingListIds アクションで後から補正する。
 *   補正タイミングは SyncProvider 内で listsStore リハイドレート後。
 */

import { SETS_BACKUP_V1_KEY, type ShoppingSet } from "../types";

const SETS_MIGRATION_IN_PROGRESS_KEY = `${SETS_BACKUP_V1_KEY}:in-progress`;

type V1Set = {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
  updatedAt: string;
};

type SetsStateV1 = {
  sets: V1Set[];
};

type SetsState = {
  sets: ShoppingSet[];
};

/**
 * v1 形式かどうかの型ガード。
 * - object でかつ sets 配列を持つ
 * - sets[0] に listId フィールドがない（あれば既に v2 化済み）
 * - 空配列の場合は v1 として扱う（マイグレーションを冪等に通すため）
 */
export function isV1(s: unknown): s is SetsStateV1 {
  if (!s || typeof s !== "object") return false;
  const obj = s as { sets?: unknown };
  if (!Array.isArray(obj.sets)) return false;
  if (obj.sets.length === 0) return true;
  const first = obj.sets[0] as { listId?: unknown };
  return typeof first.listId !== "string";
}

/**
 * v1 → v2 マイグレーション本体。
 * listId: "" を埋めるだけにし、listsStore へはアクセスしない。
 * 後から setsStore.repairMissingListIds(unclassifiedId) で補正する。
 */
export function migrateSetsV1ToV2(persistedState: unknown): SetsState {
  if (!isV1(persistedState)) {
    // 既に v2 以降 or 不正形式 → そのまま返す
    return persistedState as SetsState;
  }

  // 1. v1 全データをバックアップ
  try {
    if (!localStorage.getItem(SETS_BACKUP_V1_KEY)) {
      localStorage.setItem(SETS_BACKUP_V1_KEY, JSON.stringify(persistedState));
    }
    localStorage.setItem(SETS_MIGRATION_IN_PROGRESS_KEY, "1");
  } catch {
    // QuotaExceeded 等はバックアップ失敗を許容してマイグレーション続行
  }

  // 2. listId: "" を付与（未分類 ID は後から repairMissingListIds で補正）
  const v2Sets: ShoppingSet[] = persistedState.sets.map((s) => ({
    ...s,
    listId: "",
  }));

  // 3. 完了フラグ削除（後補正は SyncProvider 側が担うため、ここでは削除のみ）
  try {
    localStorage.removeItem(SETS_MIGRATION_IN_PROGRESS_KEY);
  } catch {
    // 無視
  }

  return { sets: v2Sets };
}
