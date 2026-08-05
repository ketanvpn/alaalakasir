# 🧾 AlaalaKasir (POS & Cashier App)

<p align="center">
  <img src="public/icons/icon-512.png" alt="AlaalaKasir Logo" width="120" height="120" style="border-radius: 24px;" />
</p>

<p align="center">
  <b>Aplikasi Kasir POS (Point of Sale) Offline-First & Gratis untuk UMKM, Retail, Toko Kelontong, dan Usaha F&B Indonesia.</b>
</p>

<p align="center">
  <a href="https://github.com/ketanvpn/alaalakasir/releases"><img src="https://img.shields.io/github/v/release/ketanvpn/alaalakasir?color=orange&label=Release&logo=github" alt="Latest Release" /></a>
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20PWA%20%7C%20Web-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/Offline--First-Dexie.js%20IndexedDB-success" alt="Offline First" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 🌟 Mengapa AlaalaKasir?

Sebagian besar aplikasi POS di pasaran mewajibkan biaya langganan bulanan dan koneksi internet stabil. **AlaalaKasir** dirancang sebagai solusi kasir mandiri (*offline-first*):

- 🔒 **100% Privasi & Data Milik Anda**: Seluruh database produk, stok, kasbon, dan transaksi tersimpan aman di penyimpanan lokal perangkat (*IndexedDB*) tanpa perlu server backend pihak ketiga.
- ⚡ **Tanpa Registrasi & Tanpa Internet**: Buka aplikasi dan langsung bisa transaksi di mana saja, kapan saja—bahkan di daerah tanpa sinyal internet.
- 🖨️ **Dukungan Printer Thermal Bluetooth (58mm/80mm)**: Cetak struk belanja fisik langsung via driver printer ESC/POS Bluetooth (BLE & Serial) tanpa setup rumit.
- 📱 **Mobile & Tablet Split-View**: Tampilan antarmuka kasir yang dirancang ergonomis untuk layar HP (*floating cart pill & sticky headers*) maupun tablet/desktop (*persistent split-view*).

---

## ✨ Fitur Unggulan

### 🛒 1. Kasir POS & Transaksi Cepat
- **Katalog & Keranjang Pintar**: Pencarian cepat nama/barcode, filter kategori dinamis, dan kontrol jumlah barang yang mudah.
- **Diskon Fleksibel**: Diskon per item produk maupun diskon total transaksi (persentase `%` atau nominal `Rp`).
- **Open Bill / Simpan Pesanan**: Simpan pesanan pelanggan yang sedang makan di tempat (*dine-in*) lengkap dengan nomor meja dan catatan khusus.
- **Scan Barcode Cepat**: Scan barcode fisik via kamera smartphone atau scanner barcode USB/Bluetooth.

### 👥 2. Manajemen Pelanggan & Buku Kasbon / Piutang
- **Catat Kasbon Saat Checkout**: Pilihan metode pembayaran kasbon / bayar tempo langsung dari kasir.
- **Buku Piutang Digital**: Pantau total saldo piutang toko, daftar pelanggan berhutang, dan tanggal jatuh tempo.
- **Riwayat Cicilan**: Catat pembayaran cicilan atau pelunasan dengan berbagai metode pembayaran.
- **Kirim Tagihan WhatsApp**: Buat dan kirim pesan rincian tagihan kasbon secara otomatis dan sopan langsung ke nomor WhatsApp pelanggan.

### 📦 3. Manajemen Produk & Inventaris Stok
- **Katalog Produk Lengkap**: SKU unik, kategori dengan warna/ikon kustom, foto produk, harga jual, dan satuan unit (pcs, kg, porsi, renceng, dll).
- **Stok Masuk & Stok Keluar**: Catat penerimaan barang dari supplier serta pencatatan stok rusak, hilang, atau retur.
- **HPP Otomatis (Metode Rata-rata Tertimbang)**: Harga Pokok Penjualan (HPP) terhitung otomatis secara matematis setiap kali ada stok masuk baru.

### 🖨️ 4. Struk Belanja & Driver Printer Bluetooth
- **Cetak Struk Thermal**: Format struk 58mm/80mm standar POS, nama toko, logo, rincian barang, diskon, kembalian, dan catatan kaki (*footer*).
- **Driver Terisolasi**: Mendukung Bluetooth Low Energy (BLE), Bluetooth Serial Classic (Android Native), dan Web Print fallback.
- **Bagikan Struk Digital**: Ekspor struk sebagai teks rapi untuk dikirim via WhatsApp atau media sosial.

### 📊 5. Laporan Keuangan & Analitik Penjualan
- **Dashboard Bisnis**: Ringkasan omzet penjualan hari ini, estimasi laba bersih, transaksi terakhir, dan produk terlaris.
- **Laporan Penjualan**: Grafik tren penjualan harian/bulanan, rincian metode pembayaran, dan margin keuntungan.
- **Ekspor Laporan**: Ekspor data laporan lengkap ke format **CSV**, **Excel**, dan cetak ringkasan PDF.

### ⚙️ 6. Pengaturan & Utilitas Toko
- **Pencadangan & Pemulihan (Backup/Restore)**: Ekspor seluruh database ke file JSON aman dengan sistem pengingat pencadangan berkala.
- **Kustomisasi Tema & Dark Mode**: Pilihan warna aksen toko dan dukungan tema gelap (*Dark Mode*) penuh.
- **In-App Auto Updater**: Pembaruan aplikasi Android langsung dari dalam aplikasi via GitHub Release API.

---

## 🛠️ Arsitektur & Teknologi

```text
┌──────────────────────────────────────────────────────────┐
│             UI / Presentation Layer (React 18)           │
│  Tailwind CSS • Shadcn UI • Lucide Icons • Split-View    │
├──────────────────────────┬───────────────────────────────┤
│    Domain Services       │         Hardware Drivers      │
│  • salesService          │  • printerService (ESC/POS)   │
│  • customerService       │  • Bluetooth BLE / Serial     │
│  • stockService          │  • Camera Barcode Scanner     │
│  • backupService         │  • In-App APK Updater         │
├──────────────────────────┴───────────────────────────────┤
│       Offline Storage Layer (Dexie.js IndexedDB)         │
│  Categories • Products • Transactions • Debts • Settings │
├──────────────────────────────────────────────────────────┤
│             Cross-Platform Native Runtime                │
│    Progressive Web App (PWA)  •  Capacitor Android Core  │
└──────────────────────────────────────────────────────────┘
```

| Lapisan | Teknologi | Kegunaan |
|---|---|---|
| **Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Antarmuka pengguna interaktif & tipe data ketat |
| **Build Tool** | [Vite](https://vitejs.dev/) | Toolchain build super cepat |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Styling responsif & mobile-first |
| **UI Primitives** | [Radix UI](https://www.radix-ui.com/) / [Shadcn UI](https://ui.shadcn.com/) | Komponen dialog, sheet, badge, dan modal aksesibel |
| **Database Lokal** | [Dexie.js](https://dexie.org/) (IndexedDB) | Database lokal NoSQL cepat dengan skema migrasi terisolasi |
| **Hardware / Native** | [@capacitor/core](https://capacitorjs.com/) | Wrapper Android APK, akses storage lokal, & native HTTP |
| **Pengujian** | [Vitest](https://vitest.dev/) | Unit test suite & validasi logika bisnis |

---

## 🚀 Panduan Instalasi & Pengembangan

### 1. Kebutuhan Lingkungan
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- `npm` atau `pnpm`
- (Opsional untuk Android APK): Android Studio & JDK 17+

### 2. Clone Repositori
```bash
git clone https://github.com/ketanvpn/alaalakasir.git
cd alaalakasir
```

### 3. Install Dependensi
```bash
npm install
```

### 4. Menjalankan Server Development
```bash
npm run dev
```
Buka browser di `http://localhost:8080`.

### 5. Menjalankan Pengujian (Unit Tests)
```bash
npm test
# atau untuk sekali jalan:
npx vitest run
```

### 6. Build Produksi Web / PWA
```bash
npm run build
```
File build produksi akan berada di folder `dist/`.

### 7. Sinkronisasi & Build Android (Capacitor)
```bash
npm run build
npx cap sync android
npx cap open android
```

---

## 📱 Unduh Aplikasi Android (APK)

Anda dapat mengunduh file installer APK Android versi terbaru langsung dari halaman rilis resmi:

👉 **[Unduh APK Terbaru di GitHub Releases](https://github.com/ketanvpn/alaalakasir/releases)**

---

## 🤝 Kontribusi

Kontribusi selalu terbuka! Jika Anda ingin memperbaiki bug, menambahkan fitur, atau meningkatkan dokumentasi:
1. Fork repositori ini.
2. Buat branch fitur baru (`git checkout -b feature/fitur-keren`).
3. Commit perubahan Anda (`git commit -m 'feat: tambah fitur keren'`).
4. Push ke branch Anda (`git push origin feature/fitur-keren`).
5. Buat **Pull Request**.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT License](LICENSE). Bebas digunakan dan dikembangkan untuk keperluan pribadi maupun komersial.
