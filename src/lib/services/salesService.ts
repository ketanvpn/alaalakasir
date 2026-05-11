import { db, type Product, type Transaction, type TransactionItemRecord } from '@/lib/db';

export interface SaleCartItem {
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

interface BillCustomerInfo {
  customerName?: string;
  tableNumber?: string;
  remarks?: string;
}

interface SaleTotals {
  subtotal: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
}

export interface SaveOpenBillInput extends SaleTotals, BillCustomerInfo {
  editingTxId: number | null;
  items: SaleCartItem[];
}

export interface CheckoutInput extends SaleTotals, BillCustomerInfo {
  editingTxId: number | null;
  items: SaleCartItem[];
  paymentMethodId: number;
  paymentAmount: number;
  change: number;
  profit: number;
}

export interface SaleResult {
  transaction: Transaction;
  items: TransactionItemRecord[];
}

const touchedTables = [db.transactions, db.transactionItems, db.products] as const;

function buildItemRecords(transactionId: number, items: SaleCartItem[]): TransactionItemRecord[] {
  return items.map(item => ({
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
    notes: item.notes,
  }));
}

async function getProductsById(productIds: number[]) {
  const products = await db.products.bulkGet(productIds);
  const productMap = new Map<number, Product>();

  products.forEach((product, index) => {
    if (product?.id) productMap.set(product.id, product);
    else throw new Error(`Produk tidak ditemukan: ${productIds[index]}`);
  });

  return productMap;
}

async function applyReservedStockChange(nextItems: SaleCartItem[], previousItems: TransactionItemRecord[] = []) {
  const oldQtyByProduct = new Map<number, number>();
  const newQtyByProduct = new Map<number, number>();

  for (const item of previousItems) {
    oldQtyByProduct.set(item.productId, (oldQtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  for (const item of nextItems) {
    newQtyByProduct.set(item.productId, (newQtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  const productIds = Array.from(new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]));
  const productMap = await getProductsById(productIds);
  const now = new Date();

  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) throw new Error(`Produk tidak ditemukan: ${productId}`);

    const oldQty = oldQtyByProduct.get(productId) ?? 0;
    const newQty = newQtyByProduct.get(productId) ?? 0;
    const nextStock = product.stock + oldQty - newQty;

    if (nextStock < 0) {
      throw new Error(`Stok ${product.name} tidak cukup`);
    }

    if (nextStock !== product.stock) {
      await db.products.update(productId, { stock: nextStock, updatedAt: now });
    }
  }
}

export async function saveOpenBill(input: SaveOpenBillInput): Promise<SaleResult> {
  if (input.items.length === 0) throw new Error('Keranjang kosong');

  return db.transaction('rw', touchedTables, async () => {
    const now = new Date();

    if (input.editingTxId) {
      const oldItems = await db.transactionItems.where('transactionId').equals(input.editingTxId).toArray();

      await applyReservedStockChange(input.items, oldItems);
      await db.transactions.update(input.editingTxId, {
        subtotal: input.subtotal,
        discountType: input.discountType,
        discountValue: input.discountValue,
        discountAmount: input.discountAmount,
        total: input.total,
        customerName: input.customerName,
        tableNumber: input.tableNumber,
        remarks: input.remarks,
        date: now,
      });

      await db.transactionItems.where('transactionId').equals(input.editingTxId).delete();
      const itemRecords = buildItemRecords(input.editingTxId, input.items);
      await db.transactionItems.bulkAdd(itemRecords);

      const transaction = await db.transactions.get(input.editingTxId);
      if (!transaction) throw new Error('Bill tidak ditemukan setelah diperbarui');
      return { transaction, items: itemRecords };
    }

    await applyReservedStockChange(input.items);

    const transaction: Transaction = {
      subtotal: input.subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: input.discountAmount,
      total: input.total,
      paymentMethodId: 0,
      paymentAmount: 0,
      change: 0,
      profit: 0,
      date: now,
      receiptNumber: `TX${Date.now()}`,
      status: 'open',
      customerName: input.customerName,
      tableNumber: input.tableNumber,
      remarks: input.remarks,
      openedAt: now,
    };

    const txId = await db.transactions.add(transaction);
    const itemRecords = buildItemRecords(txId as number, input.items);
    await db.transactionItems.bulkAdd(itemRecords);

    return { transaction: { ...transaction, id: txId as number }, items: itemRecords };
  });
}

export async function checkoutSale(input: CheckoutInput): Promise<SaleResult> {
  if (input.items.length === 0) throw new Error('Keranjang kosong');

  return db.transaction('rw', touchedTables, async () => {
    const now = new Date();

    if (input.editingTxId) {
      const oldItems = await db.transactionItems.where('transactionId').equals(input.editingTxId).toArray();

      await applyReservedStockChange(input.items, oldItems);
      await db.transactions.update(input.editingTxId, {
        status: 'completed',
        subtotal: input.subtotal,
        discountType: input.discountType,
        discountValue: input.discountValue,
        discountAmount: input.discountAmount,
        total: input.total,
        paymentMethodId: input.paymentMethodId,
        paymentAmount: input.paymentAmount,
        change: input.change,
        profit: input.profit,
        customerName: input.customerName,
        tableNumber: input.tableNumber,
        remarks: input.remarks,
        closedAt: now,
      });

      await db.transactionItems.where('transactionId').equals(input.editingTxId).delete();
      const itemRecords = buildItemRecords(input.editingTxId, input.items);
      await db.transactionItems.bulkAdd(itemRecords);

      const transaction = await db.transactions.get(input.editingTxId);
      if (!transaction) throw new Error('Transaksi tidak ditemukan setelah checkout');
      return { transaction, items: itemRecords };
    }

    await applyReservedStockChange(input.items);

    const transaction: Transaction = {
      subtotal: input.subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: input.discountAmount,
      total: input.total,
      paymentMethodId: input.paymentMethodId,
      paymentAmount: input.paymentAmount,
      change: input.change,
      profit: input.profit,
      date: now,
      receiptNumber: `TX${Date.now()}`,
      status: 'completed',
      customerName: input.customerName,
      tableNumber: input.tableNumber,
      remarks: input.remarks,
    };

    const txId = await db.transactions.add(transaction);
    const itemRecords = buildItemRecords(txId as number, input.items);
    await db.transactionItems.bulkAdd(itemRecords);

    return { transaction: { ...transaction, id: txId as number }, items: itemRecords };
  });
}

export async function cancelOpenBill(transactionId: number) {
  return db.transaction('rw', touchedTables, async () => {
    const transaction = await db.transactions.get(transactionId);
    if (!transaction) throw new Error('Bill tidak ditemukan');

    const items = await db.transactionItems.where('transactionId').equals(transactionId).toArray();
    await applyReservedStockChange([], items);
    await db.transactionItems.where('transactionId').equals(transactionId).delete();
    await db.transactions.delete(transactionId);

    return transaction;
  });
}

export async function deleteTransaction(transactionId: number, restoreStock: boolean) {
  return db.transaction('rw', touchedTables, async () => {
    const transaction = await db.transactions.get(transactionId);
    if (!transaction) throw new Error('Transaksi tidak ditemukan');

    const items = await db.transactionItems.where('transactionId').equals(transactionId).toArray();
    const mustRestoreStock = restoreStock || transaction.status === 'open';
    if (mustRestoreStock) {
      await applyReservedStockChange([], items);
    }

    await db.transactionItems.where('transactionId').equals(transactionId).delete();
    await db.transactions.delete(transactionId);

    return transaction;
  });
}
