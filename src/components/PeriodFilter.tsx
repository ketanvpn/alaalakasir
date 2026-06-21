import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  REPORT_PRESETS,
  type ReportPreset,
  type ReportPeriodState,
} from '@/lib/hooks/useReportPeriod';

interface PeriodFilterProps {
  period: ReportPeriodState;
}

/**
 * Shared period selector: row of preset pills + a custom date range popover
 * when "Kustom" is active. Used by Reports and StockReport.
 */
export function PeriodFilter({ period }: PeriodFilterProps) {
  const { preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo } = period;
  const isCustom = preset === 'custom';

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {REPORT_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value as ReportPreset)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
              preset === p.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('h-9 text-xs gap-1.5 flex-1', customFrom && 'border-primary text-primary')}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: localeId }) : 'Dari tanggal'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">—</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('h-9 text-xs gap-1.5 flex-1', customTo && 'border-primary text-primary')}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {customTo ? format(customTo, 'dd MMM yyyy', { locale: localeId }) : 'Sampai tanggal'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
