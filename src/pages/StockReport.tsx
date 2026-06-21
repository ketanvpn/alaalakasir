import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useMemo, useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, TrendingUp, AlertTriangle, Warehouse, BarChart3, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { PeriodFilter } from '@/components/PeriodFilter';
import { useReportPeriod } from '@/lib/hooks/useReportPeriod';
import {
  buildTimestampedFileName,
  exportToFile,
  productsToCsv,
  stockMovementsToCsv,
} from '@/lib/exporters/reportExporter';

export default function StockReport() {
  const period = useReportPeriod('30');
  const { range, spanDays } = period;
  const [exporting, setExporting] = useState(false);

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const stockIns = useLiveQuery(
    () => db.stockIns.where('date').between(range.from, range.to, true, true).toArray(),
    [range.from.getTime(), range.to.getTime()]
  );
  const stockOuts = useLiveQuery(
    () => db.stockOuts.where('date').between(range.from, range.to, true, true).toArray(),
    [range.from.getTime(), range.to.getTime()]
  );

  const totalStockIn = stockIns?.reduce((s, si) => s + si.quantity, 0) ?? 0;
  const totalStockInValue = stockIns?.reduce((s, si) => s + si.totalPrice, 0) ?? 0;
  const totalStockOut = stockOuts?.reduce((s, so) => s + so.quantity, 0) ?? 0;

  const stockOutByReason = stockOuts?.reduce((acc, so) => {
    acc[so.reason] = (acc[so.reason] || 0) + so.quantity;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const currentStock = products?.reduce((s, p) => s + p.stock, 0) ?? 0;
  const lowStockProducts = products?.filter(p => p.stock > 0 && p.stock <= 5) ?? [];
  const outOfStockProducts = products?.filter(p => p.stock === 0) ?? [];

  const getProductName = (pid: number) => products?.find(p => p.id === pid)?.name ?? '-';

  const chartData = useMemo(() => {
    const map: Record<string, { stockIn: number; stockOut: number }> = {};
    for (const d of eachDayOfInterval({ start: startOfDay(range.from), end: endOfDay(range.to) })) {
      map[format(d, 'dd/MM')] = { stockIn: 0, stockOut: 0 };
    }
    stockIns?.forEach(si => {
      const d = format(new Date(si.date), 'dd/MM');
      if (map[d]) map[d].stockIn += si.quantity;
    });
    stockOuts?.forEach(so => {
      const d = format(new Date(so.date), 'dd/MM');
      if (map[d]) map[d].stockOut += so.quantity;
    });
    return Object.entries(map).map(([date, data]) => ({ date, ...data }));
  }, [stockIns, stockOuts, range.from, range.to]);

  const stockMovementData = useMemo(() => {
    const map: Record<string, number> = {};
    let cumulative = 0;
    for (const d of eachDayOfInterval({ start: startOfDay(range.from), end: endOfDay(range.to) })) {
      map[format(d, 'dd/MM')] = 0;
    }
    stockIns?.forEach(si => {
      const d = format(new Date(si.date), 'dd/MM');
      if (map[d] !== undefined) map[d] += si.quantity;
    });
    stockOuts?.forEach(so => {
      const d = format(new Date(so.date), 'dd/MM');
      if (map[d] !== undefined) map[d] -= so.quantity;
    });
    return Object.entries(map).map(([date, movement]) => {
      cumulative += movement;
      return { date, stock: cumulative };
    });
  }, [stockIns, stockOuts, range.from, range.to]);

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const reasonLabels: Record<string, string> = {
    rusak: 'Rusak',
    hilang: 'Hilang',
    retur: 'Retur',
    expired: 'Expired',
    sample: 'Sample',
    lain: 'Lainnya',
  };

  const handleExport = async () => {
    if (exporting) return;
    if ((!stockIns || stockIns.length === 0) && (!stockOuts || stockOuts.length === 0) && (!products || products.length === 0)) {
      toast.info('Belum ada data untuk diekspor pada rentang ini');
      return;
    }
    setExporting(true);
    try {
      // Mutasi stok (masuk + keluar) pada rentang terpilih
      const movementRows = [
        ...(stockIns ?? []).map((si) => ({
          date: si.date,
          type: 'masuk' as const,
          productName: getProductName(si.productId),
          quantity: si.quantity,
          unitPrice: si.buyPrice,
          total: si.totalPrice,
        })),
        ...(stockOuts ?? []).map((so) => ({
          date: so.date,
          type: 'keluar' as const,
          productName: getProductName(so.productId),
          quantity: so.quantity,
          reason: reasonLabels[so.reason] ?? so.reason,
        })),
      ];

      if (movementRows.length > 0) {
        await exportToFile({
          fileName: buildTimestampedFileName('mutasi-stok', 'csv'),
          content: stockMovementsToCsv(movementRows),
          successMessage: 'Laporan mutasi stok tersimpan',
        });
      }

      // Snapshot stok saat ini (nilai stok)
      if (products && products.length > 0) {
        await exportToFile({
          fileName: buildTimestampedFileName('nilai-stok', 'csv'),
          content: productsToCsv(
            products.map((p) => ({
              name: p.name,
              sku: p.sku,
              unit: p.unit,
              stock: p.stock,
              hpp: p.hpp,
              price: p.price,
              stockValue: p.hpp * p.stock,
            }))
          ),
          successMessage: 'Laporan nilai stok tersimpan',
        });
      }
    } catch {
      // toast already fired inside exportToFile
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-primary" />
          Laporan Stok
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Mengekspor...' : 'Export'}
        </Button>
      </div>

      <PeriodFilter period={period} />

      <p className="text-xs text-muted-foreground -mt-2">
        Menampilkan data: <span className="font-medium text-foreground">{period.rangeLabel}</span>
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ArrowDownToLine className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-lg font-bold">{totalStockIn}</p>
            <p className="text-[10px] text-muted-foreground">Masuk</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ArrowUpFromLine className="w-4 h-4 mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold">{totalStockOut}</p>
            <p className="text-[10px] text-muted-foreground">Keluar</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{currentStock}</p>
            <p className="text-[10px] text-muted-foreground">Tersedia</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock In Value */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-success" />
            Nilai Stok Masuk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Pembelian</span>
            <span className="text-lg font-bold text-success">{rp(totalStockInValue)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Rata-rata: {totalStockIn > 0 ? rp(totalStockInValue / totalStockIn) : rp(0)} per unit
          </p>
        </CardContent>
      </Card>

      {/* Stock Movement Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Pergerakan Stok
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={spanDays > 14 ? Math.floor(spanDays / 7) : 0}
              />
              <YAxis hide />
              <Tooltip 
                formatter={(v: number, name: string) => [v, name === 'stockIn' ? 'Masuk' : 'Keluar']} 
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontSize: 10 }}
              />
              <Bar dataKey="stockIn" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} name="Masuk" />
              <Bar dataKey="stockOut" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} name="Keluar" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stock Out by Reason */}
      {Object.keys(stockOutByReason).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ArrowUpFromLine className="w-4 h-4 text-destructive" />
              Alasan Stock Keluar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stockOutByReason).map(([reason, qty]) => (
              <div key={reason} className="flex items-center justify-between">
                <span className="text-sm">{reasonLabels[reason] || reason}</span>
                <span className="font-semibold text-destructive">{qty} unit</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-0 shadow-sm border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-warning">
              <AlertTriangle className="w-4 h-4" />
              Stok Menipis ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockProducts.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{p.name}</span>
                <span className="text-sm font-bold text-warning">{p.stock} {p.unit}</span>
              </div>
            ))}
            {lowStockProducts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">+{lowStockProducts.length - 5} produk lainnya</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Out of Stock */}
      {outOfStockProducts.length > 0 && (
        <Card className="border-0 shadow-sm border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-destructive">
              <Package className="w-4 h-4" />
              Stok Habis ({outOfStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outOfStockProducts.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{p.name}</span>
                <span className="text-xs text-destructive">0 {p.unit}</span>
              </div>
            ))}
            {outOfStockProducts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">+{outOfStockProducts.length - 5} produk lainnya</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
