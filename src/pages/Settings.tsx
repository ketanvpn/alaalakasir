import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Truck, Receipt, Palette, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { useThemeColor, setThemeColor } from '@/hooks/use-theme-color';

import { StoreProfileCard } from './settings/StoreProfileCard';
import { PaymentMethodsCard } from './settings/PaymentMethodsCard';
import { CategoriesCard } from './settings/CategoriesCard';
import { BackupRestoreCard } from './settings/BackupRestoreCard';
import { AboutAppCard } from './settings/AboutAppCard';
import { ReceiptSettingsCard } from './settings/ReceiptSettingsCard';

export default function Settings() {
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());

  const paymentMethodUsage = useLiveQuery(async () => {
    const methods = await db.paymentMethods.toArray();
    const usageMap: Record<number, number> = {};
    for (const method of methods) {
      if (!method.id) continue;
      usageMap[method.id] = await db.transactions.where('paymentMethodId').equals(method.id).count();
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

  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null);
  const themeColor = useThemeColor();

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setStorageUsage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      });
    }
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground tracking-tight">Pengaturan Toko</h1>
      </div>

      {/* 1. Store Profile & Logo */}
      <StoreProfileCard storeSettings={storeSettings} />

      {/* 2. Theme Customizer */}
      <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Tema & Warna Aplikasi</p>
              <p className="text-[10px] text-muted-foreground">Sesuaikan warna aksen kasir</p>
            </div>
          </div>
          <ThemeColorPicker value={themeColor} onChange={setThemeColor} />
        </CardContent>
      </Card>

      {/* 3. Quick Navigation & Receipt Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/supplier" className="block">
          <Card className="border border-border/70 shadow-sm rounded-2xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Supplier & Pemasok</p>
                  <p className="text-[10px] text-muted-foreground">Kelola mitra pemasok barang</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <ReceiptSettingsCard storeSettings={storeSettings} />
      </div>

      {/* 4. Payment Methods Manager */}
      <PaymentMethodsCard
        paymentMethods={paymentMethods}
        paymentMethodUsage={paymentMethodUsage}
      />

      {/* 5. Product Categories Manager */}
      <CategoriesCard
        categories={categories}
        categoryActiveUsage={categoryActiveUsage}
      />

      {/* 6. Backup & Restore Data */}
      <BackupRestoreCard storageUsage={storageUsage} />

      {/* 7. App Info, Update Checker & Donation */}
      <AboutAppCard />
    </div>
  );
}
