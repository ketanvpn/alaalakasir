import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addProduct, addSupplier, resetDb } from "@/test/db-test-utils";
import { addStockIn, addStockOut } from "./stockService";

describe("stockService", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("adds stock in and recalculates weighted average HPP", async () => {
    const productId = await addProduct({ stock: 10, hpp: 8000 });
    const supplierId = await addSupplier();

    const result = await addStockIn({
      productId: productId as number,
      supplierId: supplierId as number,
      quantity: 10,
      buyPrice: 12000,
      notes: "Restock",
    });

    const product = await db.products.get(productId as number);

    expect(result.newHpp).toBe(10000);
    expect(product?.stock).toBe(20);
    expect(product?.hpp).toBe(10000);
    expect(await db.stockIns.count()).toBe(1);
    expect(await db.hppHistory.count()).toBe(1);
  });

  it("adds stock out and rejects quantity above current stock", async () => {
    const productId = await addProduct({ stock: 4 });

    await addStockOut({
      productId: productId as number,
      quantity: 3,
      reason: "Rusak",
      notes: "",
    });

    expect((await db.products.get(productId as number))?.stock).toBe(1);
    await expect(addStockOut({
      productId: productId as number,
      quantity: 2,
      reason: "Hilang",
      notes: "",
    })).rejects.toThrow("Jumlah melebihi stok");
    expect((await db.products.get(productId as number))?.stock).toBe(1);
  });
});
