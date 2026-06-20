import { db, type Category, type Product, type StoreSettings } from "@/lib/db";

export async function resetDb() {
  await db.transaction(
    "rw",
    [db.categories, db.products, db.suppliers, db.stockIns, db.stockOuts, db.hppHistory, db.paymentMethods, db.transactions, db.transactionItems, db.storeSettings],
    async () => {
      await db.categories.clear();
      await db.products.clear();
      await db.suppliers.clear();
      await db.stockIns.clear();
      await db.stockOuts.clear();
      await db.hppHistory.clear();
      await db.paymentMethods.clear();
      await db.transactions.clear();
      await db.transactionItems.clear();
      await db.storeSettings.clear();
    }
  );
}

export async function addCategory(overrides: Partial<Category> = {}) {
  return db.categories.add({
    name: "Makanan",
    color: "#FF6B35",
    icon: "box",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isDeleted: 0,
    deletedAt: null,
    ...overrides,
  });
}

export async function addProduct(overrides: Partial<Product> = {}) {
  const categoryId = overrides.categoryId ?? await addCategory();

  return db.products.add({
    name: "Nasi Goreng",
    sku: `SKU-${Math.random().toString(36).slice(2)}`,
    categoryId,
    price: 15000,
    hpp: 8000,
    stock: 10,
    unit: "porsi",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    isDeleted: 0,
    deletedAt: null,
    ...overrides,
  });
}

export async function addSupplier() {
  return db.suppliers.add({
    name: "Supplier Utama",
    phone: "08123456789",
    address: "Jayapura",
    notes: "",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    isDeleted: 0,
    deletedAt: null,
  });
}

export async function addStoreSettings(overrides: Partial<StoreSettings> = {}) {
  return db.storeSettings.add({
    storeName: "Toko Test",
    address: "",
    phone: "",
    receiptFooter: "Terima kasih",
    onboardingDone: true,
    lastBackupAt: null,
    deviceId: "device-test",
    ...overrides,
  });
}
