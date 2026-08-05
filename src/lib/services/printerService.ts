import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { BleClient, type BleCharacteristicProperties } from '@capacitor-community/bluetooth-le';
import { BluetoothSerial, type BluetoothDevice } from '@e-is/capacitor-bluetooth-serial';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/lib/db';

export const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
export const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
export const PRINTER_DEVICE_ID_KEY = 'alaalakasir_ble_printer_device_id';
export const PRINTER_SERIAL_ADDRESS_KEY = 'alaalakasir_bt_serial_address';

export interface ReceiptPrintData {
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings?: StoreSettings;
  paymentMethodName: string;
}

export interface BluetoothPrinterCandidate {
  address: string;
  name: string;
}

export interface PrintResult {
  success: boolean;
  message?: string;
  needPicker?: boolean;
  candidates?: BluetoothPrinterCandidate[];
}

/**
 * Builds standard 58mm (32 characters wide) ESC/POS text representation of the receipt
 */
export function buildEscPosText(data: ReceiptPrintData): string {
  const { transaction, items, storeSettings, paymentMethodName } = data;
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

  // Reset and initialization commands
  lines.push('\x1B\x40'); // Initialize printer
  lines.push('\x1D\x4C\x00\x00'); // Left margin = 0
  lines.push('\x1B\x33\x1E'); // Line spacing
  lines.push('\x1B\x61\x01'); // Center alignment
  lines.push(lineCenter(storeSettings?.storeName || 'Toko'));
  if (storeSettings?.address) lines.push(lineCenter(storeSettings.address));
  if (storeSettings?.phone) lines.push(lineCenter(storeSettings.phone));
  lines.push(`${hr}\n`);
  lines.push(lineKV('No:', transaction.receiptNumber));
  lines.push(lineKV('Tanggal:', format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')));
  lines.push(lineKV('Metode:', paymentMethodName));
  lines.push(`${hr}\n`);

  lines.push('\x1B\x61\x00'); // Left alignment
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
  lines.push('\x1B\x61\x01'); // Center alignment
  lines.push(lineCenter(storeSettings?.receiptFooter || 'Terima kasih!'));
  lines.push('\n\n');

  return lines.join('');
}

export function buildEscPosPayload(data: ReceiptPrintData): Uint8Array {
  return new TextEncoder().encode(buildEscPosText(data));
}

function toDataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

export function clearSavedPrinters(): void {
  localStorage.removeItem(PRINTER_SERIAL_ADDRESS_KEY);
  localStorage.removeItem(PRINTER_DEVICE_ID_KEY);
}

/**
 * Print via Android Classic Bluetooth Serial
 */
export async function printViaBluetoothSerial(data: ReceiptPrintData): Promise<PrintResult> {
  await BluetoothSerial.enable();

  let address = localStorage.getItem(PRINTER_SERIAL_ADDRESS_KEY) || '';
  if (!address) {
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
      return {
        success: false,
        needPicker: true,
        candidates: mapped,
      };
    }
  }

  await BluetoothSerial.connect({ address });
  await BluetoothSerial.write({ address, value: buildEscPosText(data) });
  await BluetoothSerial.disconnect({ address });
  return { success: true, message: 'Struk berhasil dicetak ke printer Bluetooth!' };
}

/**
 * Print via Android Bluetooth Low Energy (BLE)
 */
export async function printViaBle(data: ReceiptPrintData): Promise<PrintResult> {
  await BleClient.initialize();
  try {
    await BleClient.requestEnable();
  } catch {
    // requestEnable can be cancelled if already enabled
  }

  let deviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY) || '';

  if (!deviceId) {
    const device = await BleClient.requestDevice({});
    deviceId = device.deviceId;
    localStorage.setItem(PRINTER_DEVICE_ID_KEY, deviceId);
  }

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
    // Fallback to default UUIDs
  }

  const payload = buildEscPosPayload(data);
  for (let i = 0; i < payload.length; i += 180) {
    const chunk = payload.slice(i, i + 180);
    if (useWriteWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, serviceUuid, characteristicUuid, toDataView(chunk));
    } else {
      await BleClient.write(deviceId, serviceUuid, characteristicUuid, toDataView(chunk));
    }
  }

  await BleClient.disconnect(deviceId);
  return { success: true, message: 'Struk berhasil dicetak ke printer Bluetooth!' };
}

/**
 * Print via Web Bluetooth API (for supported Chromium browsers on desktop/Android)
 */
export async function printViaWebBluetooth(data: ReceiptPrintData): Promise<PrintResult> {
  // @ts-expect-error Web Bluetooth API navigator.bluetooth
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [PRINTER_SERVICE_UUID] }],
    optionalServices: [PRINTER_SERVICE_UUID],
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);
  const payload = buildEscPosPayload(data);

  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    await characteristic.writeValue(chunk);
  }

  await server.disconnect();
  return { success: true, message: 'Struk berhasil dicetak!' };
}

/**
 * Print via hidden browser iframe using image canvas data URL
 */
export function printViaIframe(dataUrl: string): void {
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
    throw new Error('FRAME_DOC_UNAVAILABLE');
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
}
