import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Download, Share2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/lib/db';
import {
  PRINTER_DEVICE_ID_KEY,
  PRINTER_SERIAL_ADDRESS_KEY,
  clearSavedPrinters,
  printViaBluetoothSerial,
  printViaBle,
  printViaWebBluetooth,
  printViaIframe,
  type BluetoothPrinterCandidate,
} from '@/lib/services/printerService';
import { BleClient } from '@capacitor-community/bluetooth-le';

interface ReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  paymentMethodName: string;
}

export default function Receipt({ open, onClose, transaction, items, storeSettings, paymentMethodName }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);
  const [printerCandidates, setPrinterCandidates] = useState<BluetoothPrinterCandidate[]>([]);

  const resetSavedPrinter = () => {
    clearSavedPrinters();
    toast.success('Printer tersimpan dihapus. Cetak berikutnya akan pilih printer lagi.');
  };

  const captureReceipt = async (): Promise<HTMLCanvasElement | null> => {
    if (!receiptRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas;
    } catch {
      toast.error('Gagal membuat gambar struk');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const canvas = await captureReceipt();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `struk-${transaction.receiptNumber}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Struk berhasil diunduh');
  };

  const handleShare = async () => {
    const canvas = await captureReceipt();
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      if (navigator.share) {
        const file = new File([blob], `struk-${transaction.receiptNumber}.png`, { type: 'image/png' });
        await navigator.share({
          title: `Struk ${transaction.receiptNumber}`,
          text: `Struk dari ${storeSettings?.storeName || 'Toko'}`,
          files: [file],
        });
      } else {
        // Fallback: open WhatsApp with text
        const text = encodeURIComponent(
          `*${storeSettings?.storeName || 'Toko'}*\nStruk: ${transaction.receiptNumber}\nTotal: Rp ${transaction.total.toLocaleString('id-ID')}\nTanggal: ${format(new Date(transaction.date), 'dd MMM yyyy HH:mm', { locale: id })}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Gagal membagikan struk');
      }
    }
  };

  const handleBluetoothPrint = async () => {
    const printData = {
      transaction,
      items,
      storeSettings,
      paymentMethodName,
    };

    const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    if (isAndroidNative) {
      // 1. Coba Bluetooth Serial (Classic SPP)
      try {
        const res = await printViaBluetoothSerial(printData);
        if (res.needPicker && res.candidates?.length) {
          setPrinterCandidates(res.candidates);
          setPrinterPickerOpen(true);
          toast.info('Pilih printer Bluetooth terlebih dahulu.');
          return;
        }
        if (res.success) {
          toast.success(res.message || 'Struk berhasil dicetak!');
          return;
        }
      } catch {
        localStorage.removeItem(PRINTER_SERIAL_ADDRESS_KEY);
      }

      // 2. Coba Bluetooth Low Energy (BLE)
      try {
        toast.info('Menghubungkan printer Bluetooth...');
        const res = await printViaBle(printData);
        if (res.success) {
          toast.success(res.message || 'Struk berhasil dicetak!');
          return;
        }
      } catch {
        try {
          const savedDeviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY);
          if (savedDeviceId) await BleClient.disconnect(savedDeviceId);
        } catch {
          // ignore
        }
        localStorage.removeItem(PRINTER_DEVICE_ID_KEY);
        toast.error('Gagal cetak Bluetooth native. Pastikan printer BLE aktif dan coba pilih ulang printer.');
        return;
      }
    }

    // 3. Fallback Web Desktop/Browser: Print via iframe dialog jika Web Bluetooth tidak tersedia
    if (!('bluetooth' in navigator)) {
      const canvas = await captureReceipt();
      if (!canvas) return;
      try {
        printViaIframe(canvas.toDataURL('image/png'));
        toast.success('Membuka dialog cetak...');
      } catch {
        toast.error('Gagal membuka mode cetak di perangkat ini.');
      }
      return;
    }

    // 4. Web Bluetooth API untuk browser yang mendukung
    try {
      toast.info('Mencari printer Bluetooth...');
      const res = await printViaWebBluetooth(printData);
      if (res.success) {
        toast.success(res.message || 'Struk berhasil dicetak!');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        toast.error('Gagal mencetak. Pastikan printer Bluetooth menyala.');
      }
    }
  };

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl p-4">
          <DialogHeader>
            <DialogTitle className="text-center">Struk Transaksi</DialogTitle>
          </DialogHeader>

          {/* Receipt preview - this gets captured as image */}
          <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg mx-auto" style={{ width: '280px', fontFamily: 'monospace', fontSize: '12px' }}>
            {/* Store Header */}
            <div className="text-center mb-2">
              {storeSettings?.logo && (
                <img src={storeSettings.logo} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-1" />
              )}
              <p className="font-bold text-sm">{storeSettings?.storeName || 'Toko'}</p>
              {storeSettings?.address && <p className="text-[10px]">{storeSettings.address}</p>}
              {storeSettings?.phone && <p className="text-[10px]">{storeSettings.phone}</p>}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Receipt info */}
            <div className="flex justify-between text-[10px]">
              <span>No: {transaction.receiptNumber}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-start gap-2 text-[10px] mb-1">
              <span className="truncate">{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm', { locale: id })}</span>
              <span className="text-right whitespace-nowrap">{paymentMethodName}</span>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Items */}
            {items.map((item, i) => (
              <div key={i} className="mb-1">
                <p className="text-[11px] font-medium break-words">{item.productName}</p>
                {item.notes && <p className="text-[9px] text-gray-500 italic">  {item.notes}</p>}
                <div className="flex justify-between text-[10px]">
                  <span>{item.quantity} x {rp(item.price)}</span>
                  <span>{rp(item.subtotal)}</span>
                </div>
                {item.discountAmount > 0 && (
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>  Diskon</span>
                    <span>-{rp(item.discountAmount)}</span>
                  </div>
                )}
              </div>
            ))}

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Totals */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{rp(transaction.subtotal)}</span>
              </div>
              {transaction.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>Diskon</span>
                  <span>-{rp(transaction.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs border-t border-dashed border-gray-400 pt-1 mt-1">
                <span>TOTAL</span>
                <span>{rp(transaction.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bayar</span>
                <span>{rp(transaction.paymentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kembali</span>
                <span>{rp(transaction.change)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Footer */}
            <p className="text-center text-[10px] text-gray-500">
              {storeSettings?.receiptFooter || 'Terima kasih atas kunjungan Anda!'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3" onClick={handleDownload} disabled={generating}>
              <Download className="w-5 h-5" />
              <span className="text-[10px]">Unduh</span>
            </Button>
            <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3" onClick={handleShare} disabled={generating}>
              <Share2 className="w-5 h-5" />
              <span className="text-[10px]">Bagikan</span>
            </Button>
            <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3" onClick={handleBluetoothPrint} disabled={generating}>
              <Printer className="w-5 h-5" />
              <span className="text-[10px]">Cetak</span>
            </Button>
          </div>

          <Button variant="ghost" className="w-full h-8 text-xs text-muted-foreground" onClick={resetSavedPrinter}>
            Ganti Printer Bluetooth
          </Button>

          <Button variant="secondary" className="w-full mt-1" onClick={onClose}>
            Selesai
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={printerPickerOpen} onOpenChange={setPrinterPickerOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Pilih Printer Bluetooth</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-[45vh] overflow-y-auto">
            {printerCandidates.map((printer) => (
              <Button
                key={printer.address}
                type="button"
                variant="outline"
                className="w-full h-auto py-2 px-3 justify-start text-left"
                onClick={() => {
                  localStorage.setItem(PRINTER_SERIAL_ADDRESS_KEY, printer.address);
                  setPrinterPickerOpen(false);
                  toast.success(`Printer dipilih: ${printer.name}`);
                  setTimeout(() => {
                    void handleBluetoothPrint();
                  }, 150);
                }}
              >
                <span className="text-xs leading-5">
                  <strong>{printer.name}</strong><br />
                  <span className="text-muted-foreground">{printer.address}</span>
                </span>
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Setelah memilih printer, tekan tombol Cetak lagi.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
