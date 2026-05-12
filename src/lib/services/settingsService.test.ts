import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addCategory, addProduct, resetDb } from "@/test/db-test-utils";
import { canDeleteCategory, canDeletePaymentMethod } from "./settingsService";

async function addPaymentMethod(overrides: Partial<{ id: number; name: string; category: string; isDefault: boolean }> = {}) {
  return db.paymentMethods.add({
    name: overrides.name ?? "Tunai",
    category: overrides.category ?? "tunai",
    isDefault: overrides.isDefault ?? false,
    createdAt: new Date("2026-05-12T00:00:00.000Z"),
    ...(overrides.id ? { id: overrides.id } : {}),
  });
}

describe("settingsService", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects deletion when method is the last remaining one", async () => {
    const pmId = await addPaymentMethod({ id: 1, isDefault: true });

    const result = await canDeletePaymentMethod(pmId as number);

    expect(result).toEqual({ ok: false, reason: "last_method" });
  });

  it("rejects deletion when method has been used by transactions", async () => {
    await addPaymentMethod({ id: 1, name: "Tunai", isDefault: true });
    const targetId = await addPaymentMethod({ id: 2, name: "QRIS", category: "qris" });

    await db.transactions.add({
      subtotal: 10000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 10000,
      paymentMethodId: targetId as number,
      paymentAmount: 10000,
      change: 0,
      profit: 3000,
      date: new Date("2026-05-12T08:00:00.000Z"),
      receiptNumber: "TRX-1",
      status: "completed",
    });

    const result = await canDeletePaymentMethod(targetId as number);

    expect(result).toEqual({ ok: false, reason: "already_used" });
  });

  it("allows deletion when method is not last and has no usage", async () => {
    await addPaymentMethod({ id: 1, name: "Tunai", isDefault: true });
    const targetId = await addPaymentMethod({ id: 2, name: "Transfer", category: "transfer" });

    const result = await canDeletePaymentMethod(targetId as number);

    expect(result).toEqual({ ok: true });
  });

  it("rejects category deletion when still used by active products", async () => {
    const categoryId = await addCategory({ id: 11, name: "Makanan" });
    await addProduct({ categoryId: categoryId as number, isDeleted: 0 });

    const result = await canDeleteCategory(categoryId as number);

    expect(result).toEqual({ ok: false, reason: "has_active_products" });
  });

  it("allows category deletion when only deleted products use it", async () => {
    const categoryId = await addCategory({ id: 12, name: "Minuman" });
    await addProduct({ categoryId: categoryId as number, isDeleted: 1, deletedAt: new Date("2026-05-12T00:00:00.000Z") });

    const result = await canDeleteCategory(categoryId as number);

    expect(result).toEqual({ ok: true });
  });
});
