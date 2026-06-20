import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { BleClient, type BleCharacteristicProperties } from '@capacitor-community/bluetooth-le';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import type { BluetoothDevice } from '@e-is/capacitor-bluetooth-serial';
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
const PRINTER_SERIAL_ADDRESS_KEY = 'alaalakasir_bt_serial_address';

export default function Receipt({ open, onClose, transaction, items, storeSettings, paymentMethodName }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);
  const [printerCandidates, setPrinterCandidates] = useState<Array<{ address: string; name: string }>>([]);

  const resetSavedPrinter = () => {
    localStorage.removeItem(PRINTER_SERIAL_ADDRESS_KEY);
    localStorage.removeItem(PRINTER_DEVICE_ID_KEY);
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
    const buildEscPosText = () => {
      const PAPER_WIDTH = 32;
      const hr = '-'.repeat(PAPER_WIDTH);
      const safe = (text: string) => (text || '').replace(/\s+/g, ' ').trim();
      const lineCenter = (text: string) => `${safe(text)}\n`;
      const lineKV = (label: string, value: string) => {
        const l = safe(label);
        const v = safe(value);
        const spaces = Math.max(1, PAPER_WIDTH - l.length - v.length);
        return `${l}${' '.repeat(spaces)}${v}\n`;
      };
      const fit = (text: string, max = PAPER_WIDTH) => {
        const clean = safe(text);
        if (clean.length <= max) return clean;
        return `${clean.slice(0, Math.max(0, max - 1))}…`;
      };

      const lines: string[] = [];

      lines.push('\x1B\x40');
      lines.push('\x1D\x4C\x00\x00');
      lines.push('\x1B\x33\x1E');
      lines.push('\x1B\x61\x01');
      lines.push(lineCenter(storeSettings?.storeName || 'Toko'));
      if (storeSettings?.address) lines.push(lineCenter(storeSettings.address));
      if (storeSettings?.phone) lines.push(lineCenter(storeSettings.phone));
      lines.push(`${hr}\n`);
      lines.push(lineKV('No:', transaction.receiptNumber));
      lines.push(lineKV('Tanggal:', format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')));
      lines.push(lineKV('Metode:', paymentMethodName));
      lines.push(`${hr}\n`);

      lines.push('\x1B\x61\x00');
      for (const item of items) {
        lines.push(`${fit(item.productName)}\n`);
        if (item.notes) lines.push(`  ${fit(item.notes, PAPER_WIDTH - 2)}\n`);
        const left = `${item.quantity} x Rp ${item.price.toLocaleString('id-ID')}`;
        const right = `Rp ${item.subtotal.toLocaleString('id-ID')}`;
        lines.push(lineKV(left, right));
      }

      lines.push(`${hr}\n`);
      lines.push(lineKV('Subtotal:', `Rp ${transaction.subtotal.toLocaleString('id-ID')}`));
      if (transaction.discountAmount > 0) {
        lines.push(lineKV('Diskon:', `-Rp ${transaction.discountAmount.toLocaleString('id-ID')}`));
      }
      lines.push(lineKV('TOTAL:', `Rp ${transaction.total.toLocaleString('id-ID')}`));
      lines.push(lineKV('Bayar:', `Rp ${transaction.paymentAmount.toLocaleString('id-ID')}`));
      lines.push(lineKV('Kembali:', `Rp ${transaction.change.toLocaleString('id-ID')}`));
      lines.push(`${hr}\n`);
      lines.push('\x1B\x61\x01');
      lines.push(lineCenter(storeSettings?.receiptFooter || 'Terima kasih!'));
      lines.push('\n\n');
      return lines.join('');
    };

    const buildEscPosPayload = () => new TextEncoder().encode(buildEscPosText());

    const toDataView = (bytes: Uint8Array) => new DataView(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

    const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    if (isAndroidNative) {
      try {
        await BluetoothSerial.enable();

        let address = localStorage.getItem(PRINTER_SERIAL_ADDRESS_KEY) || '';
        if (!address) {
          toast.info('Mencari printer thermal Bluetooth...');
          const scanResult = await BluetoothSerial.scan();
          const devices: BluetoothDevice[] = scanResult.devices ?? [];

          if (!devices.length) {
            throw new Error('NO_CLASSIC_BT_DEVICE');
          }

          const mapped = devices
            .map(d => ({
              address: String(d?.address || d?.id || ''),
              name: String(d?.name || 'Bluetooth Printer'),
            }))
            .filter((d: { address: string }) => !!d.address);

          if (!mapped.length) {
            throw new Error('INVALID_CLASSIC_BT_ADDRESS');
          }

          if (mapped.length === 1) {
            address = mapped[0].address;
            localStorage.setItem(PRINTER_SERIAL_ADDRESS_KEY, address);
          } else {
            setPrinterCandidates(mapped);
            setPrinterPickerOpen(true);
            toast.info('Pilih printer Bluetooth terlebih dahulu.');
            return;
          }
        }

        toast.info('Menghubungkan printer Bluetooth thermal...');
        await BluetoothSerial.connect({ address });
        await BluetoothSerial.write({ address, value: buildEscPosText() });
        await BluetoothSerial.disconnect({ address });
        toast.success('Struk berhasil dicetak ke printer Bluetooth!');
        return;
      } catch {
        localStorage.removeItem(PRINTER_SERIAL_ADDRESS_KEY);
      }

      try {
        await BleClient.initialize();
        try {
          await BleClient.requestEnable();
        } catch {
          // requestEnable can be cancelled if already enabled
        }

        let deviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY) || '';

        if (!deviceId) {
          toast.info('Pilih printer Bluetooth thermal 58mm...');
          const device = await BleClient.requestDevice({});
          deviceId = device.deviceId;
          localStorage.setItem(PRINTER_DEVICE_ID_KEY, deviceId);
        }

        toast.info('Menghubungkan printer Bluetooth...');
        await BleClient.connect(deviceId);

        let serviceUuid = PRINTER_SERVICE_UUID;
        let characteristicUuid = PRINTER_CHARACTERISTIC_UUID;
        let useWriteWithoutResponse = true;

        try {
          const services = await BleClient.getServices(deviceId);
          let selected: { service: string; characteristic: string; useWriteWithoutResponse: boolean } | null = null;

          for (const service of services ?? []) {
            for (const characteristic of service.characteristics ?? []) {
              const p = characteristic.properties as BleCharacteristicProperties;
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
            await BleClient.writeWithoutResponse(deviceId, serviceUuid, characteristicUuid, toDataView(chunk));
          } else {
            await BleClient.write(deviceId, serviceUuid, characteristicUuid, toDataView(chunk));
          }
        }

        await BleClient.disconnect(deviceId);
        toast.success('Struk berhasil dicetak ke printer Bluetooth!');
        return;
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
