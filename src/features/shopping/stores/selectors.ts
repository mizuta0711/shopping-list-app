import type { ItemScope, ShoppingItem, SortKey } from "../types";

export const filterPendingByScope = (
  items: ShoppingItem[],
  scope: ItemScope,
): ShoppingItem[] =>
  items.filter((item) => item.status === "PENDING" && item.scope === scope);

export const filterPurchased = (items: ShoppingItem[]): ShoppingItem[] =>
  items.filter((item) => item.status === "PURCHASED");

export const sortItems = (
  items: ShoppingItem[],
  sort: SortKey,
): ShoppingItem[] => {
  const arr = [...items];
  if (sort === "NAME") {
    return arr.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
  if (sort === "MANUAL") {
    return arr.sort((a, b) => a.order - b.order);
  }
  return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export type PurchasedGroup = {
  key: string;
  label: string;
  items: ShoppingItem[];
};

const startOfDay = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatYmd = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
};

const dateKey = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const groupPurchasedByDate = (
  items: ShoppingItem[],
  now: Date,
): PurchasedGroup[] => {
  const purchased = items.filter(
    (item): item is ShoppingItem & { purchasedAt: string } =>
      item.status === "PURCHASED" && item.purchasedAt !== null,
  );

  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(yesterday);

  const groups = new Map<string, PurchasedGroup>();

  for (const item of purchased) {
    const purchaseDate = new Date(item.purchasedAt);
    const key = dateKey(startOfDay(purchaseDate));
    const label =
      key === todayKey
        ? "今日"
        : key === yesterdayKey
          ? "昨日"
          : formatYmd(purchaseDate);

    if (!groups.has(key)) {
      groups.set(key, { key, label, items: [] });
    }
    groups.get(key)!.items.push(item);
  }

  // 各グループ内で purchasedAt 降順、グループ自体も降順（キー逆順）
  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    b.key.localeCompare(a.key),
  );
  for (const g of sortedGroups) {
    g.items.sort((a, b) =>
      (b.purchasedAt ?? "").localeCompare(a.purchasedAt ?? ""),
    );
  }
  return sortedGroups;
};
