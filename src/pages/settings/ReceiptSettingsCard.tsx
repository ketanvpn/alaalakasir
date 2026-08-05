import React, { useState } from 'react';
import { Receipt, Printer, Trash2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { db, type StoreSettings } from '@/lib/db';
import {
  clearSavedPrinters,
  PRINTER_DEVICE_ID_KEY,
  PRINTER_SERIAL_ADDRESS_KEY,
} from '@/lib/services/printerService';

export interface ReceiptSettingsCardProps {
  storeSettings?: StoreSettings;
}

export function ReceiptSettingsCard({ storeSettings }: ReceiptSettingsCardProps) {
  const [open, setOpen] = useState(false);
  const [footerText, setFooterText] = useState('');
  const [hasSavedPrinter, setHasSavedPrinter] = useState(() => {
    return Boolean(
      localStorage.getItem(PRINTER_DEVICE_ID_KEY) ||
      localStorage.getItem(PRINTER_SERIAL_ADDRESS_KEY)
    );
  });

  const handleOpen = () => {
    setFooterText(storeSettings?.receiptFooter ?? 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.');
    setHasSavedPrinter(Boolean(
      localStorage.getItem(PRINTER_DEVICE_ID_KEY) ||
      localStorage.getItem(PRINTER_SERIAL_ADDRESS_KEY)
    ));
    setOpen(true);
  };

  const handleSaveFooter = async () => {
    if (storeSettings?.id) {
      try {
        await db.storeSettings.update(storeSettings.id, {
          receiptFooter: footerText.trim(),
        });
        toast.success('Pesan catatan struk berhasil disimpan');
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan catatan struk');
      }
    }
  };

  const handleResetPrinter = () => {
    clearSavedPrinters();
    setHasSavedPrinter(false);
    toast.success('Printer tersimpan berhasil direset. Pada pencetakan berikutnya, aplikasi akan mencari printer baru.');
  };

  return (
    <>
      <Card
        onClick={handleOpen}
        className="border border-border/70 shadow-sm rounded-2xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
      >
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Pengaturan Struk & Printer</p>
              <p className="text-[10px] text-muted-foreground">Footer struk belanja & reset printer Bluetooth</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary font-semibold">
            Buka
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold flex items-center justify-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              Pengaturan Struk & Printer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Bluetooth Printer Section */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold">Status Printer Bluetooth</span>
                </div>
                {hasSavedPrinter ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Tersambung
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Belum tersimpan
                  </span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {hasSavedPrinter
                  ? 'Aplikasi telah mengingat perangkat printer thermal Bluetooth Anda untuk pencetakan otomatis.'
                  : 'Printer akan dipilih dan disimpan otomatis saat pertama kali Anda menekan tombol Cetak Struk di kasir.'}
              </p>

              {hasSavedPrinter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPrinter}
                  className="w-full h-8 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Lupakan / Ganti Printer Bluetooth
                </Button>
              )}
            </div>

            {/* Receipt Footer Message */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pesan / Catatan di Bawah Struk (Footer)</Label>
              <Textarea
                value={footerText}
                onChange={e => setFooterText(e.target.value)}
                placeholder="Contoh: Terima kasih atas kunjungan Anda!..."
                className="text-xs rounded-xl min-h-[90px] resize-none"
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground">
                Teks ini akan dicetak di bagian paling bawah struk kasir & format gambar struk digital.
              </p>
            </div>

            <Button
              className="w-full h-11 text-sm font-bold rounded-xl mt-2 shadow-md shadow-primary/20"
              onClick={handleSaveFooter}
            >
              Simpan Pengaturan Struk
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
