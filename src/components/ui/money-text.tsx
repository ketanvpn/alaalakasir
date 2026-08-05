import React from 'react';
import { cn } from '@/lib/utils';

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  prefix?: string;
  showPositiveSign?: boolean;
}

/**
 * Standardized component for displaying Indonesian Rupiah currency values
 */
export const MoneyText = React.forwardRef<HTMLSpanElement, MoneyTextProps>(
  ({ value, prefix = 'Rp ', showPositiveSign = false, className, ...props }, ref) => {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formattedNumber = absValue.toLocaleString('id-ID');

    let sign = '';
    if (isNegative) {
      sign = '-';
    } else if (showPositiveSign && value > 0) {
      sign = '+';
    }

    return (
      <span ref={ref} className={cn('tabular-nums font-medium', className)} {...props}>
        {sign}{prefix}{formattedNumber}
      </span>
    );
  }
);

MoneyText.displayName = 'MoneyText';

export function formatRupiah(value: number, prefix = 'Rp '): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  return `${isNegative ? '-' : ''}${prefix}${absValue.toLocaleString('id-ID')}`;
}
