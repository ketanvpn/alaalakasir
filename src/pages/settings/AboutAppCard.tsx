import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CURRENT_APP_VERSION, checkForAppUpdate, type AppUpdateInfo } from '@/lib/update-check';
import { ApkInstaller } from '@/lib/apk-installer';

const SUPPORT_QRIS_URL = '/support/qris-ketantech.png';
const UPDATE_APK_PATH = 'alaalakasir-latest.apk';
const FEEDBACK_WHATSAPP_NUMBER = '6282397803813';

export function AboutAppCard() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [downloadedApkUri, setDownloadedApkUri] = useState<string | null>(null);
  const [downloadedApkName, setDownloadedApkName] = useState<string | null>(null);
  const [updateInstallDialog, setUpdateInstallDialog] = useState(false);
  const [supportQrisDialog, setSupportQrisDialog] = useState(false);

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
        toast.info('Belum ada tag versi baru');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengecek update');
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
        toast.error('Izin penyimpanan dibutuhkan untuk mengunduh update.');
        return;
      }

      setDownloadingUpdate(true);
      setUpdateProgress(0);

      const downloadResult = await Filesystem.downloadFile({
        url: updateInfo.apkUrl,
        path: UPDATE_APK_PATH,
        directory: Directory.Documents,
        recursive: true,
        progress: true,
      });

      if (downloadResult.path) {
        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: UPDATE_APK_PATH,
        });

        const uri = fileUri.uri;
        setDownloadedApkUri(uri);
        setDownloadedApkName(UPDATE_APK_PATH);
        setUpdateInstallDialog(true);
        toast.success('Update berhasil diunduh! Silakan pasang update.');

        try {
          const installResult = await ApkInstaller.install({ path: uri });
          if (installResult.permissionRequired) {
            toast.info('Aktifkan izin install dari aplikasi ini, lalu kembali dan tekan Install Update lagi.');
            await ApkInstaller.openInstallPermissionSettings();
          }
        } catch (e) {
          console.warn('Auto-install prompt deferred to user manual action:', e);
        }
      } else {
        throw new Error('Gagal mengunduh file update');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh update');
    } finally {
      setDownloadingUpdate(false);
    }
  };

  const handleInstallDownloadedApkDirect = async () => {
    if (!downloadedApkUri) {
      toast.error('File update belum tersedia. Silakan unduh ulang.');
      return;
    }
    try {
      const result = await ApkInstaller.install({ path: downloadedApkUri });
      if (result.permissionRequired) {
        toast.info('Aktifkan izin install dari aplikasi ini, lalu kembali dan tekan Install lagi.');
        await ApkInstaller.openInstallPermissionSettings();
        return;
      }
      toast.info('Lanjutkan proses instalasi pada layar Android.');
    } catch {
      toast.error('Gagal membuka installer APK langsung. Coba opsi Buka File Manager.');
    }
  };

  const handleInstallViaFileManager = async () => {
    if (!downloadedApkUri) {
      toast.error('File update belum tersedia.');
      return;
    }
    try {
      await Share.share({
        title: 'Buka APK Update AlaalaKasir',
        text: 'Pilih aplikasi File Manager / Pengelola File, lalu pasang file APK update.',
        url: downloadedApkUri,
        dialogTitle: 'Pilih aplikasi pembuka APK',
      });
    } catch {
      toast.error('Gagal membuka opsi alternatif instal APK.');
    }
  };

  const handleOpenInstallPermissionSettings = async () => {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        await ApkInstaller.openInstallPermissionSettings();
        toast.info('Aktifkan izin "Izinkan dari sumber ini", lalu kembali ke aplikasi.');
        return;
      }
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
    } catch {
      toast.error('Gagal membuka pengaturan izin aplikasi.');
    }
  };

  const handleSendFeedback = () => {
    const text = encodeURIComponent(
      `Halo Tim AlaalaKasir, saya menggunakan versi v${CURRENT_APP_VERSION.replace(/^v/i, '')} dan ingin memberikan masukan:`
    );
    window.open(`https://wa.me/${FEEDBACK_WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  return (
    <>
      <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4 text-center space-y-3">
          <div>
            <p className="text-base font-extrabold text-foreground">AlaalaKasir POS</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sistem Kasir Offline-First untuk UMKM Indonesia 🇮🇩</p>
            <p className="text-[11px] text-primary font-semibold mt-1">
              v{CURRENT_APP_VERSION.replace(/^v/i, '')} • Data Tersimpan di Perangkat
            </p>
          </div>

          {/* Update Section */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-left space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">Pembaruan Aplikasi</p>
                <p className="text-[10px] text-muted-foreground">
                  {updateInfo?.latestVersion
                    ? `Versi baru tersedia: ${updateInfo.latestVersion}`
                    : 'Periksa ketersediaan versi terbaru aplikasi'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg font-semibold"
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
              >
                {checkingUpdate ? 'Mengecek...' : 'Cek Update'}
              </Button>
            </div>

            {updateInfo?.updateAvailable && (
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full h-9 text-xs font-bold rounded-xl shadow-sm"
                  onClick={handleDownloadAndInstallUpdate}
                  disabled={downloadingUpdate}
                >
                  {downloadingUpdate ? `Mengunduh... ${updateProgress}%` : 'Update Sekarang'}
                </Button>

                {downloadedApkUri && (
                  <div className="pt-1 space-y-1.5 border-t border-border/50">
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ APK Update Siap Dipasang ({downloadedApkName})
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs font-bold rounded-lg"
                        onClick={handleInstallDownloadedApkDirect}
                      >
                        Pasang / Install APK
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-lg"
                        onClick={() => setUpdateInstallDialog(true)}
                      >
                        Bantuan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              className="h-10 text-xs font-semibold rounded-xl border-border/70"
              onClick={handleSendFeedback}
            >
              💬 Kirim Masukan via WA
            </Button>
            <Button
              variant="outline"
              className="h-10 text-xs font-semibold rounded-xl border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={() => setSupportQrisDialog(true)}
            >
              💳 Dukung via QRIS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Update Installation Dialog */}
      <Dialog open={updateInstallDialog} onOpenChange={setUpdateInstallDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">Pasang Pembaruan Aplikasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 text-sm">
            <p className="text-xs text-muted-foreground text-center">
              File update telah berhasil disimpan ke perangkat Anda.
            </p>
            <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Petunjuk Pemasangan:</p>
              <p>1. Tekan tombol <strong className="text-foreground">Pasang / Install APK</strong> di bawah.</p>
              <p>2. Jika Android meminta izin, aktifkan <strong className="text-foreground">"Izinkan dari sumber ini"</strong>.</p>
              <p>3. Jika installer tidak terbuka, gunakan tombol <strong className="text-foreground">Buka via File Manager</strong>.</p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                className="w-full h-10 text-xs font-bold rounded-xl"
                onClick={handleInstallDownloadedApkDirect}
              >
                Pasang / Install APK Sekarang
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 text-xs font-semibold rounded-xl"
                onClick={handleInstallViaFileManager}
              >
                Buka via File Manager / Bagikan
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-9 text-xs text-muted-foreground"
                onClick={handleOpenInstallPermissionSettings}
              >
                Buka Pengaturan Izin Instalasi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QRIS Support Dialog */}
      <Dialog open={supportQrisDialog} onOpenChange={setSupportQrisDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-4">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">Dukung Pengembang via QRIS</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/20 p-2 my-2">
            <img
              src={SUPPORT_QRIS_URL}
              alt="QRIS Dukungan AlaalaKasir"
              className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Scan QRIS ini menggunakan aplikasi e-wallet atau mobile banking Anda.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
