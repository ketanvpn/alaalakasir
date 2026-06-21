import { useMemo, useState } from 'react';
import { endOfDay, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

/**
 * Shared period selector for report pages (Reports, StockReport).
 * Offers F&B-friendly presets plus a custom date range via Calendar picker.
 *
 * Why a hook (not a component): the pages already render different Tabs/UI
 * markup — they only need the derived `range` and the setter. Keeping it as a
 * hook lets each page compose the trigger however it wants.
 */

export type ReportPreset = 'today' | 'week' | 'month' | '30' | 'custom';

export interface ReportPresetMeta {
  value: ReportPreset;
  label: string;
  short: string;
}

export const REPORT_PRESETS: ReportPresetMeta[] = [
  { value: 'today', label: 'Hari Ini', short: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini', short: 'Minggu' },
  { value: 'month', label: 'Bulan Ini', short: 'Bulan' },
  { value: '30', label: '30 Hari', short: '30 Hari' },
  { value: 'custom', label: 'Kustom', short: 'Kustom' },
];

export interface DateRange {
  /** Inclusive start (start of day). */
  from: Date;
  /** Inclusive end (end of day). */
  to: Date;
}

export interface ReportPeriodState {
  preset: ReportPreset;
  setPreset: (p: ReportPreset) => void;
  customFrom: Date | undefined;
  customTo: Date | undefined;
  setCustomFrom: (d: Date | undefined) => void;
  setCustomTo: (d: Date | undefined) => void;
  range: DateRange;
  /** Number of days in the selected range (>=1), used for chart buckets. */
  spanDays: number;
  /** Human-readable label for export filenames / titles. */
  rangeLabel: string;
}

function presetToRange(preset: ReportPreset, customFrom?: Date, customTo?: Date): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'week':
      return { from: startOfDay(startOfWeek(now, { weekStartsOn: 1 })), to: endOfDay(now) };
    case 'month':
      return { from: startOfDay(startOfMonth(now)), to: endOfDay(now) };
    case '30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'custom': {
      const from = customFrom ? startOfDay(customFrom) : startOfDay(subDays(now, 6));
      const to = customTo ? endOfDay(customTo) : endOfDay(now);
      if (from > to) return { from: to, to: from };
      return { from, to };
    }
  }
}

export function useReportPeriod(defaultPreset: ReportPreset = '30'): ReportPeriodState {
  const [preset, setPreset] = useState<ReportPreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const range = useMemo(
    () => presetToRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const spanDays = useMemo(() => {
    const ms = range.to.getTime() - range.from.getTime();
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
  }, [range]);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    if (range.from.toDateString() === range.to.toDateString()) {
      return fmt(range.from);
    }
    return `${fmt(range.from)} – ${fmt(range.to)}`;
  }, [range]);

  return {
    preset,
    setPreset,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    range,
    spanDays,
    rangeLabel,
  };
}

// Re-export locale so pages can import everything from one place.
export { localeId };
