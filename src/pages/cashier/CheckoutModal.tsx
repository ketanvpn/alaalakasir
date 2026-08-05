import React from 'react';
import { Check, User, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyText } from '@/components/ui/money-text';
import { formatThousandsInput, sanitizeNumericInput } from '@/lib/number-input';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/db';

export interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  paymentMethods: PaymentMethod[];
  paymentMethodId: string;
  onPaymentMethodIdChange: (id: string) => void;
  paymentAmount: string;
  onPaymentAmountChange: (amount: string) => void;
  customerName: string;
  onCustomerNameChange: (val: string) => void;
  tableNumber: string;
  onTableNumberChange: (val: string) => void;
  remarks: string;
  onRemarksChange: (val: string) => void;
  onConfirmCheckout: () => void;
  isSubmitting?: boolean;
}

export function CheckoutModal({
  open,
  onOpenChange,
  total,
  paymentMethods,
  paymentMethodId,
  onPaymentMethodIdChange,
  paymentAmount,
  onPaymentAmountChange,
  customerName,
  onCustomerNameChange,
  tableNumber,
  onTableNumberChange,
  remarks,
  onRemarksChange,
  onConfirmCheckout,
  isSubmitting = false,
}: CheckoutModalProps) {
  const [isQuickAdding, setIsQuickAdding] = React.useState(false);
  const paidAmount = Number(paymentAmount) || 0;
  const change = Math.max(0, paidAmount - total);
  const isValid = paymentMethodId && paidAmount >= total && !isSubmitting;

  const quickNominals = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5 overflow-y-auto max-h-[92vh]">
        <DialogHeader>
          <DialogTitle className="text-center font-bold text-lg">Pembayaran Kasir</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Total Box */}
          <div className="text-center py-3.5 bg-primary/5 border border-primary/20 rounded-2xl">
            <p className="text-xs font-medium text-muted-foreground">Total Tagihan</p>
            <MoneyText value={total} className="text-3xl font-extrabold text-primary block mt-0.5" />
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Metode Pembayaran</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(pm => {
                const isSelected = paymentMethodId === pm.id!.toString();
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => onPaymentMethodIdChange(pm.id!.toString())}
                    className={cn(
                      'p-2.5 rounded-xl text-xs font-bold border-2 transition-all text-center select-none',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {pm.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Amount & Quick Cash */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold text-foreground">Uang Diterima</p>
              <button
                type="button"
                onClick={() => {
                  onPaymentAmountChange('0');
                  setIsQuickAdding(false);
                }}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Reset Uang
              </button>
            </div>

            <Input
              type="text"
              inputMode="numeric"
              value={formatThousandsInput(paymentAmount)}
              onChange={e => {
                onPaymentAmountChange(sanitizeNumericInput(e.target.value));
                setIsQuickAdding(false);
              }}
              placeholder="Contoh: 50.000"
              className="h-11 text-base text-center font-bold rounded-xl border-border/70"
            />

            {/* Quick cash denomination chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickNominals.map(nom => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => {
                    if (!isQuickAdding) {
                      onPaymentAmountChange(String(nom));
                      setIsQuickAdding(true);
                    } else {
                      onPaymentAmountChange(String((Number(paymentAmount) || 0) + nom));
                    }
                  }}
                  className="flex-1 min-w-[calc(25%-6px)] h-8 rounded-lg border border-border/60 bg-muted/30 text-xs font-semibold text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary active:scale-95 transition-all"
                >
                  {nom >= 1000 ? `${nom / 1000}K` : nom}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  onPaymentAmountChange(total.toString());
                  setIsQuickAdding(false);
                }}
                className="flex-1 min-w-[calc(25%-6px)] h-8 rounded-lg border border-primary/40 bg-primary/10 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition-all"
              >
                Uang Pas
              </button>
            </div>
          </div>

          {/* Customer and Table meta */}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Pelanggan (opsional)"
                  value={customerName}
                  onChange={e => onCustomerNameChange(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-lg"
                />
              </div>
              <div className="relative flex-[0.6]">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Meja"
                  value={tableNumber}
                  onChange={e => onTableNumberChange(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-lg"
                />
              </div>
            </div>
            <Input
              placeholder="Catatan transaksi tambahan..."
              value={remarks}
              onChange={e => onRemarksChange(e.target.value)}
              className="h-9 text-xs rounded-lg"
            />
          </div>

          {/* Change Display */}
          {paidAmount >= total && (
            <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Kembalian</span>
              <MoneyText value={change} className="text-base font-extrabold text-emerald-600 dark:text-emerald-400" />
            </div>
          )}

          {/* Confirm Button */}
          <Button
            className="w-full h-12 text-sm font-bold rounded-xl shadow-md"
            onClick={onConfirmCheckout}
            disabled={!isValid}
          >
            <Check className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Memproses Transaksi...' : 'Konfirmasi Pembayaran'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
