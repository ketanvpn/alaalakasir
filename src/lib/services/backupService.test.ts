import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addProduct, addStoreSettings, resetDb } from "@/test/db-test-utils";
import { backupHasData, restoreBackupData, shouldShowBackupReminder } from "./backupService";

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
});
