import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';
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

      const response = await fetch(updateInfo.apkUrl);
      if (!response.ok) throw new Error(`Download gagal (${response.status})`);

      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const fileName = `${UPDATE_APK_PATH}`;

          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64data,
            directory: Directory.Documents,
            recursive: true,
          });

          setDownloadedApkUri(savedFile.uri);
          setDownloadedApkName(fileName);
          setUpdateInstallDialog(true);
          toast.success('Update berhasil diunduh!');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Gagal menyimpan file update');
        } finally {
          setDownloadingUpdate(false);
        }
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      setDownloadingUpdate(false);
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh update');
    }
  };

  const handleInstallDownloadedApkDirect = async () => {
    if (!downloadedApkUri) return;
    try {
      await ApkInstaller.install({ path: downloadedApkUri });
    } catch (err) {
      toast.error('Gagal membuka installer APK');
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
              <Button
                size="sm"
                className="w-full h-8 text-xs font-bold rounded-lg"
                onClick={handleDownloadAndInstallUpdate}
                disabled={downloadingUpdate}
              >
                {downloadingUpdate ? `Mengunduh... ${updateProgress}%` : 'Update Sekarang'}
              </Button>
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
