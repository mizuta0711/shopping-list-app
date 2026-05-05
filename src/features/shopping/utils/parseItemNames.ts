import { SET_ITEMS_MAX_COUNT, SET_ITEM_NAME_MAX_LENGTH } from "../types";

export type ParseItemNamesResult = {
  items: string[];
  /** 上限 (SET_ITEMS_MAX_COUNT) を超える入力があり打ち切られた場合 true */
  truncated: boolean;
};

export const parseItemNames = (text: string): ParseItemNamesResult => {
  const seen = new Set<string>();
  const items: string[] = [];
  let truncated = false;
  for (const raw of text.split(/[\n、。]/)) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (items.length >= SET_ITEMS_MAX_COUNT) {
      truncated = true;
      break;
    }
    items.push(t.slice(0, SET_ITEM_NAME_MAX_LENGTH));
  }
  return { items, truncated };
};
