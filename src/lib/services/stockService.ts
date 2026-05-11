import { db } from '@/lib/db';

export interface StockInInput {
  productId: number;
  supplierId: number;
  quantity: number;
  buyPrice: number;
  notes: string;
}

export interface StockOutInput {
  productId: number;
  quantity: number;
  reason: string;
  notes: string;
}

export async function addStockIn(input: StockInInput) {
  if (!Number.isFinite(input.quantity) || !Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Jumlah stok masuk harus bilangan bulat lebih dari 0');
  }
  if (!Number.isFinite(input.buyPrice) || input.buyPrice <= 0) {
    throw new Error('Harga beli harus lebih dari 0');
  }

  return db.transaction('rw', db.stockIns, db.hppHistory, db.products, async () => {
    const product = await db.products.get(input.productId);
    if (!product) throw new Error('Produk tidak ditemukan');

    const now = new Date();
    const oldStock = product.stock;
    const oldHpp = product.hpp;
    const newStock = oldStock + input.quantity;
    const newHpp = newStock > 0
      ? ((oldStock * oldHpp) + (input.quantity * input.buyPrice)) / newStock
      : input.buyPrice;
    const roundedHpp = Math.round(newHpp);

    await db.stockIns.add({
      productId: input.productId,
      supplierId: input.supplierId,
      quantity: input.quantity,
      buyPrice: input.buyPrice,
      totalPrice: input.quantity * input.buyPrice,
      date: now,
      notes: input.notes,
    });

    await db.hppHistory.add({
      productId: input.productId,
      oldHpp,
      newHpp: roundedHpp,
      source: 'stock_in',
      date: now,
    });

    await db.products.update(input.productId, {
      stock: newStock,
      hpp: roundedHpp,
      updatedAt: now,
    });

    return { product, quantity: input.quantity, newHpp: roundedHpp };
  });
}

export async function addStockOut(input: StockOutInput) {
  if (!Number.isFinite(input.quantity) || !Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Jumlah stok keluar harus bilangan bulat lebih dari 0');
  }

  return db.transaction('rw', db.stockOuts, db.products, async () => {
    const product = await db.products.get(input.productId);
    if (!product) throw new Error('Produk tidak ditemukan');
    if (input.quantity > product.stock) throw new Error('Jumlah melebihi stok yang tersedia');

    const now = new Date();
    const nextStock = product.stock - input.quantity;

    await db.stockOuts.add({
      productId: input.productId,
      quantity: input.quantity,
      reason: input.reason,
      date: now,
      notes: input.notes,
    });

    await db.products.update(input.productId, {
      stock: nextStock,
      updatedAt: now,
    });

    return { product, quantity: input.quantity };
  });
}
