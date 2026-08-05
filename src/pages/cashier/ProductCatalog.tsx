import React, { useRef, useEffect } from 'react';
import { Search, ScanBarcode, Package as PackageIcon, Plus, Barcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MoneyText } from '@/components/ui/money-text';
import { cn } from '@/lib/utils';
import type { Product, Category } from '@/lib/db';

export interface ProductCatalogProps {
  products: Product[];
  categories: Category[];
  search: string;
  onSearchChange: (val: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (catId: string) => void;
  onAddToCart: (product: Product) => void;
  cartProductCounts: Map<number, number>;
  onOpenScanner: () => void;
  onBarcodeSubmit: (code: string) => void;
}

export function ProductCatalog({
  products,
  categories,
  search,
  onSearchChange,
  filterCategory,
  onFilterCategoryChange,
  onAddToCart,
  cartProductCounts,
  onOpenScanner,
  onBarcodeSubmit,
}: ProductCatalogProps) {
  const [scanInput, setScanInput] = React.useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleBarcodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      onBarcodeSubmit(scanInput.trim());
      setScanInput('');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Hidden scan input for physical USB/BT barcode scanners */}
      <input
        ref={scanInputRef}
        type="text"
        value={scanInput}
        onChange={e => setScanInput(e.target.value)}
        onKeyDown={handleBarcodeKeyPress}
        className="opacity-0 absolute -top-10 left-0 h-0 w-0 pointer-events-none"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Sticky Search & Filter Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pt-0.5 pb-2 -mx-1 px-1 mb-2">
        {/* Search & Action Bar */}
        <div className="flex gap-2 mb-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau barcode produk..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 h-11 text-sm bg-card rounded-xl border-border/60 shadow-sm"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenScanner}
            className="h-11 w-11 shrink-0 rounded-xl bg-card border-border/60 shadow-sm hover:bg-primary/5 hover:border-primary"
            title="Scan Barcode Kamera"
          >
            <ScanBarcode className="w-5 h-5 text-primary" />
          </Button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Button
            size="sm"
            variant={filterCategory === 'all' ? 'default' : 'secondary'}
            onClick={() => onFilterCategoryChange('all')}
            className="rounded-full text-xs h-8 px-3.5 shrink-0"
          >
            Semua ({products.length})
          </Button>
          {categories.map(cat => (
            <Button
              key={cat.id}
              size="sm"
              variant={filterCategory === cat.id!.toString() ? 'default' : 'secondary'}
              onClick={() => onFilterCategoryChange(cat.id!.toString())}
              className="rounded-full text-xs h-8 px-3.5 shrink-0"
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/40 p-6 flex-1 flex flex-col items-center justify-center">
          <PackageIcon className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-base font-semibold text-foreground">Tidak ada produk ditemukan</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Coba ubah kata kunci pencarian atau kategori yang dipilih
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 pb-24 lg:pb-6">
          {products.map(product => {
            const inCartQty = cartProductCounts.get(product.id!) || 0;
            const isOutOfStock = product.stock <= 0;

            return (
              <Card
                key={product.id}
                onClick={() => !isOutOfStock && onAddToCart(product)}
                className={cn(
                  'group relative overflow-hidden transition-all duration-200 border border-border/60 bg-card rounded-xl select-none',
                  isOutOfStock
                    ? 'opacity-60 cursor-not-allowed bg-muted/40'
                    : 'cursor-pointer hover:border-primary hover:shadow-md active:scale-[0.98]'
                )}
              >
                {inCartQty > 0 && (
                  <Badge className="absolute top-2 right-2 z-10 text-[10px] h-5 px-1.5 font-bold shadow-sm bg-primary text-primary-foreground">
                    {inCartQty}
                  </Badge>
                )}

                <CardContent className="p-3 flex flex-col justify-between h-full min-h-[110px]">
                  <div>
                    <h3 className="font-semibold text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    {product.barcode && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Barcode className="w-3 h-3 shrink-0" />
                        <span className="truncate">{product.barcode}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/40 flex items-end justify-between gap-1">
                    <div>
                      <MoneyText value={product.price} className="text-xs font-bold text-primary block" />
                      <span className={cn(
                        'text-[10px] font-medium block mt-0.5',
                        product.stock <= 5 ? 'text-destructive font-bold' : 'text-muted-foreground'
                      )}>
                        Stok: {product.stock} {product.unit || 'pcs'}
                      </span>
                    </div>

                    {!isOutOfStock && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
