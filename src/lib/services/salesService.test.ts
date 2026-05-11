import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addProduct, resetDb } from "@/test/db-test-utils";
import { cancelOpenBill, checkoutSale, deleteTransaction, saveOpenBill, type SaleCartItem } from "./salesService";

function item(productId: number, overrides: Partial<SaleCartItem> = {}): SaleCartItem {
  return {
    productId,
    productName: "Nasi Goreng",
    quantity: 2,
    price: 15000,
    hpp: 8000,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    subtotal: 30000,
    ...overrides,
  };
}

describe("salesService", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates completed sale with items and reduces latest product stock", async () => {
    const productId = await addProduct({ stock: 10, hpp: 7000 });

    const result = await checkoutSale({
      editingTxId: null,
      items: [item(productId as number, { hpp: 7000 })],
      subtotal: 30000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 30000,
      paymentMethodId: 1,
      paymentAmount: 50000,
      change: 20000,
      profit: 16000,
      customerName: "Budi",
    });

    const product = await db.products.get(productId as number);
    const items = await db.transactionItems.where("transactionId").equals(result.transaction.id!).toArray();

    expect(result.transaction.status).toBe("completed");
    expect(result.transaction.total).toBe(30000);
    expect(product?.stock).toBe(8);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("reserves stock for open bill and restores it when cancelled", async () => {
    const productId = await addProduct({ stock: 5 });

    const bill = await saveOpenBill({
      editingTxId: null,
      items: [item(productId as number, { quantity: 3, subtotal: 45000 })],
      subtotal: 45000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 45000,
      tableNumber: "7",
    });

    expect((await db.products.get(productId as number))?.stock).toBe(2);
    expect(await db.transactions.count()).toBe(1);

    await cancelOpenBill(bill.transaction.id!);

    expect((await db.products.get(productId as number))?.stock).toBe(5);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.transactionItems.count()).toBe(0);
  });

  it("updates open bill stock by delta before checkout", async () => {
    const productId = await addProduct({ stock: 10 });

    const bill = await saveOpenBill({
      editingTxId: null,
      items: [item(productId as number, { quantity: 2 })],
      subtotal: 30000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 30000,
    });

    await checkoutSale({
      editingTxId: bill.transaction.id!,
      items: [item(productId as number, { quantity: 4, subtotal: 60000 })],
      subtotal: 60000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 60000,
      paymentMethodId: 1,
      paymentAmount: 60000,
      change: 0,
      profit: 28000,
    });

    const product = await db.products.get(productId as number);
    const transaction = await db.transactions.get(bill.transaction.id!);

    expect(product?.stock).toBe(6);
    expect(transaction?.status).toBe("completed");
  });

  it("deletes transaction and optionally restores stock", async () => {
    const productId = await addProduct({ stock: 10 });
    const sale = await checkoutSale({
      editingTxId: null,
      items: [item(productId as number)],
      subtotal: 30000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 30000,
      paymentMethodId: 1,
      paymentAmount: 30000,
      change: 0,
      profit: 14000,
    });

    expect((await db.products.get(productId as number))?.stock).toBe(8);

    await deleteTransaction(sale.transaction.id!, true);

    expect((await db.products.get(productId as number))?.stock).toBe(10);
    expect(await db.transactions.count()).toBe(0);
  });
});
