import Dexie, { type Table } from 'dexie';

// === Interfaces ===

export interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted (IndexedDB can't index booleans)
  deletedAt: Date | null;
}

export interface Product {
  id?: number;
  name: string;
  sku: string;
  categoryId: number;
  price: number; // harga jual
  hpp: number; // harga pokok penjualan
  stock: number;
  unit: string; // satuan: pcs, kg, liter, dll
  photo?: string; // base64 or blob URL
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
  deletedAt: Date | null;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
  deletedAt: Date | null;
}

export interface StockIn {
  id?: number;
  productId: number;
  supplierId: number;
  quantity: number;
  buyPrice: number; // harga beli per unit
  totalPrice: number;
  date: Date;
  notes: string;
}

export interface StockOut {
  id?: number;
  productId: number;
  quantity: number;
  reason: string; // rusak, hilang, retur, dll
  date: Date;
  notes: string;
}

export interface HppHistory {
  id?: number;
  productId: number;
  oldHpp: number;
  newHpp: number;
  source: 'stock_in' | 'manual';
  date: Date;
}

export interface PaymentMethod {
  id?: number;
  name: string;
  category: string; // tunai, transfer, e-wallet, qris
  isDefault: boolean;
  createdAt: Date;
}

export interface Transaction {
  id?: number;
  subtotal: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethodId: number;
  paymentAmount: number;
  change: number;
  profit: number;
  date: Date;
  receiptNumber: string;
  status: 'open' | 'completed';
  orderNumber?: string;
  customerName?: string;
  tableNumber?: string;
  remarks?: string;
  openedAt?: Date;
  closedAt?: Date;
}

export interface TransactionItemRecord {
  id?: number;
  transactionId: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  hpp: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
  notes?: string;
}

export interface StoreSettings {
  id?: number;
  storeName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  onboardingDone: boolean;
  lastBackupAt: Date | null;
  themeColor?: string; // HSL hue string e.g. "25" for orange
  logo?: string; // base64 JPEG compressed via compressImage()
  deviceId: string;
}

// === Database ===

const CURRENT_DB_NAME = 'alaalakasir-db';
const LEGACY_DB_NAMES = ['alalakasir-db', 'kasirgratisan-db'] as const;
const TABLE_NAMES = [
  'categories',
  'products',
  'suppliers',
  'stockIns',
  'stockOuts',
  'hppHistory',
  'paymentMethods',
  'transactions',
  'transactionItems',
  'storeSettings',
] as const;

type SoftDeleteMigrationRecord = {
  isDeleted?: number;
  deletedAt?: Date | null;
};

type StoreSettingsMigrationRecord = {
  deviceId?: string;
};

type LegacyTransactionItem = {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  hpp: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
};

type LegacyTransactionRecord = Transaction & {
  items?: LegacyTransactionItem[];
};

type ProductSkuMigrationRecord = {
  id?: number;
  sku?: string;
};

class PosDatabase extends Dexie {
  categories!: Table<Category>;
  products!: Table<Product>;
  suppliers!: Table<Supplier>;
  stockIns!: Table<StockIn>;
  stockOuts!: Table<StockOut>;
  hppHistory!: Table<HppHistory>;
  paymentMethods!: Table<PaymentMethod>;
  transactions!: Table<Transaction>;
  transactionItems!: Table<TransactionItemRecord>;
  storeSettings!: Table<StoreSettings>;

  constructor() {
    super(CURRENT_DB_NAME);

    // Version 1 — original schema (must remain for migration path)
    this.version(1).stores({
      categories: '++id, name',
      products: '++id, name, sku, categoryId, barcode',
      suppliers: '++id, name',
      stockIns: '++id, productId, supplierId, date',
      stockOuts: '++id, productId, date',
      hppHistory: '++id, productId, date',
      paymentMethods: '++id, name, category',
      transactions: '++id, date, receiptNumber, paymentMethodId',
      storeSettings: '++id',
    });

    // Version 2 — CR-1 to CR-5
    this.version(2).stores({
      categories: '++id, name, isDeleted',
      products: '++id, name, sku, categoryId, barcode, isDeleted',
      suppliers: '++id, name, isDeleted',
      stockIns: '++id, productId, supplierId, date',
      stockOuts: '++id, productId, date',
      hppHistory: '++id, productId, date',
      paymentMethods: '++id, name, category',
      transactions: '++id, date, &receiptNumber, paymentMethodId',
      transactionItems: '++id, transactionId, productId',
      storeSettings: '++id',
    }).upgrade(async (tx) => {
      // CR-2: Set soft delete defaults on existing records
      const catTable = tx.table<SoftDeleteMigrationRecord, number>('categories');
      await catTable.toCollection().modify((cat) => {
        cat.isDeleted = 0;
        cat.deletedAt = null;
      });

      const prodTable = tx.table<SoftDeleteMigrationRecord, number>('products');
      await prodTable.toCollection().modify((prod) => {
        prod.isDeleted = 0;
        prod.deletedAt = null;
      });

      const supTable = tx.table<SoftDeleteMigrationRecord, number>('suppliers');
      await supTable.toCollection().modify((sup) => {
        sup.isDeleted = 0;
        sup.deletedAt = null;
      });

      // CR-1: Generate deviceId for existing storeSettings
      const storeTable = tx.table<StoreSettingsMigrationRecord, number>('storeSettings');
      await storeTable.toCollection().modify((s) => {
        s.deviceId = crypto.randomUUID();
      });

      // CR-5: Migrate embedded items[] from transactions to transactionItems table
      const txTable = tx.table<LegacyTransactionRecord, number>('transactions');
      const itemsTable = tx.table<TransactionItemRecord, number>('transactionItems');
      const allTx = await txTable.toArray();

      for (const t of allTx) {
        const items = t.items;
        if (Array.isArray(items) && items.length > 0) {
          const records = items.map((item) => ({
            transactionId: t.id!,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            hpp: item.hpp,
            discountType: item.discountType,
            discountValue: item.discountValue,
            discountAmount: item.discountAmount,
            subtotal: item.subtotal,
          }));
          await itemsTable.bulkAdd(records);
        }
        // Remove embedded items field
        delete t.items;
        await txTable.put(t);
      }
    });

    // Version 3 — Open Bill: status, orderNumber, customer/table, item notes
    this.version(3).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
    }).upgrade(async (tx) => {
      // Set all existing transactions to 'completed' status
      await tx.table<Partial<Transaction>, number>('transactions').toCollection().modify((t) => {
        t.status = 'completed';
      });
    });

    // Version 4 — SKU unique constraint
    this.version(4).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, &sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
    }).upgrade(async (tx) => {
      // Deduplicate SKUs before applying unique constraint
      const prodTable = tx.table<ProductSkuMigrationRecord, number>('products');
      const allProducts = await prodTable.toArray();
      const seenSku = new Map<string, number | undefined>(); // sku -> first occurrence id

      for (const p of allProducts) {
        const sku = p.sku;
        if (!sku || sku.trim() === '') continue;

        if (seenSku.has(sku)) {
          // Duplicate SKU found — append suffix to make unique
          let counter = 1;
          let newSku = `${sku}_dup${counter}`;
          while (seenSku.has(newSku)) {
            counter++;
            newSku = `${sku}_dup${counter}`;
          }
          seenSku.set(newSku, p.id);
          await prodTable.update(p.id!, { sku: newSku });
        } else {
          seenSku.set(sku, p.id);
        }
      }
    });

    // Version 5 — Transaction compound index for dashboard queries
    this.version(5).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, &sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber, [status+date]',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
    });
  }
}

export const db = new PosDatabase();

async function migrateLegacyDatabaseIfNeeded() {
  const hasCurrentData = await Promise.all(TABLE_NAMES.map(tableName => db.table(tableName).count()))
    .then(counts => counts.some(count => count > 0));

  if (hasCurrentData) return;

  for (const legacyDbName of LEGACY_DB_NAMES) {
    const legacyDb = new Dexie(legacyDbName);
    legacyDb.version(4).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, &sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
    });

    try {
      await legacyDb.open();
      const legacyCounts = await Promise.all(TABLE_NAMES.map(tableName => legacyDb.table(tableName).count()));
      const hasLegacyData = legacyCounts.some(count => count > 0);
      if (!hasLegacyData) continue;

      await db.transaction('rw', TABLE_NAMES.map(tableName => db.table(tableName)), async () => {
        for (const tableName of TABLE_NAMES) {
          const records = await legacyDb.table(tableName).toArray();
          if (records.length > 0) {
            await db.table(tableName).bulkAdd(records);
          }
        }
      });
      return;
    } catch (error) {
      console.warn(`Legacy database migration skipped for ${legacyDbName}:`, error);
    } finally {
      legacyDb.close();
    }
  }
}

// Seed default data
export async function seedDefaultData() {
  await migrateLegacyDatabaseIfNeeded();

  await db.transaction('rw', [db.categories, db.paymentMethods, db.storeSettings], async () => {
    const categoryCount = await db.categories.count();
    if (categoryCount === 0) {
      await db.categories.bulkAdd([
        { name: 'Makanan', color: '#FF6B35', icon: '🍕', createdAt: new Date(), isDeleted: 0, deletedAt: null },
        { name: 'Minuman', color: '#4ECDC4', icon: '🥤', createdAt: new Date(), isDeleted: 0, deletedAt: null },
        { name: 'Lainnya', color: '#95A5A6', icon: '📦', createdAt: new Date(), isDeleted: 0, deletedAt: null },
      ]);
    }

    const pmCount = await db.paymentMethods.count();
    if (pmCount === 0) {
      await db.paymentMethods.bulkAdd([
        { name: 'Tunai', category: 'tunai', isDefault: true, createdAt: new Date() },
        { name: 'Transfer Bank', category: 'transfer', isDefault: false, createdAt: new Date() },
        { name: 'QRIS', category: 'qris', isDefault: false, createdAt: new Date() },
      ]);
    }

    const storeCount = await db.storeSettings.count();
    if (storeCount === 0) {
      await db.storeSettings.add({
        storeName: 'Toko Saya',
        address: '',
        phone: '',
        receiptFooter: 'Terima kasih atas kunjungan Anda!',
        onboardingDone: false,
        lastBackupAt: null,
        deviceId: crypto.randomUUID(),
      });
    } else {
      // Fallback: if storeSettings exists but has no deviceId, generate one
      const settings = await db.storeSettings.toCollection().first();
      if (settings && !settings.deviceId) {
        await db.storeSettings.update(settings.id!, { deviceId: crypto.randomUUID() });
      }
    }
  });
}
