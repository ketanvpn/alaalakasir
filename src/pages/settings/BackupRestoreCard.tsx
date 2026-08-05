import React, { useState } from 'react';
import { Download, Upload, Share2, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  backupHasData,
  exportBackupData,
  isBackupData,
  restoreBackupData,
  shareLatestBackupFile,
} from '@/lib/services/backupService';

export interface BackupRestoreCardProps {
  storageUsage: { usage: number; quota: number } | null;
}

export function BackupRestoreCard({ storageUsage }: BackupRestoreCardProps) {
  const [importingBackup, setImportingBackup] = useState(false);
  const [savingBackup, setSavingBackup] = useState(false);
  const [sharingBackup, setSharingBackup] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<unknown>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleImport = () => {
    if (importingBackup) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportingBackup(true);
      try {
        const text = await file.text();
        if (!text.trim()) {
          toast.error('File backup kosong');
          return;
        }
        const data: unknown = JSON.parse(text);
        if (!isBackupData(data)) {
          toast.error('Format file backup tidak valid');
          return;
        }
        if (!backupHasData(data)) {
          toast.error('File backup tidak memiliki isi data');
          return;
        }
        setPendingBackupData(data);
        setRestoreConfirmOpen(true);
      } catch {
        toast.error('Gagal membaca file backup');
      } finally {
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
      toast.success('Data berhasil di-restore! Aplikasi akan dimuat ulang...');
      setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import gagal';
      toast.error(`${message}. Data lama tetap aman dipertahankan.`);
    } finally {
      setImportingBackup(false);
    }
  };

  return (
    <>
      <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            Cadangkan & Pulihkan Data
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 pt-2 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Data AlaalaKasir tersimpan 100% offline di memori perangkat ini. Rutin lakukan pencadangan data ke Google Drive atau WhatsApp agar aman.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl border-border/70 font-semibold gap-1.5 justify-center shadow-sm"
              onClick={handleSaveBackup}
              disabled={savingBackup}
            >
              <Download className="w-4 h-4 text-primary" />
              {savingBackup ? 'Menyimpan...' : 'Simpan Backup'}
            </Button>

            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl border-border/70 font-semibold gap-1.5 justify-center shadow-sm"
              onClick={handleShareBackup}
              disabled={sharingBackup}
            >
              <Share2 className="w-4 h-4 text-primary" />
              {sharingBackup ? 'Membagikan...' : 'Kirim / Share'}
            </Button>

            <Button
              variant="outline"
              className="h-10 text-xs rounded-xl border-border/70 font-semibold gap-1.5 justify-center shadow-sm"
              onClick={handleImport}
              disabled={importingBackup}
            >
              <Upload className="w-4 h-4 text-amber-500" />
              {importingBackup ? 'Memproses...' : 'Restore Backup'}
            </Button>
          </div>

          {storageUsage && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Penyimpanan Lokal Terpakai</span>
                <span className="font-semibold text-foreground">
                  {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (storageUsage.usage / storageUsage.quota) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoreConfirmOpen}
        onOpenChange={open => {
          setRestoreConfirmOpen(open);
          if (!open && !importingBackup) setPendingBackupData(null);
        }}
        variant="destructive"
        title="Restore Data Backup?"
        description="Semua data saat ini akan ditimpa dengan isi file backup yang Anda pilih. Pastikan Anda telah memilih file yang tepat."
        confirmLabel={importingBackup ? 'Memproses...' : 'Lanjutkan Restore'}
        onConfirm={handleConfirmRestore}
      />
    </>
  );
}
