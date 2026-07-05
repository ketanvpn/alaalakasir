import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '@/lib/db';
import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, ArrowDown, ArrowUp, Minus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { PeriodFilter } from '@/components/PeriodFilter';
import { useReportPeriod } from '@/lib/hooks/useReportPeriod';
import { getCompletedTransactionsBetween } from '@/lib/services/dashboardService';
import {
  buildTimestampedFileName,
  exportToFile,
  salesSummaryToCsv,
  topProductsToCsv,
} from '@/lib/exporters/reportExporter';

export default function Laporan() {
  const period = useReportPeriod('30');
  const { range, spanDays } = period;
  const [exporting, setExporting] = useState(false);

  const transactions = useLiveQuery<Transaction[]>(
    () => getCompletedTransactionsBetween(range.from, range.to),
    [range.from.getTime(), range.to.getTime()]
  );

  // Query transaction items for the filtered transactions
  const txItems = useLiveQuery(async () => {
    if (!transactions || transactions.length === 0) return [];
    const txIds = transactions.map(t => t.id!).filter(Boolean);
    return db.transactionItems.where('transactionId').anyOf(txIds).toArray();
  }, [transactions]);

  const allItems = txItems ?? [];

  const totalSales = transactions?.reduce((s, t) => s + t.total, 0) ?? 0;
  const txCount = transactions?.length ?? 0;

  // P&L breakdown
  const totalRevenue = transactions?.reduce((s, t) => s + t.subtotal, 0) ?? 0;
  const totalDiscount = transactions?.reduce((s, t) => s + t.discountAmount, 0) ?? 0;
  const totalHpp = allItems.reduce((s, item) => s + item.hpp * item.quantity, 0);
  const netSales = totalRevenue - totalDiscount;
  const grossProfit = netSales - totalHpp;
  const totalProfit = grossProfit;
  const marginPercent = netSales > 0 ? (grossProfit / netSales * 100) : 0;

  // Chart data — bucket every day in the range so empty days still render.
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of eachDayOfInterval({ start: startOfDay(range.from), end: endOfDay(range.to) })) {
      map[format(d, 'dd/MM')] = 0;
    }
    transactions?.forEach(t => {
      const d = format(new Date(t.date), 'dd/MM');
      if (map[d] !== undefined) map[d] += t.total;
    });
    return Object.entries(map).map(([date, sales]) => ({ date, sales }));
  }, [transactions, range.from, range.to]);

  // Top products
  const productSales = useMemo(() => {
    const acc: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
    allItems.forEach(item => {
      if (!acc[item.productName]) acc[item.productName] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
      acc[item.productName].qty += item.quantity;
      acc[item.productName].revenue += item.subtotal;
      acc[item.productName].profit += (item.price - item.hpp) * item.quantity - item.discountAmount;
    });
    return Object.values(acc).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [allItems]);

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  // Loading state
  if (transactions === undefined) {
    return (
      <div className="px-4 pt-6 pb-20 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Laporan
          </h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Memuat data laporan...</p>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    if (exporting) return;
    if (!transactions || transactions.length === 0) {
      toast.info('Belum ada transaksi pada rentang ini untuk diekspor');
      return;
    }
    setExporting(true);
    try {
      const summaryCsv = salesSummaryToCsv([
        { label: 'Rentang Laporan', value: period.rangeLabel },
        { label: 'Jumlah Transaksi', value: txCount },
        { label: 'Omzet Kotor', value: totalRevenue },
        { label: 'Diskon', value: totalDiscount },
        { label: 'Penjualan Bersih', value: netSales },
        { label: 'Modal Barang (HPP)', value: totalHpp },
        { label: 'Laba Kotor', value: grossProfit },
        { label: 'Margin (%)', value: marginPercent.toFixed(1) },
      ]);
      await exportToFile({
        fileName: buildTimestampedFileName('laporan-ringkasan', 'csv'),
        content: summaryCsv,
        successMessage: 'Laporan ringkasan tersimpan',
      });

      if (productSales.length > 0) {
        const topCsv = topProductsToCsv(
          productSales.map((p, i) => ({
            rank: i + 1,
            name: p.name,
            qty: p.qty,
            revenue: p.revenue,
            profit: p.profit,
          }))
        );
        await exportToFile({
          fileName: buildTimestampedFileName('laporan-produk-terlaris', 'csv'),
          content: topCsv,
          successMessage: 'Laporan produk terlaris tersimpan',
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
          <BarChart3 className="w-5 h-5 text-primary" />
          Laporan
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={handleExport}
          disabled={exporting || !transactions || transactions.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Mengekspor...' : 'Export'}
        </Button>
      </div>

      <PeriodFilter period={period} />

      <p className="text-xs text-muted-foreground -mt-2">
        Menampilkan data: <span className="font-medium text-foreground">{period.rangeLabel}</span>
      </p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{txCount}</p>
            <p className="text-xs text-muted-foreground">Transaksi</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-sm font-bold">{rp(totalSales)}</p>
            <p className="text-xs text-muted-foreground">Penjualan</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-sm font-bold">{rp(totalProfit)}</p>
            <p className="text-xs text-muted-foreground">Laba Kotor</p>
          </CardContent>
        </Card>
      </div>

      {/* Profit & Loss */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Ringkasan Laba Rugi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-success" />
              <span>Omzet Kotor</span>
            </div>
            <span className="font-semibold">{rp(totalRevenue)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <Minus className="w-3.5 h-3.5" />
                <span>Diskon</span>
              </div>
              <span className="font-semibold">-{rp(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm border-t pt-2">
            <span className="font-medium">Penjualan Bersih</span>
            <span className="font-bold">{rp(netSales)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Modal Barang Terjual (HPP)</span>
            </div>
            <span className="font-semibold">-{rp(totalHpp)}</span>
          </div>
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">Laba Kotor</span>
            <span className={`font-bold ${grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {rp(grossProfit)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Margin (laba/penjualan bersih)</span>
            <span className="font-semibold">{marginPercent.toFixed(1)}%</span>
          </div>
          <div className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground leading-relaxed">
            Rumus: <strong>Penjualan Bersih - Modal Barang (HPP) = Laba Kotor</strong>. Laba kotor belum termasuk biaya operasional seperti listrik, sewa, dan gaji.
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tren Penjualan</CardTitle>
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
              <Tooltip formatter={(v: number) => [`Rp ${v.toLocaleString('id-ID')}`, 'Penjualan']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="sales" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            Produk Terlaris
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productSales.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data penjualan</p>
          ) : (
            <div className="space-y-2">
              {productSales.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{rp(p.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.qty} terjual · laba {rp(p.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
