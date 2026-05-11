import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <SearchX className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
          <p className="text-sm text-muted-foreground">
            Link yang kamu buka tidak tersedia atau sudah dipindahkan.
          </p>
        </div>
        <Button asChild className="h-11 px-5">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
