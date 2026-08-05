import React, { useState, useRef } from 'react';
import { Store, Edit2, Camera, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-utils';
import { db, type StoreSettings } from '@/lib/db';

export interface StoreProfileCardProps {
  storeSettings?: StoreSettings;
}

export function StoreProfileCard({ storeSettings }: StoreProfileCardProps) {
  const [storeDialog, setStoreDialog] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddr, setStoreAddr] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeLogo, setStoreLogo] = useState<string | undefined>(undefined);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const openStoreEdit = () => {
    setStoreName(storeSettings?.storeName ?? '');
    setStoreAddr(storeSettings?.address ?? '');
    setStorePhone(storeSettings?.phone ?? '');
    setStoreLogo(storeSettings?.logo);
    setStoreDialog(true);
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

  const saveStore = async () => {
    if (!storeName.trim()) {
      toast.error('Nama toko wajib diisi');
      return;
    }

    if (storeSettings?.id) {
      try {
        await db.storeSettings.update(storeSettings.id, {
          storeName: storeName.trim(),
          address: storeAddr.trim(),
          phone: storePhone.trim(),
          logo: storeLogo || undefined,
        });
        toast.success('Info toko berhasil disimpan');
        setStoreDialog(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan info toko');
      }
    }
  };

  return (
    <>
      <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-primary/20">
              {storeSettings?.logo ? (
                <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">
                {storeSettings?.storeName || 'AlaalaKasir Store'}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {storeSettings?.address || 'Alamat belum diatur'}
              </p>
              {storeSettings?.phone && (
                <p className="text-[11px] text-muted-foreground">Telp: {storeSettings.phone}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-xl border-border/70 text-xs font-semibold gap-1.5 shrink-0"
            onClick={openStoreEdit}
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Info
          </Button>
        </CardContent>
      </Card>

      <Dialog open={storeDialog} onOpenChange={setStoreDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">Informasi Toko</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Logo picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Logo Toko (Struk & Profil)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
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
                    className="h-8 text-xs gap-1.5 rounded-lg"
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
                      className="h-8 text-xs text-destructive gap-1.5 rounded-lg"
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Toko</Label>
              <Input
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="h-10 text-sm rounded-xl"
                maxLength={100}
                placeholder="Contoh: Toko Berkah Jaya"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Alamat Lengkap</Label>
              <Input
                value={storeAddr}
                onChange={e => setStoreAddr(e.target.value)}
                className="h-10 text-sm rounded-xl"
                maxLength={200}
                placeholder="Contoh: Jl. Merdeka No. 45"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nomor Telepon / WhatsApp</Label>
              <Input
                value={storePhone}
                onChange={e => setStorePhone(e.target.value)}
                className="h-10 text-sm rounded-xl"
                type="tel"
                maxLength={20}
                placeholder="Contoh: 081234567890"
              />
            </div>

            <Button className="w-full h-11 text-sm font-bold rounded-xl mt-2" onClick={saveStore}>
              Simpan Profil Toko
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
