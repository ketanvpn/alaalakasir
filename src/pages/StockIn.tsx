import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';
import { ArrowDownToLine, Plus, Search, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { addStockIn } from '@/lib/services/stockService';
import { formatThousandsInput, sanitizeNumericInput } from '@/lib/number-input';

export default function StockInPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');

  const stockIns = useLiveQuery(() => db.stockIns.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const suppliers = useLiveQuery(() => db.suppliers.where('isDeleted').equals(0).toArray());

  const filtered = stockIns?.filter(si =>
    filterSupplier === 'all' || si.supplierId === Number(filterSupplier)
  ) ?? [];

  const getProductName = (pid: number) => products?.find(p => p.id === pid)?.name ?? '-';
  const getSupplierName = (sid: number) => suppliers?.find(s => s.id === sid)?.name ?? '-';

  const openAdd = () => {
    setProductId(''); setSupplierId(''); setQuantity(''); setBuyPrice(''); setNotes('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    const price = Number(buyPrice);
    if (!productId || !supplierId || !Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      toast.error('Lengkapi semua field dengan benar (jumlah harus bilangan bulat).');
      return;
    }

    try {
      const result = await addStockIn({
        productId: Number(productId),
        supplierId: Number(supplierId),
        quantity: qty,
        buyPrice: price,
        notes: notes.trim(),
      });

      toast.success(`Stok ${result.product.name} bertambah ${result.quantity}. HPP: Rp ${result.newHpp.toLocaleString('id-ID')}`);
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan stok masuk');
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 h-[calc(var(--app-height,100vh)-4.5rem)] flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-success" />
            Stok Masuk
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      <Select value={filterSupplier} onValueChange={setFilterSupplier}>
        <SelectTrigger className="h-10"><SelectValue placeholder="Filter Supplier" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Supplier</SelectItem>
          {suppliers?.map(s => <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">{filtered.length} catatan</p>

      <div className="flex-1 overflow-y-auto pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <ArrowDownToLine className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada data stok masuk</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(si => (
              <Card key={si.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{getProductName(si.productId)}</h3>
                      <p className="text-xs text-muted-foreground">dari {getSupplierName(si.supplierId)}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded">+{si.quantity}</span>
                        <span className="text-xs text-muted-foreground">@ Rp {si.buyPrice.toLocaleString('id-ID')}</span>
                      </div>
                      {si.notes && <p className="text-xs text-muted-foreground mt-1 italic">{si.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{format(new Date(si.date), 'dd MMM yy', { locale: id })}</p>
                      <p className="text-sm font-bold mt-1">Rp {si.totalPrice.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>Tambah Stok Masuk</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Produk *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.name} (stok: {p.stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jumlah *</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="10" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Harga Beli/Unit *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatThousandsInput(buyPrice)}
                  onChange={e => setBuyPrice(sanitizeNumericInput(e.target.value))}
                  placeholder="5.000"
                  className="h-11"
                />
              </div>
            </div>
            {quantity && buyPrice && (
              <div className="bg-muted/50 p-3 rounded-xl text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold">Rp {(Number(quantity) * Number(buyPrice)).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" className="h-11" /></div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave}>Simpan Stok Masuk</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
