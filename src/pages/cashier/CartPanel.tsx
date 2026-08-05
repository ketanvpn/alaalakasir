import React, { useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Pencil, Percent, Save, CreditCard, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MoneyText } from '@/components/ui/money-text';
import type { Product } from '@/lib/db';

export interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
  unitHpp: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  notes?: string;
}

export interface CartPanelProps {
  cart: CartItem[];
  editingTxId: number | null;
  subtotal: number;
  txDiscountAmount: number;
  txDiscountType: 'percentage' | 'nominal' | null;
  txDiscountValue: string;
  total: number;
  totalProfit: number;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onUpdateItemNotes: (productId: number, notes: string) => void;
  onOpenDiscountDialog: () => void;
  onSaveOpenBill: () => void;
  onOpenCheckout: () => void;
  onCancelOpenBill?: () => void;
  isSubmitting?: boolean;
}

export function CartPanel({
  cart,
  editingTxId,
  subtotal,
  txDiscountAmount,
  txDiscountType,
  txDiscountValue,
  total,
  totalProfit,
  onUpdateQty,
  onRemoveItem,
  onUpdateItemNotes,
  onOpenDiscountDialog,
  onSaveOpenBill,
  onOpenCheckout,
  onCancelOpenBill,
  isSubmitting = false,
}: CartPanelProps) {
  const [editingItemNotes, setEditingItemNotes] = useState<number | null>(null);
  const [tempNotes, setTempNotes] = useState('');

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

  const startEditNotes = (item: CartItem) => {
    setEditingItemNotes(item.product.id!);
    setTempNotes(item.notes || '');
  };

  const saveItemNotes = (productId: number) => {
    onUpdateItemNotes(productId, tempNotes);
    setEditingItemNotes(null);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {cart.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-semibold text-foreground">Keranjang Belanja Kosong</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Ketuk produk di sebelah kiri untuk menambahkannya ke keranjang
            </p>
          </div>
        ) : (
          cart.map(item => {
            const itemTotal = getItemSubtotal(item);
            const isEditingNote = editingItemNotes === item.product.id;

            return (
              <div
                key={item.product.id}
                className="p-3 bg-muted/40 rounded-xl border border-border/50 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs text-foreground truncate">{item.product.name}</h4>
                    <MoneyText value={item.unitPrice} className="text-[11px] text-muted-foreground" />
                  </div>
                  <MoneyText value={itemTotal} className="text-xs font-bold text-foreground shrink-0" />
                </div>

                {/* Notes section */}
                {isEditingNote ? (
                  <div className="flex gap-1.5 items-center">
                    <Input
                      size={1}
                      placeholder="Catatan pesanan..."
                      value={tempNotes}
                      onChange={e => setTempNotes(e.target.value)}
                      className="h-8 text-xs flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => saveItemNotes(item.product.id!)}
                    >
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => startEditNotes(item)}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 py-0.5"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      {item.notes ? (
                        <span className="italic text-foreground font-medium truncate max-w-[150px]">
                          {item.notes}
                        </span>
                      ) : (
                        '+ Catatan'
                      )}
                    </button>
                  </div>
                )}

                {/* Qty and Remove Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                    onClick={() => onRemoveItem(item.product.id!)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  <div className="flex items-center gap-2 bg-background rounded-lg border border-border/60 p-0.5 shadow-sm">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md"
                      onClick={() => onUpdateQty(item.product.id!, -1)}
                      disabled={item.qty <= 1}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-xs font-bold w-6 text-center tabular-nums">{item.qty}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md"
                      onClick={() => onUpdateQty(item.product.id!, 1)}
                      disabled={item.qty >= item.product.stock}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Summary & Actions */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-border bg-card space-y-3 shrink-0 shadow-lg">
          {/* Subtotal & Discounts */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({cart.reduce((a, b) => a + b.qty, 0)} item)</span>
              <MoneyText value={subtotal} />
            </div>

            {txDiscountAmount > 0 && (
              <div className="flex justify-between text-destructive font-medium">
                <span>
                  Diskon {txDiscountType === 'percentage' ? `(${txDiscountValue}%)` : ''}
                </span>
                <MoneyText value={-txDiscountAmount} />
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
              <span>Total Tagihan</span>
              <MoneyText value={total} className="text-primary text-lg" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
              onClick={onOpenDiscountDialog}
            >
              <Percent className="w-3.5 h-3.5 mr-1.5" />
              {txDiscountAmount > 0 ? 'Ubah Diskon Transaksi' : 'Tambah Diskon Transaksi'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-xl text-xs font-semibold"
                onClick={onSaveOpenBill}
                disabled={isSubmitting}
              >
                <Save className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                {editingTxId ? 'Update Bill' : 'Simpan Bill'}
              </Button>
              <Button
                className="h-11 rounded-xl text-xs font-bold shadow-md shadow-primary/20"
                onClick={onOpenCheckout}
                disabled={isSubmitting}
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Bayar Sekarang
              </Button>
            </div>

            {editingTxId && onCancelOpenBill && (
              <Button
                variant="ghost"
                className="w-full h-8 text-xs text-destructive hover:bg-destructive/10"
                onClick={onCancelOpenBill}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Batalkan Open Bill Ini
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
