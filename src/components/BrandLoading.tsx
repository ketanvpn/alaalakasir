type BrandLoadingProps = {
  message?: string;
  compact?: boolean;
};

export default function BrandLoading({ message = "Menyiapkan AlaalaKasir...", compact = false }: BrandLoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 ${compact ? "min-h-[50vh]" : "min-h-screen"}`}>
      <div className="relative">
        <div className="absolute -inset-2 rounded-[28px] bg-primary/15 blur-lg" />
        <img
          src="/alaalakasir-logo.svg"
          alt="Logo AlaalaKasir"
          className="relative w-20 h-20 sm:w-24 sm:h-24 drop-shadow-sm animate-pulse"
        />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">AlaalaKasir</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <div className="mt-4 h-1.5 w-36 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
      </div>
    </div>
  );
}
