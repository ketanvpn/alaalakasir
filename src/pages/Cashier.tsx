import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, ClipboardList, ChevronRight, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { db, type Product, type Transaction, type TransactionItemRecord } from '@/lib/db';
import { checkoutSale, saveOpenBill as saveOpenBillTx, cancelOpenBill as cancelOpenBillTx } from '@/lib/services/salesService';
import { formatThousandsInput, sanitizeNumericInput } from '@/lib/number-input';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MoneyText } from '@/components/ui/money-text';
import Receipt from '@/components/Receipt';
import BarcodeScanner from '@/components/BarcodeScanner';

import { ProductCatalog } from './cashier/ProductCatalog';
import { CartPanel, type CartItem } from './cashier/CartPanel';
import { CheckoutModal } from './cashier/CheckoutModal';
import { OpenBillsSheet } from './cashier/OpenBillsSheet';
import { cn } from '@/lib/utils';

export default function Cashier() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  // Dialog & Sheet States
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [openBillsOpen, setOpenBillsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetTx, setCancelTargetTx] = useState<Transaction | null>(null);

  // Form / Transaction Inputs
  const [txDiscountType, setTxDiscountType] = useState<'percentage' | 'nominal' | null>(null);
  const [txDiscountValue, setTxDiscountValue] = useState('');
  const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [tempDiscountValue, setTempDiscountValue] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completed transaction cache for Receipt modal
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [lastTxItems, setLastTxItems] = useState<TransactionItemRecord[]>([]);

  // DB queries
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const openBills = useLiveQuery(() => db.transactions.where('status').equals('open').reverse().sortBy('date'));

  const cartProductCounts = useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach(item => map.set(item.product.id!, item.qty));
    return map;
  }, [cart]);

  const filteredProducts = useMemo(() => {
    return products?.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
      return matchSearch && matchCategory && (p.stock > 0 || cartProductCounts.has(p.id!));
    }) ?? [];
  }, [products, search, filterCategory, cartProductCounts]);

  const doFullReset = () => {
    setCart([]);
    setEditingTxId(null);
    setTxDiscountType(null);
    setTxDiscountValue('');
    setPaymentMethodId('');
    setPaymentAmount('');
    setCustomerName('');
    setTableNumber('');
    setRemarks('');
    setIsSubmitting(false);
  };

  // Cart operations
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error('Stok tidak mencukupi');
          return prev;
        }
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1, unitPrice: product.price, unitHpp: product.hpp, discountType: null, discountValue: 0 }];
    });
  };

  const handleBarcodeScan = (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const product = products?.find(p => p.barcode?.toLowerCase() === cleanCode);
    if (!product) {
      toast.error(`Produk dengan barcode "${code}" tidak ditemukan`);
      return;
    }
    if (product.stock <= 0) {
      toast.error(`Stok produk "${product.name}" habis`);
      return;
    }
    addToCart(product);
    toast.success(`Ditambahkan: ${product.name}`);
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.qty + delta;
      if (newQty <= 0) return c;
      if (newQty > c.product.stock) {
        toast.error('Stok tidak mencukupi');
        return c;
      }
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  const updateItemNotes = (productId: number, notes: string) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, notes: notes.trim() || undefined } : c));
  };

  const getItemSubtotal = (item: CartItem) => {
    const base = item.unitPrice * item.qty;
    if (item.discountType === 'percentage') {
      const discount = Math.min(base, Math.max(0, base * (item.discountValue / 100)));
      return base - discount;
    }
    if (item.discountType === 'nominal') {
      const discount = Math.min(base, Math.max(0, item.discountValue));
      return base - discount;
    }
    return base;
  };

  const getItemDiscountAmount = (item: CartItem) => {
    const base = item.unitPrice * item.qty;
    if (item.discountType === 'percentage') return Math.min(base, Math.max(0, base * (item.discountValue / 100)));
    if (item.discountType === 'nominal') return Math.min(base, Math.max(0, item.discountValue));
    return 0;
  };

  const buildSaleCartItems = () => cart.map(c => ({
    productId: c.product.id!,
    productName: c.product.name,
    quantity: c.qty,
    price: c.unitPrice,
    hpp: c.unitHpp,
    discountType: c.discountType,
    discountValue: c.discountValue,
    discountAmount: getItemDiscountAmount(c),
    subtotal: getItemSubtotal(c),
    notes: c.notes,
  }));

  const { subtotal, txDiscountAmount, total, paidAmount, totalHpp, totalProfit } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + getItemSubtotal(item), 0);
    const txDiscountRaw = txDiscountType === 'percentage'
      ? sub * (Number(txDiscountValue) || 0) / 100
      : txDiscountType === 'nominal'
      ? Number(txDiscountValue) || 0
      : 0;
    const txDisc = Math.min(sub, Math.max(0, txDiscountRaw));
    const tot = Math.max(0, sub - txDisc);
    const paid = Number(paymentAmount) || 0;
    const hpp = cart.reduce((sum, item) => sum + (item.unitHpp * item.qty), 0);
    const profit = tot - hpp;
    return { subtotal: sub, txDiscountAmount: txDisc, total: tot, paidAmount: paid, totalHpp: hpp, totalProfit: profit };
  }, [cart, txDiscountType, txDiscountValue, paymentAmount]);

  // Open bills handlers
  const saveOpenBill = async () => {
    if (cart.length === 0 || isSubmitting) {
      toast.error('Keranjang belanja kosong');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await saveOpenBillTx({
        editingTxId,
        items: buildSaleCartItems(),
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(editingTxId ? `Bill ${result.transaction.receiptNumber} diperbarui!` : `Bill ${result.transaction.receiptNumber} disimpan!`);
      doFullReset();
      setCartOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadOpenBill = async (tx: Transaction) => {
    if (!tx.id) return;
    const items = await db.transactionItems.where('transactionId').equals(tx.id).toArray();
    const allProducts = await db.products.where('isDeleted').equals(0).toArray();
    const missingItems: string[] = [];

    const cartItems: CartItem[] = items.flatMap(item => {
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) {
        missingItems.push(item.productName);
        return [];
      }
      return [{
        product,
        qty: item.quantity,
        unitPrice: item.price,
        unitHpp: item.hpp,
        discountType: item.discountType as 'percentage' | 'nominal' | null,
        discountValue: item.discountValue,
        notes: item.notes,
      }];
    });

    if (cartItems.length === 0) {
      toast.error('Open bill tidak bisa dibuka karena semua produk sudah tidak tersedia.');
      return;
    }

    if (missingItems.length > 0) {
      toast.warning(`Sebagian item tidak dimuat karena produk telah dihapus: ${missingItems.join(', ')}`);
    }

    setCart(cartItems);
    setEditingTxId(tx.id);
    setTxDiscountType(tx.discountType);
    setTxDiscountValue(tx.discountType ? String(tx.discountValue) : '');
    setCustomerName(tx.customerName || '');
    setTableNumber(tx.tableNumber || '');
    setRemarks(tx.remarks || '');
    setOpenBillsOpen(false);
    setCartOpen(true);
  };

  const cancelOpenBill = async (tx: Transaction) => {
    if (!tx.id) return;
    try {
      await cancelOpenBillTx(tx.id);
      toast.success(`Bill ${tx.receiptNumber} dibatalkan`);
      setCancelDialogOpen(false);
      setCancelTargetTx(null);
      if (editingTxId === tx.id) {
        doFullReset();
        setCartOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membatalkan bill');
    }
  };

  const handleCheckout = async () => {
    if (!paymentMethodId || paidAmount < total || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await checkoutSale({
        editingTxId,
        items: buildSaleCartItems(),
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        paymentMethodId: Number(paymentMethodId),
        paymentAmount: paidAmount,
        change: paidAmount >= total ? paidAmount - total : 0,
        profit: totalProfit,
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      setLastTransaction(result.transaction);
      setLastTxItems(result.items);
      setCheckoutOpen(false);
      setCartOpen(false);
      setReceiptOpen(true);
      doFullReset();
      toast.success('Transaksi penjualan berhasil diselesaikan!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transaksi gagal diproses');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const openBillsParam = searchParams.get('openBills');
    if (openBillsParam === '1') {
      setOpenBillsOpen(true);
      setSearchParams({}, { replace: true });
      return;
    }

    const openBillIdParam = searchParams.get('openBillId');
    if (!openBillIdParam || !openBills || openBills.length === 0) return;
    const txId = Number(openBillIdParam);
    if (!Number.isFinite(txId)) return;

    const targetBill = openBills.find(b => b.id === txId);
    if (!targetBill) {
      toast.error('Open bill tidak ditemukan');
      setSearchParams({}, { replace: true });
      return;
    }

    void loadOpenBill(targetBill);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, openBills]);

  const totalCartQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const openBillsCount = openBills?.length || 0;

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-80px)] gap-4 p-3 md:p-4 max-w-[1600px] mx-auto pb-32 lg:pb-4">
      {/* Product Catalog Lane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">Kasir POS</h1>
            {editingTxId && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                Mode Edit Bill
              </Badge>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenBillsOpen(true)}
            className="relative h-9 text-xs rounded-xl border-border/70 shadow-sm"
          >
            <ClipboardList className="w-4 h-4 mr-1.5 text-primary" />
            Open Bills
            {openBillsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-primary text-primary-foreground rounded-full text-[10px] font-bold">
                {openBillsCount}
              </span>
            )}
          </Button>
        </div>

        <ProductCatalog
          products={filteredProducts}
          categories={categories || []}
          search={search}
          onSearchChange={setSearch}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          onAddToCart={addToCart}
          cartProductCounts={cartProductCounts}
          onOpenScanner={() => setScannerOpen(true)}
          onBarcodeSubmit={handleBarcodeScan}
        />
      </div>

      {/* Desktop Persistent Split-View Cart Sidebar */}
      <div className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 border border-border/70 rounded-2xl overflow-hidden shadow-sm flex-col bg-card h-[calc(100vh-100px)] sticky top-4">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <span className="font-bold text-sm flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Keranjang Belanja
          </span>
          {totalCartQty > 0 && (
            <Badge variant="secondary" className="font-semibold text-xs">
              {totalCartQty} Item
            </Badge>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <CartPanel
            cart={cart}
            editingTxId={editingTxId}
            subtotal={subtotal}
            txDiscountAmount={txDiscountAmount}
            txDiscountType={txDiscountType}
            txDiscountValue={txDiscountValue}
            total={total}
            totalProfit={totalProfit}
            onUpdateQty={updateQty}
            onRemoveItem={removeFromCart}
            onUpdateItemNotes={updateItemNotes}
            onOpenDiscountDialog={() => {
              setTempDiscountType(txDiscountType || 'nominal');
              setTempDiscountValue(txDiscountValue);
              setDiscountDialogOpen(true);
            }}
            onSaveOpenBill={saveOpenBill}
            onOpenCheckout={() => {
              setPaymentAmount(total.toString());
              setCheckoutOpen(true);
            }}
            onCancelOpenBill={() => {
              const tx = openBills?.find(b => b.id === editingTxId);
              if (tx) {
                setCancelTargetTx(tx);
                setCancelDialogOpen(true);
              }
            }}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* Mobile Floating Cart Capsule Pill */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[4.5rem] left-0 right-0 z-[49] px-4 pointer-events-none animate-in slide-in-from-bottom-3 duration-250 ease-out">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <div
              onClick={() => setCartOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCartOpen(true);
                }
              }}
              className="group cursor-pointer w-full h-15 rounded-2xl bg-foreground/95 dark:bg-card/95 text-background dark:text-foreground backdrop-blur-xl border border-white/10 dark:border-border/80 shadow-[0_12px_36px_rgba(0,0,0,0.28)] flex items-center justify-between p-2 pl-3.5 pr-2.5 transition-all active:scale-[0.985] hover:shadow-2xl"
            >
              {/* Left: Cart Icon with Badge & Total Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/30 shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-white dark:bg-zinc-900 text-primary border-2 border-primary text-[11px] font-black flex items-center justify-center shadow-sm">
                    {totalCartQty}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold opacity-75 leading-tight truncate">
                    {totalCartQty} Pesanan • Total
                  </span>
                  <MoneyText
                    value={total}
                    className="text-base font-extrabold tracking-tight text-white dark:text-white leading-tight"
                  />
                </div>
              </div>

              {/* Right: Action Pill Button */}
              <div className="flex items-center gap-1.5 pl-2">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setPaymentAmount(total.toString());
                    setCheckoutOpen(true);
                  }}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  <span>Bayar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="w-8 h-10 rounded-xl bg-white/10 dark:bg-white/5 flex items-center justify-center text-white/80 dark:text-white/80 group-hover:text-white group-hover:bg-white/20 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl max-w-lg mx-auto p-0 flex flex-col">
          <SheetHeader className="p-4 pb-2 border-b border-border">
            <SheetTitle className="text-left flex items-center justify-between text-base">
              <span className="flex items-center gap-2 font-bold">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Keranjang Belanja
              </span>
              <Badge variant="secondary" className="font-semibold text-xs">
                {totalCartQty} Item
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <CartPanel
              cart={cart}
              editingTxId={editingTxId}
              subtotal={subtotal}
              txDiscountAmount={txDiscountAmount}
              txDiscountType={txDiscountType}
              txDiscountValue={txDiscountValue}
              total={total}
              totalProfit={totalProfit}
              onUpdateQty={updateQty}
              onRemoveItem={removeFromCart}
              onUpdateItemNotes={updateItemNotes}
              onOpenDiscountDialog={() => {
                setTempDiscountType(txDiscountType || 'nominal');
                setTempDiscountValue(txDiscountValue);
                setDiscountDialogOpen(true);
              }}
              onSaveOpenBill={saveOpenBill}
              onOpenCheckout={() => {
                setPaymentAmount(total.toString());
                setCheckoutOpen(true);
              }}
              onCancelOpenBill={() => {
                const tx = openBills?.find(b => b.id === editingTxId);
                if (tx) {
                  setCancelTargetTx(tx);
                  setCancelDialogOpen(true);
                }
              }}
              isSubmitting={isSubmitting}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={total}
        paymentMethods={paymentMethods || []}
        paymentMethodId={paymentMethodId}
        onPaymentMethodIdChange={setPaymentMethodId}
        paymentAmount={paymentAmount}
        onPaymentAmountChange={setPaymentAmount}
        customerName={customerName}
        onCustomerNameChange={setCustomerName}
        tableNumber={tableNumber}
        onTableNumberChange={setTableNumber}
        remarks={remarks}
        onRemarksChange={setRemarks}
        onConfirmCheckout={handleCheckout}
        isSubmitting={isSubmitting}
      />

      {/* Open Bills Sheet */}
      <OpenBillsSheet
        open={openBillsOpen}
        onOpenChange={setOpenBillsOpen}
        openBills={openBills}
        onLoadBill={loadOpenBill}
        onCancelBill={(bill) => {
          setCancelTargetTx(bill);
          setCancelDialogOpen(true);
        }}
      />

      {/* Transaction Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">Diskon Transaksi Kasir</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Tipe Diskon</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTempDiscountType('nominal')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border-2 transition-colors',
                    tempDiscountType === 'nominal' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/40 text-muted-foreground'
                  )}
                >
                  Nominal (Rp)
                </button>
                <button
                  type="button"
                  onClick={() => setTempDiscountType('percentage')}
                  className={cn(
                    'p-2.5 rounded-xl text-xs font-bold border-2 transition-colors',
                    tempDiscountType === 'percentage' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/40 text-muted-foreground'
                  )}
                >
                  Persentase (%)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold">
                {tempDiscountType === 'percentage' ? 'Persen Diskon (%)' : 'Nominal Diskon (Rp)'}
              </p>
              <Input
                type="text"
                inputMode="numeric"
                value={tempDiscountType === 'nominal' ? formatThousandsInput(tempDiscountValue) : tempDiscountValue}
                onChange={e => setTempDiscountValue(sanitizeNumericInput(e.target.value))}
                placeholder={tempDiscountType === 'percentage' ? 'Contoh: 10' : 'Contoh: 5.000'}
                className="h-11 text-base font-bold text-center rounded-xl"
              />
              {tempDiscountType === 'percentage' && Number(tempDiscountValue) > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Setara dengan potongan <MoneyText value={Math.min(subtotal, Math.max(0, subtotal * Number(tempDiscountValue) / 100))} className="font-bold text-primary" />
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {txDiscountType && (
                <Button
                  variant="outline"
                  className="h-11 rounded-xl text-destructive border-destructive/30"
                  onClick={() => {
                    setTxDiscountType(null);
                    setTxDiscountValue('');
                    setDiscountDialogOpen(false);
                  }}
                >
                  Hapus Diskon
                </Button>
              )}
              <Button
                className="flex-1 h-11 font-bold rounded-xl"
                onClick={() => {
                  if (Number(tempDiscountValue) > 0) {
                    const normalized = Math.max(0, Number(tempDiscountValue));
                    const capped = tempDiscountType === 'percentage' ? Math.min(100, normalized) : Math.min(subtotal, normalized);
                    setTxDiscountType(tempDiscountType);
                    setTxDiscountValue(String(capped));
                  } else {
                    setTxDiscountType(null);
                    setTxDiscountValue('');
                  }
                  setDiscountDialogOpen(false);
                }}
              >
                Simpan Diskon
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Open Bill Cancellation */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        variant="destructive"
        title="Batalkan Open Bill?"
        description="Tagihan ini akan dihapus permanen dan stok barang akan dikembalikan ke inventaris toko."
        confirmLabel="Ya, Batalkan Bill"
        cancelLabel="Kembali"
        onConfirm={() => {
          if (cancelTargetTx) void cancelOpenBill(cancelTargetTx);
        }}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      {/* Post-Checkout Receipt Modal */}
      {lastTransaction && (
        <Receipt
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={lastTransaction}
          items={lastTxItems}
          storeSettings={storeSettings}
          paymentMethodName={paymentMethods?.find(pm => pm.id === lastTransaction.paymentMethodId)?.name || 'Tunai'}
        />
      )}
    </div>
  );
}
