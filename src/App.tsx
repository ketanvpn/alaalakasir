import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import AppLayout from "./components/layout/AppLayout";
import BrandLoading from "./components/BrandLoading";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cashier = lazy(() => import("./pages/Cashier"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const SupplierPage = lazy(() => import("./pages/Supplier"));
const StockInPage = lazy(() => import("./pages/StockIn"));
const StockOutPage = lazy(() => import("./pages/StockOut"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const StockReport = lazy(() => import("./pages/StockReport"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return <BrandLoading compact message="Membuka halaman..." />;
}

const App = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    let removeListener: (() => void) | undefined;

    const setupBackButtonHandler = async () => {
      const listener = await CapacitorApp.addListener("backButton", ({ canGoBack }) => {
        const backEvent = new CustomEvent("app:backbutton", { cancelable: true });
        const shouldContinue = window.dispatchEvent(backEvent);
        if (!shouldContinue) {
          return;
        }

        if (canGoBack) {
          window.history.back();
          return;
        }

        const shouldExit = window.confirm("Keluar dari aplikasi AlaalaKasir?");
        if (shouldExit) {
          CapacitorApp.exitApp();
        }
      });
      removeListener = () => {
        listener.remove();
      };
    };

    setupBackButtonHandler();

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cashier" element={<Cashier />} />
                <Route path="/products" element={<Products />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/supplier" element={<SupplierPage />} />
                <Route path="/stock-in" element={<StockInPage />} />
                <Route path="/stock-out" element={<StockOutPage />} />
                <Route path="/history" element={<TransactionHistory />} />
                <Route path="/stock-report" element={<StockReport />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
