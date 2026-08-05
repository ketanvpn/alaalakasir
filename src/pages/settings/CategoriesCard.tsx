import React, { useState } from 'react';
import { Tag, Plus, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { db, type Category } from '@/lib/db';
import { cn } from '@/lib/utils';

export interface CategoriesCardProps {
  categories?: Category[];
  categoryActiveUsage?: Record<number, number>;
}

export function CategoriesCard({ categories = [], categoryActiveUsage = {} }: CategoriesCardProps) {
  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#FF6B35');
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [deleteCatConfirmOpen, setDeleteCatConfirmOpen] = useState(false);
  const [pendingDeleteCatId, setPendingDeleteCatId] = useState<number | null>(null);

  const emojiOptions = ['📦', '🍕', '🥤', '🍜', '🧃', '🎽', '💊', '🧹', '📱', '🛒', '🎁', '✂️'];

  const openCatAdd = () => {
    setCatEditId(null);
    setCatName('');
    setCatIcon('📦');
    setCatColor('#FF6B35');
    setCatDialog(true);
  };

  const openCatEdit = (c: Category) => {
    setCatEditId(c.id!);
    setCatName(c.name);
    setCatIcon(c.icon);
    setCatColor(c.color);
    setCatDialog(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    try {
      if (catEditId) {
        await db.categories.update(catEditId, { name: catName.trim(), icon: catIcon, color: catColor });
      } else {
        await db.categories.add({
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
          createdAt: new Date(),
          isDeleted: 0,
          deletedAt: null,
        });
      }
      setCatDialog(false);
      toast.success('Kategori produk berhasil disimpan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kategori');
    }
  };

  const getCategoryDeleteBlockReason = (id: number) => {
    if ((categoryActiveUsage[id] ?? 0) > 0) {
      return 'Kategori tidak dapat dihapus karena masih dipakai oleh produk aktif';
    }
    return null;
  };

  const requestDeleteCat = (id: number) => {
    const reason = getCategoryDeleteBlockReason(id);
    if (reason) {
      toast.error(reason);
      return;
    }
    setPendingDeleteCatId(id);
    setDeleteCatConfirmOpen(true);
  };

  const confirmDeleteCat = async () => {
    if (!pendingDeleteCatId) return;
    try {
      await db.categories.update(pendingDeleteCatId, { isDeleted: 1, deletedAt: new Date() });
      toast.success('Kategori berhasil dihapus');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus kategori');
    } finally {
      setDeleteCatConfirmOpen(false);
      setPendingDeleteCatId(null);
    }
  };

  return (
    <>
      <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Kategori Produk
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-xl border-border/70 font-semibold gap-1"
            onClick={openCatAdd}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah
          </Button>
        </CardHeader>

        <CardContent className="p-4 pt-2 space-y-2">
          {categories.map(cat => {
            const productCount = categoryActiveUsage[cat.id!] ?? 0;
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">{productCount} produk terdaftar</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary"
                    onClick={() => openCatEdit(cat)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                    onClick={() => requestDeleteCat(cat.id!)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">
              {catEditId ? 'Edit' : 'Tambah'} Kategori
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Kategori</Label>
              <Input
                value={catName}
                onChange={e => setCatName(e.target.value)}
                placeholder="Contoh: Makanan / Minuman"
                className="h-10 text-sm rounded-xl"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ikon Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setCatIcon(e)}
                    className={cn(
                      'w-10 h-10 rounded-xl text-lg flex items-center justify-center border-2 transition-all',
                      catIcon === e ? 'border-primary bg-primary/10 scale-105 shadow-sm' : 'border-border/60 bg-muted/40'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Warna Aksen Kategori</Label>
              <Input
                type="color"
                value={catColor}
                onChange={e => setCatColor(e.target.value)}
                className="h-10 w-24 p-1 rounded-xl cursor-pointer"
              />
            </div>
            <Button
              className="w-full h-11 text-sm font-bold rounded-xl mt-2"
              onClick={saveCat}
              disabled={!catName.trim()}
            >
              Simpan Kategori
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteCatConfirmOpen}
        onOpenChange={setDeleteCatConfirmOpen}
        variant="destructive"
        title="Hapus Kategori?"
        description="Kategori ini akan dihapus dari daftar. Produk yang sudah ada tidak akan terhapus."
        confirmLabel="Ya, Hapus"
        onConfirm={confirmDeleteCat}
      />
    </>
  );
}
