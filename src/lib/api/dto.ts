import type {
  ShoppingItem as PrismaShoppingItem,
  ShoppingSet as PrismaShoppingSet,
} from "@prisma/client";
import type { ItemScope, ItemStatus } from "@/features/shopping/types";
import type { ShoppingItemDTO, ShoppingSetDTO } from "@/types/sync";

export function toDTO(item: PrismaShoppingItem): ShoppingItemDTO {
  return {
    id: item.id,
    name: item.name,
    scope: item.scope as ItemScope,
    status: item.status as ItemStatus,
    order: item.order,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    purchasedAt: item.purchasedAt ? item.purchasedAt.toISOString() : null,
  };
}

export function setToDTO(set: PrismaShoppingSet): ShoppingSetDTO {
  return {
    id: set.id,
    name: set.name,
    items: set.items,
    createdAt: set.createdAt.toISOString(),
    updatedAt: set.updatedAt.toISOString(),
  };
}
