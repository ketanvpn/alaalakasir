import { describe, it, expect } from 'vitest';
import { buildEscPosText, buildEscPosPayload, type ReceiptPrintData } from '@/lib/services/printerService';
import type { Transaction, TransactionItemRecord, StoreSettings } from '@/lib/db';

describe('printerService', () => {
  const sampleTx: Transaction = {
    id: 1,
    receiptNumber: 'TRX-20260805-001',
    date: new Date('2026-08-05T10:30:00Z'),
    subtotal: 35000,
    discountType: null,
    discountValue: 0,
    discountAmount: 5000,
    total: 30000,
    paymentMethodId: 1,
    paymentAmount: 50000,
    change: 20000,
    profit: 10000,
    status: 'completed',
    customerName: 'Budi',
    tableNumber: '4',
    remarks: 'Pedas',
  };

  const sampleItems: TransactionItemRecord[] = [
    {
      id: 1,
      transactionId: 1,
      productId: 10,
      productName: 'Nasi Goreng Spesial',
      quantity: 2,
      price: 15000,
      hpp: 8000,
      subtotal: 30000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      notes: 'Tanpa bawang',
    },
    {
      id: 2,
      transactionId: 1,
      productId: 11,
      productName: 'Es Teh Manis',
      quantity: 1,
      price: 5000,
      hpp: 1500,
      subtotal: 5000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
    },
  ];

  const sampleStore: StoreSettings = {
    id: 1,
    storeName: 'Warung Berkah UMKM',
    address: 'Jl. Melati No. 12',
    phone: '08123456789',
    onboardingDone: true,
    receiptFooter: 'Terima kasih telah berbelanja!',
    lastBackupAt: null,
    deviceId: 'DEV-001',
  };

  const samplePrintData: ReceiptPrintData = {
    transaction: sampleTx,
    items: sampleItems,
    storeSettings: sampleStore,
    paymentMethodName: 'Tunai (Cash)',
  };

  it('builds standard ESC/POS formatted receipt text accurately', () => {
    const text = buildEscPosText(samplePrintData);

    expect(text).toContain('Warung Berkah UMKM');
    expect(text).toContain('Jl. Melati No. 12');
    expect(text).toContain('08123456789');
    expect(text).toContain('TRX-20260805-001');
    expect(text).toContain('Tunai (Cash)');
    expect(text).toContain('Nasi Goreng Spesial');
    expect(text).toContain('Tanpa bawang');
    expect(text).toContain('Es Teh Manis');
    expect(text).toContain('Diskon:');
    expect(text).toContain('TOTAL:');
    expect(text).toContain('Terima kasih telah berbelanja!');
  });

  it('encodes ESC/POS text into byte payload successfully', () => {
    const payload = buildEscPosPayload(samplePrintData);
    expect(payload.byteLength).toBeGreaterThan(50);
    expect(payload[0]).toBe(0x1B); // ESC command byte
    expect(payload[1]).toBe(0x40); // @ command byte
  });
});
