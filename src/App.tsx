import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/contexts/AppContext"; // Importe useApp
import { useEffect } from "react";

// Importação das Páginas
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Providers from "./pages/Providers";
import CreateOrder from "./pages/CreateOrder";
import MyOrders from "./pages/MyOrders";
import ProviderDashboard from "./pages/ProviderDashboard";
import Profile from "./pages/Profile";
import Booking from "./pages/Booking";
import ProviderDetails from "./pages/ProviderDetails";
import Portfolio from "./pages/Portfolio";
import Review from "./pages/Review";
import ClientReview from "./pages/ClientReview";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// COMPONENTE DE SEGURANÇA: Limpa lixo de ADM do LocalStorage
const SecurityWrapper = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useApp();

  useEffect(() => {
    const checkSecurity = () => {
      // Se não há ninguém logado OU o logado não é admin
      // Mas ainda existem chaves de admin no storage, apague-as!
      const isAdminDataPresent = localStorage.getItem('@LartopAdmin:user');
      
      if (isAdminDataPresent && (!currentUser || (currentUser as any).tipo !== 'admin')) {
        console.warn("Segurança Lartop: Removendo dados de administrador residuais.");
        localStorage.removeItem('@LartopAdmin:user');
        localStorage.removeItem('@LartopAdmin:token');
      }
    };

    checkSecurity();
  }, [currentUser]);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <SecurityWrapper> {/* Envolve as rotas com a proteção */}
          <Toaster />
          <Sonner position="top-center" expand={false} richColors />
          
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/provider/:id" element={<ProviderDetails />} />
              <Route path="/portfolio/:id" element={<Portfolio />} />
              <Route path="/booking/:providerId" element={<Booking />} />
              <Route path="/create-order/:providerId" element={<CreateOrder />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/client-dashboard" element={<MyOrders />} />
              <Route path="/provider-dashboard" element={<ProviderDashboard />} />
              <Route path="/profile" element={<Profile />} />

              {/* ROTA PRIVADA - Lembre-se: http://localhost:8080/admin-lartop-privado */}
              <Route path="/admin-lartop-privado" element={<Admin />} />
              
              <Route path="/provider-review/:orderId" element={<Review />} />
              <Route path="/review/:providerId" element={<Review />} />
              <Route path="/client-review/:orderId" element={<ClientReview />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SecurityWrapper>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;