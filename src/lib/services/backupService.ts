import { db } from '@/lib/db';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

type BackupRecord = Record<string, unknown>;

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

const BACKUP_TABLE_KEYS: Array<keyof BackupData> = [
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
  URL.revokeObjectURL(url);
}

function buildBackupFileName() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${BACKUP_FILE_PREFIX}-${date}_${time}.json`;
}

async function buildBackupPayload() {
  return {
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
  };
}

async function writeBackupFileToDocuments(fileName: string, json: string) {
  await Filesystem.writeFile({
    path: fileName,
    data: json,
    directory: Directory.Documents,
    encoding: 'utf8',
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
  } catch {
    toast.error('Gagal membuat backup');
    throw new Error('Backup export failed');
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

function hasRequiredFields(record: BackupRecord, requiredKeys: string[]) {
  return requiredKeys.every((key) => record[key] !== undefined && record[key] !== null);
}

function validateBackupDataShape(data: BackupData) {
  const tableValidators: Partial<Record<keyof BackupData, string[]>> = {
    categories: ['name', 'color', 'icon'],
    products: ['name', 'sku', 'categoryId', 'price', 'hpp', 'stock', 'unit'],
    suppliers: ['name'],
    stockIns: ['productId', 'supplierId', 'quantity', 'buyPrice', 'totalPrice', 'date'],
    stockOuts: ['productId', 'quantity', 'reason', 'date'],
    hppHistory: ['productId', 'oldHpp', 'newHpp', 'source', 'date'],
    paymentMethods: ['name', 'category', 'isDefault', 'createdAt'],
    transactions: ['subtotal', 'total', 'paymentMethodId', 'paymentAmount', 'change', 'profit', 'date', 'receiptNumber', 'status'],
    transactionItems: ['transactionId', 'productId', 'productName', 'quantity', 'price', 'hpp', 'subtotal'],
    storeSettings: ['storeName', 'address', 'phone', 'receiptFooter', 'onboardingDone', 'deviceId'],
  };

  for (const [tableName, keys] of Object.entries(tableValidators) as Array<[keyof BackupData, string[]]>) {
    const rows = data[tableName];
    if (!rows) continue;
    const invalidRow = rows.find((row) => !row || typeof row !== 'object' || !hasRequiredFields(row, keys));
    if (invalidRow) {
      throw new Error(`Format backup tidak valid pada tabel: ${tableName}`);
    }
  }
}

export async function restoreBackupData(data: BackupData) {
  validateBackupDataShape(data);

  await db.transaction('rw', restoreTables, async () => {
    await clearAllTables();

    if (data.categories?.length) await db.categories.bulkAdd(data.categories);
    if (data.products?.length) await db.products.bulkAdd(data.products);
    if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
    if (data.stockIns?.length) await db.stockIns.bulkAdd(data.stockIns);
    if (data.stockOuts?.length) await db.stockOuts.bulkAdd(data.stockOuts);
    if (data.hppHistory?.length) await db.hppHistory.bulkAdd(data.hppHistory);
    if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods);
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
    if (data.storeSettings?.length) await db.storeSettings.bulkAdd(data.storeSettings);

    if (data.transactionItems?.length) {
      await db.transactionItems.bulkAdd(data.transactionItems);
      return;
    }

    if (data.transactions?.length) {
      const itemRecords = data.transactions.flatMap(transaction => {
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

      if (itemRecords.length) await db.transactionItems.bulkAdd(itemRecords);
    }
  });
}
