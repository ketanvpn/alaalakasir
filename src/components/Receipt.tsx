import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import { Download, Share2, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/lib/db';

interface ReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  paymentMethodName: string;
}

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
const PRINTER_DEVICE_ID_KEY = 'alaalakasir_ble_printer_device_id';

export default function Receipt({ open, onClose, transaction, items, storeSettings, paymentMethodName }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

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
    const buildEscPosPayload = () => {
      const encoder = new TextEncoder();
      const lines: string[] = [];

      lines.push('\x1B\x61\x01');
      lines.push(`${storeSettings?.storeName || 'Toko'}\n`);
      if (storeSettings?.address) lines.push(`${storeSettings.address}\n`);
      if (storeSettings?.phone) lines.push(`${storeSettings.phone}\n`);
      lines.push('--------------------------------\n');
      lines.push(`No: ${transaction.receiptNumber}\n`);
      lines.push(`${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}\n`);
      lines.push(`Metode: ${paymentMethodName}\n`);
      lines.push('--------------------------------\n');

      lines.push('\x1B\x61\x00');
      for (const item of items) {
        lines.push(`${item.productName}\n`);
        if (item.notes) lines.push(`  ${item.notes}\n`);
        lines.push(`  ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')}  Rp ${item.subtotal.toLocaleString('id-ID')}\n`);
      }

      lines.push('--------------------------------\n');
      lines.push(`Subtotal:  Rp ${transaction.subtotal.toLocaleString('id-ID')}\n`);
      if (transaction.discountAmount > 0) {
        lines.push(`Diskon:   -Rp ${transaction.discountAmount.toLocaleString('id-ID')}\n`);
      }
      lines.push(`TOTAL:     Rp ${transaction.total.toLocaleString('id-ID')}\n`);
      lines.push(`Bayar:     Rp ${transaction.paymentAmount.toLocaleString('id-ID')}\n`);
      lines.push(`Kembali:   Rp ${transaction.change.toLocaleString('id-ID')}\n`);
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x01');
      lines.push(`${storeSettings?.receiptFooter || 'Terima kasih!'}\n\n\n`);
      return encoder.encode(lines.join(''));
    };

    const toDataView = (bytes: Uint8Array) => new DataView(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

    const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    if (isAndroidNative) {
      try {
        await BluetoothLe.initialize();
        try {
          await BluetoothLe.requestEnable();
        } catch {
          // requestEnable can be cancelled if already enabled
        }

        let deviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY) || '';

        if (!deviceId) {
          toast.info('Pilih printer Bluetooth thermal 58mm...');
          const device = await BluetoothLe.requestDevice({});
          deviceId = device.deviceId;
          localStorage.setItem(PRINTER_DEVICE_ID_KEY, deviceId);
        }

        toast.info('Menghubungkan printer Bluetooth...');
        await BluetoothLe.connect(deviceId);

        let serviceUuid = PRINTER_SERVICE_UUID;
        let characteristicUuid = PRINTER_CHARACTERISTIC_UUID;
        let useWriteWithoutResponse = true;

        try {
          const services = (await BluetoothLe.getServices(deviceId)) as any[];
          let selected: { service: string; characteristic: string; useWriteWithoutResponse: boolean } | null = null;

          for (const service of services ?? []) {
            for (const characteristic of service.characteristics ?? []) {
              const p = characteristic.properties ?? {};
              if (p.writeWithoutResponse) {
                selected = {
                  service: service.uuid,
                  characteristic: characteristic.uuid,
                  useWriteWithoutResponse: true,
                };
                break;
              }
              if (!selected && p.write) {
                selected = {
                  service: service.uuid,
                  characteristic: characteristic.uuid,
                  useWriteWithoutResponse: false,
                };
              }
            }
            if (selected?.useWriteWithoutResponse) break;
          }

          if (selected) {
            serviceUuid = selected.service;
            characteristicUuid = selected.characteristic;
            useWriteWithoutResponse = selected.useWriteWithoutResponse;
          }
        } catch {
          // fallback ke UUID default jika service discovery gagal
        }

        const payload = buildEscPosPayload();
        for (let i = 0; i < payload.length; i += 180) {
          const chunk = payload.slice(i, i + 180);
          if (useWriteWithoutResponse) {
            await BluetoothLe.writeWithoutResponse(deviceId, serviceUuid, characteristicUuid, toDataView(chunk));
          } else {
            await BluetoothLe.write(deviceId, serviceUuid, characteristicUuid, toDataView(chunk));
          }
        }

        await BluetoothLe.disconnect(deviceId);
        toast.success('Struk berhasil dicetak ke printer Bluetooth!');
        return;
      } catch {
        try {
          const savedDeviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY);
          if (savedDeviceId) await BluetoothLe.disconnect(savedDeviceId);
        } catch {
          // ignore
        }
        localStorage.removeItem(PRINTER_DEVICE_ID_KEY);
        toast.error('Gagal cetak Bluetooth native. Pastikan printer BLE aktif dan coba pilih ulang printer.');
        return;
      }
    }

    if (!('bluetooth' in navigator)) {
      const canvas = await captureReceipt();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const frameName = 'receipt-print-frame';
      let frame = document.getElementById(frameName) as HTMLIFrameElement | null;

      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = frameName;
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        frame.style.visibility = 'hidden';
        document.body.appendChild(frame);
      }

      const doc = frame.contentWindow?.document;
      if (!doc) {
        toast.error('Gagal membuka mode cetak di perangkat ini.');
        return;
      }

      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Cetak Struk</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              html, body { margin: 0; padding: 0; background: #fff; }
              .wrap { display: flex; justify-content: center; padding: 12px; }
              img { width: 280px; max-width: 100%; height: auto; }
              @media print {
                .wrap { padding: 0; }
                img { width: 280px; }
              }
            </style>
          </head>
          <body>
            <div class="wrap"><img src="${dataUrl}" alt="Struk" /></div>
          </body>
        </html>
      `);
      doc.close();

      frame.contentWindow?.focus();
      setTimeout(() => {
        frame?.contentWindow?.print();
      }, 150);

      toast.success('Membuka dialog cetak...');
      return;
    }

    try {
      toast.info('Mencari printer Bluetooth...');
      // @ts-expect-error Web Bluetooth API is not fully typed in TypeScript
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE_UUID] }],
        optionalServices: [PRINTER_SERVICE_UUID],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);
      const data = buildEscPosPayload();
      
      // Send in chunks of 100 bytes
      for (let i = 0; i < data.length; i += 100) {
        const chunk = data.slice(i, i + 100);
        await characteristic.writeValue(chunk);
      }

      toast.success('Struk berhasil dicetak!');
      await server.disconnect();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        toast.error('Gagal mencetak. Pastikan printer Bluetooth menyala.');
      }
    }
  };

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
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

        <Button variant="secondary" className="w-full mt-1" onClick={onClose}>
          Selesai
        </Button>
      </DialogContent>
    </Dialog>
  );
}
