import { db } from '@/lib/db';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

type BackupRecord = Record<string, unknown>;

const CURRENT_BACKUP_VERSION = 2;

export interface BackupData {
  version: number;
  categories?: BackupRecord[];
  products?: BackupRecord[];
  suppliers?: BackupRecord[];
  stockIns?: BackupRecord[];
  stockOuts?: BackupRecord[];
  hppHistory?: BackupRecord[];
  paymentMethods?: BackupRecord[];
  transactions?: BackupRecord[];
  transactionItems?: BackupRecord[];
  storeSettings?: BackupRecord[];
}

type TableName = 'categories' | 'products' | 'suppliers' | 'stockIns' | 'stockOuts' | 'hppHistory' | 'paymentMethods' | 'transactions' | 'transactionItems' | 'storeSettings';

const BACKUP_TABLE_KEYS: TableName[] = [
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
];
const BACKUP_FILE_PREFIX = 'alaalakasir-backup';

export function shouldShowBackupReminder(lastBackupAt: Date | null): boolean {
  if (!lastBackupAt) return true;
  const hoursSince = (Date.now() - lastBackupAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 24;
}

async function saveBackupTimestamp() {
  const settings = await db.storeSettings.toCollection().first();
  if (settings?.id) {
    await db.storeSettings.update(settings.id, { lastBackupAt: new Date() });
  }
}

function downloadBackupInBrowser(fileName: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function buildBackupFileName() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${BACKUP_FILE_PREFIX}-${date}_${time}.json`;
}

async function buildBackupPayload() {
  return db.transaction('r', [
    db.categories, db.products, db.suppliers,
    db.stockIns, db.stockOuts, db.hppHistory,
    db.paymentMethods, db.transactions, db.transactionItems,
    db.storeSettings,
  ], async () => ({
    version: 2,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    suppliers: await db.suppliers.toArray(),
    stockIns: await db.stockIns.toArray(),
    stockOuts: await db.stockOuts.toArray(),
    hppHistory: await db.hppHistory.toArray(),
    paymentMethods: await db.paymentMethods.toArray(),
    transactions: await db.transactions.toArray(),
    transactionItems: await db.transactionItems.toArray(),
    storeSettings: await db.storeSettings.toArray(),
  }));
}

async function writeBackupFileToDocuments(fileName: string, json: string) {
  await Filesystem.writeFile({
    path: fileName,
    data: json,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return Filesystem.getUri({ path: fileName, directory: Directory.Documents });
}

export async function exportBackupData() {
  try {
    const data = await buildBackupPayload();
    const fileName = buildBackupFileName();
    const json = JSON.stringify(data, null, 2);

    if (Capacitor.isNativePlatform()) {
      const permission = await Filesystem.requestPermissions();
      if (permission.publicStorage !== 'granted') {
        throw new Error('Izin penyimpanan dibutuhkan untuk menyimpan backup');
      }
      await writeBackupFileToDocuments(fileName, json);
      toast.success(`Backup tersimpan: ${fileName}`);
    } else {
      downloadBackupInBrowser(fileName, json);
      toast.success('Backup diunduh sebagai file JSON');
    }

    await saveBackupTimestamp();
  } catch (error) {
    toast.error('Gagal membuat backup');
    throw error;
  }
}

export async function shareLatestBackupFile() {
  if (!Capacitor.isNativePlatform()) {
    toast.info('Di browser, backup bisa langsung diunduh lewat tombol Simpan Backup');
    return;
  }

  try {
    const files = await Filesystem.readdir({
      path: '',
      directory: Directory.Documents,
    });
    const backupFiles = files.files
      .map((entry) => typeof entry === 'string' ? entry : entry.name)
      .filter((name): name is string => !!name && name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith('.json'))
      .sort();

    const latest = backupFiles[backupFiles.length - 1];
    if (!latest) {
      toast.error('Belum ada file backup tersimpan. Simpan backup dulu.');
      return;
    }

    const uriResult = await Filesystem.getUri({ path: latest, directory: Directory.Documents });
    await Share.share({
      title: 'Backup AlaalaKasir',
      text: 'Bagikan file backup JSON ini ke lokasi aman.',
      url: uriResult.uri,
      dialogTitle: 'Bagikan file backup',
    });
  } catch {
    toast.error('Gagal membagikan file backup');
  }
}

const restoreTables = [
  db.categories,
  db.products,
  db.suppliers,
  db.stockIns,
  db.stockOuts,
  db.hppHistory,
  db.paymentMethods,
  db.transactions,
  db.transactionItems,
  db.storeSettings,
] as const;

async function clearAllTables() {
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

export function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (typeof data.version !== 'number') return false;

  for (const key of BACKUP_TABLE_KEYS) {
    const tableData = data[key];
    if (tableData !== undefined && !Array.isArray(tableData)) {
      return false;
    }
  }

  return true;
}

export function backupHasData(data: BackupData) {
  return ['categories', 'products', 'suppliers', 'transactions', 'paymentMethods'].some(key => {
    const value = data[key as keyof BackupData];
    return Array.isArray(value) && value.length > 0;
  });
}

type FieldValidator = [field: string, type: string];

function hasValidFields(record: BackupRecord, validators: FieldValidator[]) {
  return validators.every(([key, expectedType]) => {
    const value = record[key];
    if (value === undefined || value === null) return false;
    return typeof value === expectedType;
  });
}

function validateBackupDataShape(data: BackupData) {
  // Version compatibility check
  if (data.version > CURRENT_BACKUP_VERSION) {
    throw new Error(
      `Backup ini dari versi lebih baru (v${data.version}). Update aplikasi terlebih dahulu.`
    );
  }

  const tableValidators: Partial<Record<typeof BACKUP_TABLE_KEYS[number], FieldValidator[]>> = {
    categories: [['name', 'string'], ['color', 'string'], ['icon', 'string']],
    products: [['name', 'string'], ['sku', 'string'], ['categoryId', 'number'], ['price', 'number'], ['hpp', 'number'], ['stock', 'number'], ['unit', 'string']],
    suppliers: [['name', 'string']],
    stockIns: [['productId', 'number'], ['supplierId', 'number'], ['quantity', 'number'], ['buyPrice', 'number'], ['totalPrice', 'number']],
    stockOuts: [['productId', 'number'], ['quantity', 'number'], ['reason', 'string']],
    hppHistory: [['productId', 'number'], ['oldHpp', 'number'], ['newHpp', 'number'], ['source', 'string']],
    paymentMethods: [['name', 'string'], ['category', 'string']],
    transactions: [['subtotal', 'number'], ['total', 'number'], ['paymentMethodId', 'number'], ['paymentAmount', 'number'], ['change', 'number'], ['profit', 'number'], ['receiptNumber', 'string'], ['status', 'string']],
    transactionItems: [['transactionId', 'number'], ['productId', 'number'], ['productName', 'string'], ['quantity', 'number'], ['price', 'number'], ['hpp', 'number'], ['subtotal', 'number']],
    storeSettings: [['storeName', 'string'], ['address', 'string'], ['phone', 'string'], ['receiptFooter', 'string']],
  };

  for (const tableName of BACKUP_TABLE_KEYS) {
    const validators = tableValidators[tableName];
    if (!validators) continue;
    const rows = data[tableName];
    if (!rows) continue;
    const invalidRow = rows.find((row) => !row || typeof row !== 'object' || !hasValidFields(row, validators));
    if (invalidRow) {
      throw new Error(`Format backup tidak valid pada tabel: ${tableName}`);
    }
  }
}

export async function restoreBackupData(data: BackupData) {
  validateBackupDataShape(data);

  // Data sudah divalidasi bentuknya; cast ke tipe spesifik tabel untuk bulkAdd.
  const categories = (data.categories ?? []) as unknown as Parameters<typeof db.categories.bulkAdd>[0];
  const products = (data.products ?? []) as unknown as Parameters<typeof db.products.bulkAdd>[0];
  const suppliers = (data.suppliers ?? []) as unknown as Parameters<typeof db.suppliers.bulkAdd>[0];
  const stockIns = (data.stockIns ?? []) as unknown as Parameters<typeof db.stockIns.bulkAdd>[0];
  const stockOuts = (data.stockOuts ?? []) as unknown as Parameters<typeof db.stockOuts.bulkAdd>[0];
  const hppHistory = (data.hppHistory ?? []) as unknown as Parameters<typeof db.hppHistory.bulkAdd>[0];
  const paymentMethods = (data.paymentMethods ?? []) as unknown as Parameters<typeof db.paymentMethods.bulkAdd>[0];
  const transactions = (data.transactions ?? []) as unknown as Parameters<typeof db.transactions.bulkAdd>[0];
  const storeSettings = (data.storeSettings ?? []) as unknown as Parameters<typeof db.storeSettings.bulkAdd>[0];

  await db.transaction('rw', restoreTables, async () => {
    await clearAllTables();

    if (categories.length) await db.categories.bulkAdd(categories);
    if (products.length) await db.products.bulkAdd(products);
    if (suppliers.length) await db.suppliers.bulkAdd(suppliers);
    if (stockIns.length) await db.stockIns.bulkAdd(stockIns);
    if (stockOuts.length) await db.stockOuts.bulkAdd(stockOuts);
    if (hppHistory.length) await db.hppHistory.bulkAdd(hppHistory);
    if (paymentMethods.length) await db.paymentMethods.bulkAdd(paymentMethods);
    if (transactions.length) await db.transactions.bulkAdd(transactions);
    if (storeSettings.length) await db.storeSettings.bulkAdd(storeSettings);

    if (data.transactionItems?.length) {
      await db.transactionItems.bulkAdd(data.transactionItems as unknown as Parameters<typeof db.transactionItems.bulkAdd>[0]);
      return;
    }

    if (transactions.length && !data.transactionItems?.length) {
      // Fallback: migrasi embedded items[] dari backup versi lama
      const legacyTransactions = (data.transactions ?? []) as BackupRecord[];
      const itemRecords = legacyTransactions.flatMap(transaction => {
        const items = transaction.items;
        const transactionId = transaction.id;
        if (!Array.isArray(items) || typeof transactionId !== 'number') return [];

        return items
          .filter((item): item is BackupRecord => !!item && typeof item === 'object')
          .map(item => ({
            transactionId,
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
      });

      if (itemRecords.length) await db.transactionItems.bulkAdd(itemRecords as unknown as Parameters<typeof db.transactionItems.bulkAdd>[0]);
    }
  });
}
