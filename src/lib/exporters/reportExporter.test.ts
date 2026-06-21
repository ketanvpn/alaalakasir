import { describe, expect, it } from 'vitest';
import {
  buildTimestampedFileName,
  escapeCsvCell,
  productsToCsv,
  salesSummaryToCsv,
  stockMovementsToCsv,
  toCsv,
  topProductsToCsv,
  transactionsToCsvRows,
  type CsvColumn,
} from './reportExporter';

describe('escapeCsvCell', () => {
  it('returns empty string for null and undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('passes through simple text unchanged', () => {
    expect(escapeCsvCell('Kopi Susu')).toBe('Kopi Susu');
    expect(escapeCsvCell(15000)).toBe('15000');
  });

  it('wraps and quotes when cell contains a comma', () => {
    expect(escapeCsvCell('Susu, Full Cream')).toBe('"Susu, Full Cream"');
  });

  it('wraps and quotes when cell contains a double quote', () => {
    expect(escapeCsvCell('Promo "Murah"')).toBe('"Promo ""Murah"""');
  });

  it('wraps when cell contains a newline', () => {
    expect(escapeCsvCell('Baris 1\nBaris 2')).toBe('"Baris 1\nBaris 2"');
    expect(escapeCsvCell('Baris 1\r\nBaris 2')).toBe('"Baris 1\r\nBaris 2"');
  });

  it('keeps Indonesian characters intact', () => {
    expect(escapeCsvCell('Nasi Goreng Spesial')).toBe('Nasi Goreng Spesial');
  });
});

describe('toCsv', () => {
  interface Row {
    name: string;
    qty: number;
  }
  const columns: CsvColumn<Row>[] = [
    { header: 'Nama', value: (r) => r.name },
    { header: 'Qty', value: (r) => r.qty },
  ];

  it('emits UTF-8 BOM so Excel reads encoding correctly', () => {
    const csv = toCsv([], columns);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('writes header row even when no data rows', () => {
    const csv = toCsv([], columns);
    expect(csv).toBe('\uFEFFNama,Qty');
  });

  it('serializes multiple rows with CRLF line endings', () => {
    const csv = toCsv([{ name: 'Espresso', qty: 2 }, { name: 'Latte', qty: 1 }], columns);
    expect(csv).toBe('\uFEFFNama,Qty\r\nEspresso,2\r\nLatte,1');
  });

  it('quotes only the cell that needs escaping, leaves others alone', () => {
    const csv = toCsv([{ name: 'Kopi, Arabica', qty: 5 }], columns);
    expect(csv).toBe('\uFEFFNama,Qty\r\n"Kopi, Arabica",5');
  });

  it('renders null/undefined values as empty cells', () => {
    interface R { name: string; note: string | null }
    const cols: CsvColumn<R>[] = [
      { header: 'Nama', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ];
    const csv = toCsv([{ name: 'X', note: null }], cols);
    expect(csv).toBe('\uFEFFNama,Note\r\nX,');
  });
});

describe('domain row builders', () => {
  it('transactionsToCsvRows maps every column', () => {
    const csv = transactionsToCsvRows([
      {
        receiptNumber: 'INV-001',
        date: new Date('2026-06-15T08:30:00'),
        status: 'completed',
        total: 25000,
        subtotal: 27000,
        discountAmount: 2000,
        paymentMethodName: 'QRIS',
        customerName: 'Budi',
        tableNumber: '3',
        remarks: 'Pedas',
      },
    ]);
    expect(csv).toContain('INV-001');
    expect(csv).toContain('Lunas');
    expect(csv).toContain('QRIS');
    expect(csv).toContain('Budi');
    expect(csv).toContain('25000');
  });

  it('transactionsToCsvRows labels open bills correctly', () => {
    const csv = transactionsToCsvRows([
      { receiptNumber: 'OPEN-1', date: new Date('2026-06-15'), status: 'open', total: 0, subtotal: 0, discountAmount: 0, paymentMethodName: '-' },
    ]);
    expect(csv).toContain('Open Bill');
  });

  it('productsToCsv includes stock value column', () => {
    const csv = productsToCsv([
      { name: 'Kopi', sku: 'K-1', unit: 'cup', stock: 10, hpp: 5000, price: 15000, stockValue: 50000 },
    ]);
    expect(csv).toContain('Nilai Stok');
    expect(csv).toContain('50000');
  });

  it('stockMovementsToCsv marks type and reason', () => {
    const csv = stockMovementsToCsv([
      { date: new Date('2026-06-15'), type: 'keluar', productName: 'Teh', quantity: 2, reason: 'rusak' },
    ]);
    expect(csv).toContain('keluar');
    expect(csv).toContain('rusak');
  });

  it('topProductsToCsv includes rank and profit', () => {
    const csv = topProductsToCsv([
      { rank: 1, name: 'Es Jeruk', qty: 40, revenue: 120000, profit: 60000 },
    ]);
    expect(csv).toContain('Peringkat');
    expect(csv).toContain('60000');
  });

  it('salesSummaryToCsv emits label/value pairs', () => {
    const csv = salesSummaryToCsv([
      { label: 'Omzet', value: 100000 },
      { label: 'Laba', value: 30000 },
    ]);
    expect(csv).toContain('Omzet');
    expect(csv).toContain('100000');
    expect(csv).toContain('Laba');
  });
});

describe('buildTimestampedFileName', () => {
  it('produces a filename with date, time, and extension', () => {
    const name = buildTimestampedFileName('laporan-penjualan', 'csv');
    // Format: laporan-penjualan-YYYY-MM-DD_HH-MM-SS.csv
    expect(name).toMatch(/^laporan-penjualan-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
  });

  it('uses the given extension verbatim', () => {
    const name = buildTimestampedFileName('mutasi', 'csv');
    expect(name.endsWith('.csv')).toBe(true);
  });
});
