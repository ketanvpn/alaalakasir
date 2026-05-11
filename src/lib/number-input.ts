export function sanitizeNumericInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return "";
  return digitsOnly.replace(/^0+(?=\d)/, "");
}

export function formatThousandsInput(value: string): string {
  if (!value) return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("id-ID");
}
