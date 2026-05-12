import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addProduct, addStoreSettings, resetDb } from "@/test/db-test-utils";
import { backupHasData, isBackupData, restoreBackupData, shouldShowBackupReminder } from "./backupService";

describe("backupService", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("detects backup reminder after 24 hours", () => {
    expect(shouldShowBackupReminder(null)).toBe(true);
    expect(shouldShowBackupReminder(new Date(Date.now() - 23 * 60 * 60 * 1000))).toBe(false);
    expect(shouldShowBackupReminder(new Date(Date.now() - 25 * 60 * 60 * 1000))).toBe(true);
  });

  it("restores backup data atomically", async () => {
    await addProduct({ name: "Produk Lama", sku: "OLD", stock: 99 });

    const data = {
      version: 2,
      categories: [{
        id: 1,
        name: "Minuman",
        color: "#00AAFF",
        icon: "drink",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        isDeleted: 0,
        deletedAt: null,
      }],
      products: [{
        id: 1,
        name: "Es Teh",
        sku: "TEH-1",
        categoryId: 1,
        price: 5000,
        hpp: 2000,
        stock: 20,
        unit: "gelas",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        isDeleted: 0,
        deletedAt: null,
      }],
      paymentMethods: [{
        id: 1,
        name: "Tunai",
        category: "tunai",
        isDefault: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }],
      storeSettings: [{
        id: 1,
        storeName: "Toko Restore",
        address: "",
        phone: "",
        receiptFooter: "Terima kasih",
        onboardingDone: true,
        lastBackupAt: null,
        deviceId: "restore-device",
      }],
    };

    expect(backupHasData(data)).toBe(true);
    await restoreBackupData(data);

    expect(await db.products.count()).toBe(1);
    expect((await db.products.get(1))?.name).toBe("Es Teh");
    expect((await db.storeSettings.get(1))?.storeName).toBe("Toko Restore");
  });

  it("keeps old data if restore fails", async () => {
    await addStoreSettings({ id: 1, storeName: "Toko Lama" });

    await expect(restoreBackupData({
      version: 2,
      storeSettings: [
        {
          id: 1,
          storeName: "Toko A",
          address: "",
          phone: "",
          receiptFooter: "",
          onboardingDone: true,
          lastBackupAt: null,
          deviceId: "a",
        },
        {
          id: 1,
          storeName: "Toko Duplikat",
          address: "",
          phone: "",
          receiptFooter: "",
          onboardingDone: true,
          lastBackupAt: null,
          deviceId: "b",
        },
      ],
    })).rejects.toBeTruthy();

    expect((await db.storeSettings.get(1))?.storeName).toBe("Toko Lama");
  });

  it("rejects backup object when table payload is not an array", () => {
    expect(isBackupData({ version: 2, products: {} })).toBe(false);
    expect(isBackupData({ version: 2, products: [] })).toBe(true);
  });

  it("rejects restore when required fields are missing", async () => {
    await expect(
      restoreBackupData({
        version: 2,
        products: [
          {
            id: 1,
            name: "Produk Cacat",
            // sku intentionally missing
            categoryId: 1,
            price: 1000,
            hpp: 500,
            stock: 1,
            unit: "pcs",
          },
        ],
      })
    ).rejects.toThrow(/Format backup tidak valid/);
  });

  it("builds transactionItems from embedded items when v2 has no transactionItems", async () => {
    await restoreBackupData({
      version: 2,
      categories: [{
        id: 1,
        name: "Makanan",
        color: "#FF6B35",
        icon: "box",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        isDeleted: 0,
        deletedAt: null,
      }],
      products: [{
        id: 1,
        name: "Mie",
        sku: "MIE-1",
        categoryId: 1,
        price: 12000,
        hpp: 6000,
        stock: 10,
        unit: "porsi",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        isDeleted: 0,
        deletedAt: null,
      }],
      paymentMethods: [{
        id: 1,
        name: "Tunai",
        category: "tunai",
        isDefault: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }],
      transactions: [{
        id: 10,
        subtotal: 24000,
        discountType: null,
        discountValue: 0,
        discountAmount: 0,
        total: 24000,
        paymentMethodId: 1,
        paymentAmount: 25000,
        change: 1000,
        profit: 12000,
        date: new Date("2026-01-01T01:00:00Z"),
        receiptNumber: "TRX-10",
        status: "completed",
        items: [{
          productId: 1,
          productName: "Mie",
          quantity: 2,
          price: 12000,
          hpp: 6000,
          discountType: null,
          discountValue: 0,
          discountAmount: 0,
          subtotal: 24000,
        }],
      }],
      storeSettings: [{
        id: 1,
        storeName: "Toko Restore",
        address: "",
        phone: "",
        receiptFooter: "Terima kasih",
        onboardingDone: true,
        lastBackupAt: null,
        deviceId: "restore-device",
      }],
    });

    const txItems = await db.transactionItems.toArray();
    expect(txItems).toHaveLength(1);
    expect(txItems[0].transactionId).toBe(10);
    expect(txItems[0].productName).toBe("Mie");
  });
});
