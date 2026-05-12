import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentMethod, type Category } from '@/lib/db';
import { useState, useEffect, useRef } from 'react';
import { Settings, Store, CreditCard, Tag, Download, Upload, Plus, Trash2, Edit2, Truck, ArrowDownToLine, ArrowUpFromLine, ChevronRight, Receipt, Palette, HardDrive, Package, Camera, X, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Share } from '@capacitor/share';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { setThemeColor } from '@/hooks/use-theme-color';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-utils';
import { CURRENT_APP_VERSION, checkForAppUpdate, type AppUpdateInfo } from '@/lib/update-check';
import { backupHasData, exportBackupData, isBackupData, restoreBackupData, shareLatestBackupFile } from '@/lib/services/backupService';
import { canDeleteCategory, canDeletePaymentMethod } from '@/lib/services/settingsService';
import { ApkInstaller } from '@/lib/apk-installer';

const SUPPORT_QRIS_URL = '/support/qris-ketantech.png';
const UPDATE_APK_PATH = 'alaalakasir-latest.apk';
const FEEDBACK_WHATSAPP_NUMBER = '6282397803813';

export default function Pengaturan() {
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const paymentMethodUsage = useLiveQuery(async () => {
    const methods = await db.paymentMethods.toArray();
    const transactions = await db.transactions.toArray();
    const usageMap: Record<number, number> = {};

    for (const method of methods) {
      if (!method.id) continue;
      usageMap[method.id] = 0;
    }

    for (const tx of transactions) {
      const key = tx.paymentMethodId;
      usageMap[key] = (usageMap[key] ?? 0) + 1;
    }

    return usageMap;
  });
  const categoryActiveUsage = useLiveQuery(async () => {
    const products = await db.products.where('isDeleted').equals(0).toArray();
    const usageMap: Record<number, number> = {};

    for (const product of products) {
      usageMap[product.categoryId] = (usageMap[product.categoryId] ?? 0) + 1;
    }

    return usageMap;
  });

  // Store edit
  const [storeDialog, setStoreDialog] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddr, setStoreAddr] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeLogo, setStoreLogo] = useState<string | undefined>(undefined);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Payment method
  const [pmDialog, setPmDialog] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId, setPmEditId] = useState<number | null>(null);

  // Category
  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#FF6B35');
  const [catEditId, setCatEditId] = useState<number | null>(null);

  // Storage info (CR-9)
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [downloadedApkUri, setDownloadedApkUri] = useState<string | null>(null);
  const [downloadedApkName, setDownloadedApkName] = useState<string | null>(null);
  const [updateInstallDialog, setUpdateInstallDialog] = useState(false);
  const [supportQrisDialog, setSupportQrisDialog] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [savingBackup, setSavingBackup] = useState(false);
  const [sharingBackup, setSharingBackup] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<unknown>(null);
  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setStorageUsage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      });
    }
  }, []);

  const openStoreEdit = () => {
    setStoreName(storeSettings?.storeName ?? '');
    setStoreAddr(storeSettings?.address ?? '');
    setStorePhone(storeSettings?.phone ?? '');
    setStoreLogo(storeSettings?.logo);
    setStoreDialog(true);
  };

  const saveStore = async () => {
    if (!storeName.trim()) {
      toast.error('Nama toko wajib diisi');
      return;
    }

    if (storeSettings?.id) {
      await db.storeSettings.update(storeSettings.id, { storeName: storeName.trim(), address: storeAddr.trim(), phone: storePhone.trim(), logo: storeLogo || undefined });
      toast.success('Info toko disimpan');
      setStoreDialog(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setStoreLogo(compressed);
    } catch {
      toast.error('Gagal memproses gambar');
    }
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const openPmAdd = () => { setPmEditId(null); setPmName(''); setPmCategory('tunai'); setPmDialog(true); };
  const openPmEdit = (pm: PaymentMethod) => { setPmEditId(pm.id!); setPmName(pm.name); setPmCategory(pm.category); setPmDialog(true); };
  const savePm = async () => {
    if (!pmName.trim()) return;
    if (pmEditId) await db.paymentMethods.update(pmEditId, { name: pmName.trim(), category: pmCategory });
    else await db.paymentMethods.add({ name: pmName.trim(), category: pmCategory, isDefault: false, createdAt: new Date() });
    setPmDialog(false);
    toast.success('Metode pembayaran disimpan');
  };
  const deletePm = async (id: number) => {
    const check = await canDeletePaymentMethod(id);
    if (!check.ok && check.reason === 'last_method') {
      toast.error('Minimal harus ada 1 metode pembayaran');
      return;
    }

    if (!check.ok && check.reason === 'already_used') {
      toast.error('Metode pembayaran ini sudah dipakai transaksi dan tidak bisa dihapus');
      return;
    }

    await db.paymentMethods.delete(id);
    toast.success('Dihapus');
  };

  const openCatAdd = () => { setCatEditId(null); setCatName(''); setCatIcon('📦'); setCatColor('#FF6B35'); setCatDialog(true); };
  const openCatEdit = (c: Category) => { setCatEditId(c.id!); setCatName(c.name); setCatIcon(c.icon); setCatColor(c.color); setCatDialog(true); };
  const saveCat = async () => {
    if (!catName.trim()) return;
    if (catEditId) await db.categories.update(catEditId, { name: catName.trim(), icon: catIcon, color: catColor });
    else await db.categories.add({ name: catName.trim(), icon: catIcon, color: catColor, createdAt: new Date(), isDeleted: 0, deletedAt: null });
    setCatDialog(false);
    toast.success('Kategori disimpan');
  };
  const deleteCat = async (id: number) => {
    const check = await canDeleteCategory(id);
    if (!check.ok && check.reason === 'has_active_products') {
      toast.error('Kategori masih dipakai produk aktif dan tidak bisa dihapus');
      return;
    }

    await db.categories.update(id, { isDeleted: 1, deletedAt: new Date() });
    toast.success('Dihapus');
  };

  const handleImport = () => {
    if (importingBackup) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportingBackup(true);
      try {
        const text = await file.text();
        if (!text.trim()) { toast.error('File kosong'); return; }
        {
          const data: unknown = JSON.parse(text);
          if (!isBackupData(data)) { toast.error('File tidak valid'); return; }
          if (!backupHasData(data)) { toast.error('File backup tidak berisi data'); return; }
          setPendingBackupData(data);
          setRestoreConfirmOpen(true);
          return;
        }
      } catch { toast.error('Gagal membaca file'); }
      finally {
        setImportingBackup(false);
      }
    };
    input.click();
  };

  const handleSaveBackup = async () => {
    if (savingBackup) return;
    setSavingBackup(true);
    try {
      await exportBackupData();
    } finally {
      setSavingBackup(false);
    }
  };

  const handleShareBackup = async () => {
    if (sharingBackup) return;
    setSharingBackup(true);
    try {
      await shareLatestBackupFile();
    } finally {
      setSharingBackup(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackupData || !isBackupData(pendingBackupData)) {
      toast.error('Data backup tidak valid');
      setRestoreConfirmOpen(false);
      return;
    }

    setImportingBackup(true);
    try {
      await restoreBackupData(pendingBackupData);
      setRestoreConfirmOpen(false);
      setPendingBackupData(null);
      toast.success('Data berhasil di-restore! Aplikasi akan dimuat ulang.');
      setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import gagal';
      toast.error(`${message}. Data lama tetap dipertahankan`);
    } finally {
      setImportingBackup(false);
    }
  };

  const emojiOptions = ['📦', '🍕', '🥤', '🍜', '🧃', '🎽', '💊', '🧹', '📱', '🛒', '🎁', '✂️'];

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await checkForAppUpdate();
      setUpdateInfo(info);
      if (info.updateAvailable) {
        toast.info(`Versi baru tersedia: ${info.latestVersion}`);
      } else if (info.latestVersion) {
        toast.success('Aplikasi sudah versi terbaru');
      } else {
        toast.info('Belum ada tag versi di GitHub');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengecek update';
      toast.error(message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDownloadAndInstallUpdate = async () => {
    if (!updateInfo?.updateAvailable || !updateInfo.apkUrl) {
      toast.error('Link APK versi terbaru belum tersedia');
      return;
    }

    if (!(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')) {
      window.open(updateInfo.apkUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const permission = await Filesystem.requestPermissions();
      if (permission.publicStorage !== 'granted') {
        toast.error('Izin penyimpanan dibutuhkan untuk mengunduh update di HP ini.');
        return;
      }
    } catch {
      toast.error('Gagal meminta izin penyimpanan. Coba izinkan dulu di Pengaturan aplikasi.');
      return;
    }

    setDownloadingUpdate(true);
    setUpdateProgress(0);
    setDownloadedApkUri(null);
    setDownloadedApkName(null);
    let progressListener: { remove: () => Promise<void> } | null = null;

    try {
      progressListener = await Filesystem.addListener('progress', (status) => {
        const pct = status.contentLength > 0 ? Math.round((status.bytes / status.contentLength) * 100) : 0;
        setUpdateProgress(Math.max(0, Math.min(100, pct)));
      });

      try {
        await Filesystem.deleteFile({ path: UPDATE_APK_PATH, directory: Directory.Documents });
      } catch {
        // ignore if old file doesn't exist
      }

      toast.info('Mengunduh update aplikasi...');
      await Filesystem.downloadFile({
        url: updateInfo.apkUrl,
        path: UPDATE_APK_PATH,
        directory: Directory.Documents,
        recursive: true,
        progress: true,
      });

      const downloadedStat = await Filesystem.stat({ path: UPDATE_APK_PATH, directory: Directory.Documents });
      const downloadedSize = Number(downloadedStat.size ?? 0);
      if (!Number.isFinite(downloadedSize) || downloadedSize < 500_000) {
        throw new Error('File update tidak valid. Coba ulangi download.');
      }

      const apkUri = await Filesystem.getUri({ path: UPDATE_APK_PATH, directory: Directory.Documents });
      if (!apkUri.uri) throw new Error('File APK tidak ditemukan setelah download');

      const fileNameFromUrl = updateInfo.apkUrl.split('/').pop() || 'alaalakasir-latest.apk';
      setDownloadedApkUri(apkUri.uri);
      setDownloadedApkName(fileNameFromUrl);
      setUpdateInstallDialog(true);
      toast.success('Update siap dipasang. File update sudah tersimpan di HP Anda.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengunduh update aplikasi';
      toast.error(message);
    } finally {
      if (progressListener) await progressListener.remove();
      setDownloadingUpdate(false);
      setUpdateProgress(0);
    }
  };

  const handleInstallDownloadedApkDirect = async () => {
    if (!downloadedApkUri) {
      toast.error('File update belum tersedia. Download dulu.');
      return;
    }

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        const result = await ApkInstaller.install({ path: downloadedApkUri });
        if (result.permissionRequired) {
          toast.info('Aktifkan izin install dari aplikasi ini, lalu kembali dan tekan Install lagi.');
          await ApkInstaller.openInstallPermissionSettings();
          return;
        }
        toast.info('Lanjutkan proses install di layar Android.');
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Belum bisa membuka installer langsung.';
        toast.error(`${message} Coba cara File Manager.`);
        return;
      }
    }

    try {
      await FileOpener.openFile({
        path: downloadedApkUri,
        mimeType: 'application/vnd.android.package-archive',
      });
      toast.info('Jika tidak muncul proses instal, kembali lalu pilih "Coba Cara Lain".');
    } catch {
      toast.error('Belum bisa membuka file update. Buka izin instal dulu.');
      await handleOpenInstallPermissionSettings();
    }
  };

  const handleInstallViaFileManager = async () => {
    if (!downloadedApkUri) {
      toast.error('File update belum tersedia. Download dulu.');
      return;
    }

    try {
      await Share.share({
        title: 'Buka APK Update AlaalaKasir',
        text: 'Pilih aplikasi File Manager, lalu install file APK update.',
        url: downloadedApkUri,
        dialogTitle: 'Pilih aplikasi pembuka APK',
      });
      toast.info('Pilih File Manager, lalu tekan Install pada file APK.');
    } catch {
      toast.error('Gagal membuka opsi alternatif instal APK.');
    }
  };

  const handleOpenInstallPermissionSettings = async () => {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        await ApkInstaller.openInstallPermissionSettings();
        toast.info('Aktifkan izin install dari aplikasi ini, lalu kembali ke AlaalaKasir.');
        return;
      }

      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
      toast.info('Aktifkan izin install dari aplikasi ini, lalu kembali ke AlaalaKasir.');
    } catch {
      toast.error('Gagal membuka pengaturan izin aplikasi.');
    }
  };

  const handleOpenSecuritySettings = async () => {
    try {
      await NativeSettings.open({
        optionAndroid: AndroidSettings.Security,
        optionIOS: IOSSettings.App,
      });
      toast.info('Cari menu: Instal aplikasi tidak dikenal / Sumber tidak dikenal.');
    } catch {
      await handleOpenInstallPermissionSettings();
    }
  };

  const handleSendFeedback = () => {
    const cleanVersion = CURRENT_APP_VERSION.replace(/^v/i, '');
    const message = [
      `Halo, saya mau kirim masukan untuk AlaalaKasir (v${cleanVersion}).`,
      'Jenis: Bug / Fitur',
      'Pesan: ',
    ].join('\n');

    const url = `https://wa.me/${FEEDBACK_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getPaymentMethodDeleteBlockReason = (id: number) => {
    if (!paymentMethods) return null;
    if (paymentMethods.length <= 1) return 'Minimal harus ada 1 metode pembayaran';
    if ((paymentMethodUsage?.[id] ?? 0) > 0) {
      return 'Sudah dipakai transaksi';
    }
    return null;
  };

  const getCategoryDeleteBlockReason = (id: number) => {
    if ((categoryActiveUsage?.[id] ?? 0) > 0) {
      return 'Masih dipakai produk aktif';
    }
    return null;
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        Pengaturan
      </h1>

      {/* Store Info */}
      <Card className="border-0 shadow-sm cursor-pointer" onClick={openStoreEdit}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
            {storeSettings?.logo ? (
              <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{storeSettings?.storeName || 'Toko Saya'}</p>
            <p className="text-xs text-muted-foreground">{storeSettings?.address || 'Belum diatur'}</p>
          </div>
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Transaksi & Stok */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Transaksi & Stok</h2>
        <Link to="/history">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Receipt className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Riwayat Transaksi</p><p className="text-[10px] text-muted-foreground">Lihat semua transaksi & cetak ulang struk</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/supplier">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Truck className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Supplier</p><p className="text-[10px] text-muted-foreground">Kelola data supplier</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/stock-in">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center"><ArrowDownToLine className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Stok Masuk</p><p className="text-xs text-muted-foreground">Catat barang masuk & HPP otomatis</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/stock-out">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"><ArrowUpFromLine className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Stok Keluar</p><p className="text-xs text-muted-foreground">Catat barang keluar non-penjualan</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/stock-report">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Package className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Laporan Stok</p><p className="text-[10px] text-muted-foreground">Lihat pergerakan stok per periode</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Payment Methods */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Metode Pembayaran</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openPmAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {paymentMethods?.map(pm => (
            <div key={pm.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium">{pm.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{pm.category}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPmEdit(pm)}><Edit2 className="w-3 h-3" /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  onClick={() => deletePm(pm.id!)}
                  disabled={!!getPaymentMethodDeleteBlockReason(pm.id!)}
                  title={getPaymentMethodDeleteBlockReason(pm.id!) ?? 'Hapus metode pembayaran'}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            Metode pembayaran tidak bisa dihapus jika tinggal satu atau sudah dipakai transaksi.
          </p>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Tag className="w-4 h-4" /> Kategori Produk</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openCatAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {categories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCatEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  onClick={() => deleteCat(c.id!)}
                  disabled={!!getCategoryDeleteBlockReason(c.id!)}
                  title={getCategoryDeleteBlockReason(c.id!) ?? 'Hapus kategori'}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            Kategori tidak bisa dihapus jika masih dipakai produk aktif.
          </p>
        </CardContent>
      </Card>

      {/* Theme Color */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Palette className="w-4 h-4" /> Warna Tema</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeColorPicker
            value={storeSettings?.themeColor ?? '25'}
            onChange={hue => setThemeColor(hue)}
          />
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full h-10 text-sm gap-2"
            onClick={handleSaveBackup}
            disabled={savingBackup}
          >
            <Download className="w-4 h-4" /> {savingBackup ? 'Menyimpan Backup...' : 'Simpan Backup ke Perangkat'}
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 text-sm gap-2"
            onClick={handleShareBackup}
            disabled={sharingBackup}
          >
            <Share2 className="w-4 h-4" /> {sharingBackup ? 'Membuka Opsi Bagikan...' : 'Bagikan Backup Terakhir'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Lokasi default backup: folder Dokumen / Files di perangkat.
          </p>
          <Button
            variant="outline"
            className="w-full h-10 text-sm gap-2"
            onClick={handleImport}
            disabled={importingBackup}
          >
            <Upload className="w-4 h-4" /> {importingBackup ? 'Memproses Restore...' : 'Import / Restore Data'}
          </Button>
          {storeSettings?.lastBackupAt && (
            <p className="text-[10px] text-muted-foreground text-center">Terakhir backup: {new Date(storeSettings.lastBackupAt).toLocaleString('id-ID')}</p>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center space-y-2">
           <p className="text-sm font-bold">AlaalaKasir</p>
           <p className="text-xs text-muted-foreground">POS Gratis untuk UMKM Indonesia 🇮🇩</p>
           <p className="text-[10px] text-muted-foreground">v{CURRENT_APP_VERSION.replace(/^v/i, '')} • Data tersimpan di perangkat</p>

           <div className="rounded-lg border bg-muted/40 p-3 text-left space-y-2">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <p className="text-xs font-semibold">Update Aplikasi</p>
                  <p className="text-[10px] text-muted-foreground">
                    {updateInfo?.latestVersion
                      ? `Versi baru tersedia: ${updateInfo.latestVersion}`
                      : 'Cek apakah ada versi aplikasi terbaru'}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCheckUpdate} disabled={checkingUpdate}>
                  {checkingUpdate ? 'Mengecek...' : 'Cek Update'}
                </Button>
              </div>
              {updateInfo?.updateAvailable && (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleDownloadAndInstallUpdate}
                    disabled={downloadingUpdate}
                  >
                    {downloadingUpdate ? `Sedang menyiapkan update... ${updateProgress}%` : 'Update Sekarang'}
                  </Button>
                  {downloadedApkUri && (
                    <div className="space-y-1.5">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleInstallDownloadedApkDirect}
                      >
                        Install Update
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleInstallViaFileManager}
                      >
                        Buka File Manager
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        Update siap dipasang: {downloadedApkName ?? 'alaalakasir-latest.apk'}
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Jika Android meminta izin, aktifkan "Izinkan dari sumber ini", lalu kembali dan tekan Install Update lagi.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={handleOpenSecuritySettings}
                  >
                    Buka Pengaturan Keamanan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={handleOpenInstallPermissionSettings}
                  >
                    Buka Pengaturan Izin
                  </Button>
                </div>
              )}
            </div>

            {/* Feedback & Support */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleSendFeedback}
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-foreground hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
              >
                Kirim Masukan
              </button>
               <button
                 type="button"
                 onClick={() => setSupportQrisDialog(true)}
                 className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-warning/30 bg-warning/5 text-xs font-semibold text-warning hover:bg-warning/10 transition-colors"
               >
                 💳 Dukung Pengembangan via QRIS
               </button>
              <p className="text-xs text-muted-foreground text-center px-1 pt-1 leading-relaxed">
                Jika AlaalaKasir membantu usaha Anda, dukungan Anda sangat berarti agar aplikasi ini tetap gratis dan terus berkembang.
              </p>
            </div>
           {storageUsage && (
             <div className="pt-2 border-t">
               <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                 <HardDrive className="w-3.5 h-3.5" />
                 <span>Penyimpanan Terpakai</span>
               </div>
               <p className="text-xs font-semibold">
                 {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
               </p>
               <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                 <div
                   className="h-full bg-primary rounded-full transition-all"
                   style={{ width: `${Math.min(100, (storageUsage.usage / storageUsage.quota) * 100)}%` }}
                 />
               </div>
             </div>
           )}
        </CardContent>
      </Card>

      <Dialog open={supportQrisDialog} onOpenChange={setSupportQrisDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-xl p-3">
          <DialogHeader>
            <DialogTitle>Dukung Pengembangan via QRIS</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-2">
            <img
              src={SUPPORT_QRIS_URL}
              alt="QRIS Dukungan AlaalaKasir"
              className="w-full h-auto max-h-[70vh] object-contain rounded-md"
              loading="lazy"
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Scan QRIS ini dari aplikasi pembayaran kamu.
          </p>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={restoreConfirmOpen}
        onOpenChange={(open) => {
          setRestoreConfirmOpen(open);
          if (!open && !importingBackup) {
            setPendingBackupData(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Data Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Restore akan menimpa data aplikasi saat ini dengan data dari file backup. Pastikan Anda sudah memilih file yang benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importingBackup}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore} disabled={importingBackup}>
              {importingBackup ? 'Memproses Restore...' : 'Lanjut Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={updateInstallDialog} onOpenChange={setUpdateInstallDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-xl p-4">
          <DialogHeader>
            <DialogTitle>Update siap dipasang</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">File update sudah tersimpan di HP Anda.</p>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
              <p>1. Tekan Install Update</p>
              <p>2. Jika diminta izin, aktifkan "Izinkan dari sumber ini"</p>
              <p>3. Kembali ke aplikasi, lalu tekan Install Update lagi</p>
              <p>4. Jika masih gagal, buka lewat File Manager: {downloadedApkName ?? 'alaalakasir-latest.apk'}</p>
            </div>
            <Button type="button" className="w-full h-9 text-xs" onClick={handleInstallDownloadedApkDirect}>
              Install Update
            </Button>
            <Button type="button" variant="outline" className="w-full h-9 text-xs" onClick={handleInstallViaFileManager}>
              Buka File Manager
            </Button>
            <Button type="button" variant="ghost" className="w-full h-9 text-xs text-muted-foreground" onClick={handleOpenInstallPermissionSettings}>
              Buka Pengaturan Izin
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={storeDialog} onOpenChange={setStoreDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>Info Toko</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Logo picker */}
            <div className="space-y-1.5">
              <Label>Logo Toko</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {storeLogo ? (
                    <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {storeLogo ? 'Ganti Logo' : 'Pilih Logo'}
                  </Button>
                  {storeLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive gap-1.5"
                      onClick={() => setStoreLogo(undefined)}
                    >
                      <X className="w-3.5 h-3.5" />
                      Hapus Logo
                    </Button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Nama Toko</Label><Input value={storeName} onChange={e => setStoreName(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>Alamat</Label><Input value={storeAddr} onChange={e => setStoreAddr(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>Telepon</Label><Input value={storePhone} onChange={e => setStorePhone(e.target.value)} className="h-11" type="tel" /></div>
            <Button className="w-full h-11" onClick={saveStore}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{pmEditId ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama</Label><Input value={pmName} onChange={e => setPmName(e.target.value)} placeholder="Contoh: Transfer BCA" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <div className="grid grid-cols-4 gap-2">
                {['tunai', 'transfer', 'e-wallet', 'qris'].map(c => (
                  <button key={c} onClick={() => setPmCategory(c)} className={`p-2 rounded-lg text-xs font-semibold border-2 capitalize transition-colors ${pmCategory === c ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <Button className="w-full h-11" onClick={savePm} disabled={!pmName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{catEditId ? 'Edit' : 'Tambah'} Kategori</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Kategori</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Contoh: Snack" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(e => (
                  <button key={e} onClick={() => setCatIcon(e)} className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${catIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="w-full h-11" onClick={saveCat} disabled={!catName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
