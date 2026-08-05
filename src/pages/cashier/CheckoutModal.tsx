import React, { useState } from 'react';
import { Check, User, Hash, Calendar, AlertCircle, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MoneyText } from '@/components/ui/money-text';
import { formatThousandsInput, sanitizeNumericInput } from '@/lib/number-input';
import { cn } from '@/lib/utils';
import type { PaymentMethod, Customer } from '@/lib/db';

export interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  paymentMethods: PaymentMethod[];
  paymentMethodId: string;
  onPaymentMethodIdChange: (id: string) => void;
  paymentAmount: string;
  onPaymentAmountChange: (amount: string) => void;
  customerId: number | null;
  onCustomerIdChange: (id: number | null) => void;
  customerName: string;
  onCustomerNameChange: (val: string) => void;
  tableNumber: string;
  onTableNumberChange: (val: string) => void;
  remarks: string;
  onRemarksChange: (val: string) => void;
  isKasbon: boolean;
  onIsKasbonChange: (val: boolean) => void;
  dueDate: string;
  onDueDateChange: (val: string) => void;
  customers: Customer[];
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
  customerId,
  onCustomerIdChange,
  customerName,
  onCustomerNameChange,
  tableNumber,
  onTableNumberChange,
  remarks,
  onRemarksChange,
  isKasbon,
  onIsKasbonChange,
  dueDate,
  onDueDateChange,
  customers = [],
  onConfirmCheckout,
  isSubmitting = false,
}: CheckoutModalProps) {
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const paidAmount = Number(paymentAmount) || 0;
  const change = Math.max(0, paidAmount - total);
  
  const selectedCustomer = customers.find(c => c.id === customerId);

  // Validation logic
  const isKasbonValid = isKasbon && (Boolean(customerId) || Boolean(customerName.trim()));
  const isRegularPaymentValid = !isKasbon && Boolean(paymentMethodId) && paidAmount >= total;
  const isValid = (isKasbonValid || isRegularPaymentValid) && !isSubmitting;

  const quickNominals = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5 overflow-y-auto max-h-[92vh]">
        <DialogHeader>
          <DialogTitle className="text-center font-bold text-lg">Pembayaran Kasir</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Total Tagihan Box */}
          <div className="text-center py-3.5 bg-primary/5 border border-primary/20 rounded-2xl">
            <p className="text-xs font-medium text-muted-foreground">Total Tagihan</p>
            <MoneyText value={total} className="text-3xl font-extrabold text-primary block mt-0.5" />
          </div>

          {/* Kasbon / Hutang Toggle Banner */}
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Catat Sebagai Kasbon / Hutang</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">Bayar tempo / hutang pelanggan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !isKasbon;
                onIsKasbonChange(next);
                if (next) {
                  onPaymentAmountChange('0');
                } else {
                  onPaymentAmountChange(total.toString());
                }
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                isKasbon
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-background border border-border text-foreground hover:bg-muted'
              )}
            >
              {isKasbon ? 'Kasbon Aktif' : 'Aktifkan'}
            </button>
          </div>

          {/* Customer Selection Box */}
          <div className="space-y-1.5 relative">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Pelanggan {isKasbon && <span className="text-destructive">*</span>}
              </label>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    onCustomerIdChange(null);
                    onCustomerNameChange('');
                  }}
                  className="text-[10px] text-destructive hover:underline"
                >
                  Ganti Pelanggan
                </button>
              )}
            </div>

            {selectedCustomer ? (
              <div className="p-2.5 bg-muted/60 border border-border/80 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedCustomer.phone || 'Tanpa no. telp'}</p>
                </div>
                {selectedCustomer.totalDebt > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 font-bold">
                    Hutang: <MoneyText value={selectedCustomer.totalDebt} className="ml-1" />
                  </Badge>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    placeholder="Ketik nama pelanggan baru atau cari..."
                    value={customerName || customerSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomerSearch(val);
                      onCustomerNameChange(val);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="h-10 text-xs rounded-xl pr-8"
                  />
                  {customers.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomerDropdown(prev => !prev)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-[10px] font-semibold text-primary"
                    >
                      Daftar
                    </Button>
                  )}
                </div>

                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto p-1">
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onCustomerIdChange(c.id!);
                          onCustomerNameChange(c.name);
                          setShowCustomerDropdown(false);
                        }}
                        className="p-2 hover:bg-muted/80 rounded-lg cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.phone || c.address || 'Pelanggan'}</p>
                        </div>
                        {c.totalDebt > 0 && (
                          <span className="text-[10px] font-bold text-destructive">
                            Hutang: Rp {c.totalDebt.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Conditional: If Kasbon is active */}
          {isKasbon ? (
            <div className="space-y-3 p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  Jatuh Tempo Pembayaran (Opsional)
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => onDueDateChange(e.target.value)}
                  className="h-10 text-xs rounded-xl bg-background border-border/70"
                />
              </div>

              <div className="p-2.5 bg-amber-500/10 rounded-lg flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Transaksi sebesar <MoneyText value={total} className="font-bold" /> akan dicatat ke buku piutang pelanggan dan dapat dilunasi/dicicil kapan saja melalui menu <b>Pelanggan & Kasbon</b>.
                </p>
              </div>
            </div>
          ) : (
            <>
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

              {/* Change Display */}
              {paidAmount >= total && (
                <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Kembalian</span>
                  <MoneyText value={change} className="text-base font-extrabold text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
            </>
          )}

          {/* Table & Remarks meta */}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nomor Meja / Order (opsional)"
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

          {/* Confirm Button */}
          <Button
            className={cn(
              'w-full h-12 text-sm font-bold rounded-xl shadow-md transition-all',
              isKasbon ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20' : ''
            )}
            onClick={onConfirmCheckout}
            disabled={!isValid}
          >
            <Check className="w-4 h-4 mr-2" />
            {isSubmitting
              ? 'Memproses Transaksi...'
              : isKasbon
              ? 'Simpan Transaksi Kasbon'
              : 'Konfirmasi Pembayaran'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
