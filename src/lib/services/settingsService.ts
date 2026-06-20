import { db } from "@/lib/db";

export type DeletePaymentMethodCheck =
  | { ok: true }
  | { ok: false; reason: "last_method" | "already_used" };

export function isPaymentMethodDeletable(
  check: DeletePaymentMethodCheck
): check is { ok: true } {
  return check.ok;
}

export async function canDeletePaymentMethod(id: number): Promise<DeletePaymentMethodCheck> {
  const pmCount = await db.paymentMethods.count();
  if (pmCount <= 1) {
    return { ok: false, reason: "last_method" };
  }

  const usageCount = await db.transactions.where("paymentMethodId").equals(id).count();
  if (usageCount > 0) {
    return { ok: false, reason: "already_used" };
  }

  return { ok: true };
}

export type DeleteCategoryCheck =
  | { ok: true }
  | { ok: false; reason: "has_active_products" };

export function isCategoryDeletable(
  check: DeleteCategoryCheck
): check is { ok: true } {
  return check.ok;
}

export async function canDeleteCategory(id: number): Promise<DeleteCategoryCheck> {
  const activeProductCount = await db.products
    .where("categoryId")
    .equals(id)
    .and((product) => product.isDeleted === 0)
    .count();

  if (activeProductCount > 0) {
    return { ok: false, reason: "has_active_products" };
  }

  return { ok: true };
}
