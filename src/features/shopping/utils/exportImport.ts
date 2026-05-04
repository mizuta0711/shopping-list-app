import { STORAGE_KEY, STORAGE_VERSION, type ShoppingItem } from "../types";

export const exportStateToJson = (): boolean => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shopping-list-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

const REQUIRED_ITEM_FIELDS: (keyof ShoppingItem)[] = [
  "id",
  "name",
  "scope",
  "status",
  "order",
  "createdAt",
  "updatedAt",
];

export const validateImported = (
  parsed: unknown,
): parsed is { state: { items: ShoppingItem[] } } => {
  if (!parsed || typeof parsed !== "object") return false;
  const obj = parsed as { state?: unknown };
  if (!obj.state || typeof obj.state !== "object") return false;
  const state = obj.state as { items?: unknown };
  if (!Array.isArray(state.items)) return false;
  return state.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const it = item as Record<string, unknown>;
    return REQUIRED_ITEM_FIELDS.every((key) => key in it);
  });
};

export const importStateFromFile = async (file: File): Promise<boolean> => {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!validateImported(parsed)) return false;

  // 上書き時は version: 2 を付与（古い v1 形式が来ても migrate が走る形にする）
  const persistEnvelope = parsed as {
    state: unknown;
    version?: number;
  };
  const toStore = {
    state: persistEnvelope.state,
    version: persistEnvelope.version ?? STORAGE_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  return true;
};
