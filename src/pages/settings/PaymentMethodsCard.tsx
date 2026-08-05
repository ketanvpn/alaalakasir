import React, { useState } from 'react';
import { CreditCard, Plus, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { db, type PaymentMethod } from '@/lib/db';
import { cn } from '@/lib/utils';

export interface PaymentMethodsCardProps {
  paymentMethods?: PaymentMethod[];
  paymentMethodUsage?: Record<number, number>;
}

export function PaymentMethodsCard({ paymentMethods = [], paymentMethodUsage = {} }: PaymentMethodsCardProps) {
  const [pmDialog, setPmDialog] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId, setPmEditId] = useState<number | null>(null);
  const [deletePmConfirmOpen, setDeletePmConfirmOpen] = useState(false);
  const [pendingDeletePmId, setPendingDeletePmId] = useState<number | null>(null);

  const openPmAdd = () => {
    setPmEditId(null);
    setPmName('');
    setPmCategory('tunai');
    setPmDialog(true);
  };

  const openPmEdit = (pm: PaymentMethod) => {
    setPmEditId(pm.id!);
    setPmName(pm.name);
    setPmCategory(pm.category);
    setPmDialog(true);
  };

  const savePm = async () => {
    if (!pmName.trim()) return;
    try {
      if (pmEditId) {
        await db.paymentMethods.update(pmEditId, { name: pmName.trim(), category: pmCategory });
      } else {
        await db.paymentMethods.add({
          name: pmName.trim(),
          category: pmCategory,
          isDefault: false,
          createdAt: new Date(),
        });
      }
      setPmDialog(false);
      toast.success('Metode pembayaran berhasil disimpan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan metode pembayaran');
    }
  };

  const getPaymentMethodDeleteBlockReason = (id: number) => {
    if (paymentMethods.length <= 1) return 'Minimal harus ada 1 metode pembayaran aktif';
    if ((paymentMethodUsage[id] ?? 0) > 0) {
      return 'Metode pembayaran tidak dapat dihapus karena sudah dipakai dalam riwayat transaksi';
    }
    return null;
  };

  const requestDeletePm = (id: number) => {
    const reason = getPaymentMethodDeleteBlockReason(id);
    if (reason) {
      toast.error(reason);
      return;
    }
    setPendingDeletePmId(id);
    setDeletePmConfirmOpen(true);
  };

  const confirmDeletePm = async () => {
    if (!pendingDeletePmId) return;
    try {
      await db.paymentMethods.delete(pendingDeletePmId);
      toast.success('Metode pembayaran berhasil dihapus');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus metode pembayaran');
    } finally {
      setDeletePmConfirmOpen(false);
      setPendingDeletePmId(null);
    }
  };

  return (
    <>
      <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Metode Pembayaran
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-xl border-border/70 font-semibold gap-1"
            onClick={openPmAdd}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah
          </Button>
        </CardHeader>

        <CardContent className="p-4 pt-2 space-y-2">
          {paymentMethods.map(pm => {
            const usageCount = paymentMethodUsage[pm.id!] ?? 0;
            return (
              <div
                key={pm.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50"
              >
                <div>
                  <p className="text-xs font-bold text-foreground">{pm.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {pm.category} • {usageCount} transaksi
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary"
                    onClick={() => openPmEdit(pm)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                    onClick={() => requestDeletePm(pm.id!)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">
              {pmEditId ? 'Edit' : 'Tambah'} Metode Pembayaran
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Pembayaran</Label>
              <Input
                value={pmName}
                onChange={e => setPmName(e.target.value)}
                placeholder="Contoh: QRIS GoPay / BCA Transfer"
                className="h-10 text-sm rounded-xl"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kategori Pembayaran</Label>
              <div className="grid grid-cols-4 gap-2">
                {['tunai', 'transfer', 'e-wallet', 'qris'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPmCategory(c)}
                    className={cn(
                      'p-2.5 rounded-xl text-xs font-bold border-2 capitalize transition-colors',
                      pmCategory === c
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full h-11 text-sm font-bold rounded-xl mt-2"
              onClick={savePm}
              disabled={!pmName.trim()}
            >
              Simpan Metode
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletePmConfirmOpen}
        onOpenChange={setDeletePmConfirmOpen}
        variant="destructive"
        title="Hapus Metode Pembayaran?"
        description="Metode pembayaran ini akan dihapus dari pilihan kasir."
        confirmLabel="Ya, Hapus"
        onConfirm={confirmDeletePm}
      />
    </>
  );
}
