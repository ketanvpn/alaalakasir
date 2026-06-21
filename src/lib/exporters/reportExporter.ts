import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

// === Types ===

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

// === CSV Serialization (RFC 4180 + UTF-8 BOM for Excel) ===

/**
 * Escape a single cell per RFC 4180:
 * - Wrap in double quotes if it contains comma, quote, newline, or carriage return.
 * - Double any embedded double quotes.
 */
export function escapeCsvCell(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize rows to CSV text using the given columns.
 * Prepends a UTF-8 BOM (\uFEFF) so Excel opens the file with correct encoding
 * (critical for Indonesian Rupiah / accented characters).
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.value(row))).join(',')
  );
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

// === File Output (browser download + Android Documents) ===

function downloadInBrowser(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function writeToDocuments(fileName: string, content: string) {
  await Filesystem.writeFile({
    path: fileName,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
  return uri.uri;
}

export interface ExportOptions {
  fileName: string;
  content: string;
  mimeType?: string;
  successMessage?: string;
  /** Set true to offer Share sheet after writing on native (default true). */
  shareOnNative?: boolean;
}

/**
 * Write content to disk: browser → download, native → Documents/ folder,
 * then optionally open the OS share sheet so the user can send to WhatsApp/email/cloud.
 */
export async function exportToFile({
  fileName,
  content,
  mimeType = 'text/csv',
  successMessage,
  shareOnNative = true,
}: ExportOptions): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const permission = await Filesystem.requestPermissions();
      if (permission.publicStorage !== 'granted') {
        throw new Error('Izin penyimpanan dibutuhkan untuk menyimpan laporan');
      }
      const uri = await writeToDocuments(fileName, content);
      toast.success(successMessage ?? `Laporan tersimpan: ${fileName}`);

      if (shareOnNative) {
        try {
          await Share.share({
            title: fileName,
            text: 'Laporan dari AlaalaKasir',
            url: uri,
            dialogTitle: 'Bagikan laporan',
          });
        } catch {
          // User cancelled share — file is already saved, not a real error.
        }
      }
    } else {
      downloadInBrowser(fileName, content, mimeType);
      toast.success(successMessage ?? 'Laporan diunduh');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengekspor laporan';
    toast.error(message);
    throw err;
  }
}

// === Filename Helpers ===

export function buildTimestampedFileName(prefix: string, ext: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${prefix}-${date}_${time}.${ext}`;
}

// === Domain-Specific Row Builders ===
// Pure functions that transform DB rows into CSV columns. Easy to unit-test
// without touching the filesystem.

export interface SalesSummaryRow {
  label: string;
  value: string | number;
}

export function salesSummaryToCsv(rows: SalesSummaryRow[]): string {
  return toCsv(rows, [
    { header: 'Keterangan', value: (r) => r.label },
    { header: 'Nilai', value: (r) => r.value },
  ]);
}

export function transactionsToCsvRows(
  rows: Array<{
    receiptNumber: string;
    date: Date | string;
    status: string;
    total: number;
    subtotal: number;
    discountAmount: number;
    paymentMethodName: string;
    customerName?: string;
    tableNumber?: string;
    remarks?: string;
  }>
): string {
  return toCsv(rows, [
    { header: 'No. Struk', value: (r) => r.receiptNumber },
    {
      header: 'Tanggal',
      value: (r) => {
        const d = new Date(r.date);
        return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      },
    },
    { header: 'Status', value: (r) => (r.status === 'open' ? 'Open Bill' : 'Lunas') },
    { header: 'Pelanggan', value: (r) => r.customerName ?? '' },
    { header: 'Meja', value: (r) => r.tableNumber ?? '' },
    { header: 'Catatan', value: (r) => r.remarks ?? '' },
    { header: 'Subtotal', value: (r) => r.subtotal },
    { header: 'Diskon', value: (r) => r.discountAmount },
    { header: 'Total', value: (r) => r.total },
    { header: 'Pembayaran', value: (r) => r.paymentMethodName },
  ]);
}

export interface ProductStockRow {
  name: string;
  sku: string;
  unit: string;
  stock: number;
  hpp: number;
  price: number;
  stockValue: number; // hpp * stock
}

export function productsToCsv(rows: ProductStockRow[]): string {
  return toCsv(rows, [
    { header: 'Nama Produk', value: (r) => r.name },
    { header: 'SKU', value: (r) => r.sku },
    { header: 'Satuan', value: (r) => r.unit },
    { header: 'Stok', value: (r) => r.stock },
    { header: 'HPP', value: (r) => r.hpp },
    { header: 'Harga Jual', value: (r) => r.price },
    { header: 'Nilai Stok (HPP×Stok)', value: (r) => r.stockValue },
  ]);
}

export interface StockMovementRow {
  date: Date | string;
  type: 'masuk' | 'keluar';
  productName: string;
  quantity: number;
  reason?: string;
  unitPrice?: number;
  total?: number;
}

export function stockMovementsToCsv(rows: StockMovementRow[]): string {
  return toCsv(rows, [
    {
      header: 'Tanggal',
      value: (r) => {
        const d = new Date(r.date);
        return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      },
    },
    { header: 'Tipe', value: (r) => r.type },
    { header: 'Produk', value: (r) => r.productName },
    { header: 'Jumlah', value: (r) => r.quantity },
    { header: 'Alasan', value: (r) => r.reason ?? '' },
    { header: 'Harga Satuan', value: (r) => r.unitPrice ?? '' },
    { header: 'Total', value: (r) => r.total ?? '' },
  ]);
}

export interface TopProductRow {
  rank: number;
  name: string;
  qty: number;
  revenue: number;
  profit: number;
}

export function topProductsToCsv(rows: TopProductRow[]): string {
  return toCsv(rows, [
    { header: 'Peringkat', value: (r) => r.rank },
    { header: 'Produk', value: (r) => r.name },
    { header: 'Jumlah Terjual', value: (r) => r.qty },
    { header: 'Omzet', value: (r) => r.revenue },
    { header: 'Laba', value: (r) => r.profit },
  ]);
}
