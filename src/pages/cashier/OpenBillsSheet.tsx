import React from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ClipboardList, Trash2, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoneyText } from '@/components/ui/money-text';
import type { Transaction } from '@/lib/db';

export interface OpenBillsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openBills: Transaction[] | undefined;
  onLoadBill: (bill: Transaction) => void;
  onCancelBill: (bill: Transaction) => void;
}

export function OpenBillsSheet({
  open,
  onOpenChange,
  openBills,
  onLoadBill,
  onCancelBill,
}: OpenBillsSheetProps) {
  const count = openBills?.length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg md:max-w-xl mx-auto p-4 flex flex-col">
        <SheetHeader className="pb-2 border-b border-border">
          <SheetTitle className="text-left flex items-center justify-between">
            <span className="flex items-center gap-2 text-base font-bold">
              <ClipboardList className="w-5 h-5 text-primary" />
              Daftar Tagihan Terbuka (Open Bills)
            </span>
            <Badge variant="secondary" className="font-semibold text-xs">
              {count} Bill
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {!openBills || openBills.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-foreground">Tidak Ada Open Bill</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Semua pesanan tersimpan atau belum ada tagihan yang dipending.
              </p>
            </div>
          ) : (
            openBills.map(bill => (
              <Card key={bill.id} className="border border-border/60 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono font-bold bg-muted/50">
                        {bill.receiptNumber}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {bill.openedAt ? format(new Date(bill.openedAt), 'dd MMM HH:mm', { locale: localeId }) : ''}
                      </span>
                    </div>
                    <MoneyText value={bill.total} className="text-sm font-bold text-primary" />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3 bg-muted/30 p-2 rounded-lg">
                    {bill.customerName && <span>👤 {bill.customerName}</span>}
                    {bill.tableNumber && <span>🪑 Meja {bill.tableNumber}</span>}
                    {bill.remarks && <span className="truncate max-w-[200px]">📝 {bill.remarks}</span>}
                    {!bill.customerName && !bill.tableNumber && !bill.remarks && (
                      <span className="italic text-[11px]">Tanpa nama pelanggan / meja</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-9 text-xs font-semibold flex-1 rounded-lg"
                      onClick={() => onLoadBill(bill)}
                    >
                      Buka & Lanjutkan
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg"
                      onClick={() => onCancelBill(bill)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
