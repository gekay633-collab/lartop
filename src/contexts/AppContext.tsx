import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { User, ServiceType } from '@/types';
import api from '@/api';
import { toast } from 'sonner';

export interface ServiceOrder {
  id: number;
  user_id: number;
  provider_id: number;
  service_type: string;
  date: string;
  time: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'arrived' | 'in_progress' | 'waiting_confirmation' | 'postponed_pending' | 'cancelled_rain' | 'in_progress_authorized';
  price: number;
  address: string;
  description_request?: string; 
  photos_request?: any; 
  photo_before?: string;
  photo_after?: string;
  provider?: {
    nome: string;
    foto_url: string;
  };
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_foto?: string;
}

interface AppContextType {
  currentUser: any | null;
  setCurrentUser: (user: User | null) => void;
  orders: ServiceOrder[];
  fetchOrders: () => Promise<void>; 
  addOrder: (orderData: any) => Promise<void>;
  updateOrderStatus: (orderId: number, status: string, additionalData?: any) => Promise<void>;
  selectedService: ServiceType | null;
  setSelectedService: (service: ServiceType | null) => void;
  selectedProvider: any | null;
  setSelectedProvider: (provider: any | null) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('lartop_user');
    try {
      if (!savedUser || savedUser === 'undefined') return null;
      return JSON.parse(savedUser);
    } catch (e) {
      return null;
    }
  });

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  const isFetchingRef = useRef(false);

  // --- BUSCA DE PEDIDOS OTIMIZADA ---
  const fetchOrders = useCallback(async () => {
    // Se não houver ID ou já estiver buscando, cancela para não gastar dados
    if (!currentUser?.id || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      
      const user = currentUser as any;
      const isProvider = user.tipo === 'prestador' || user.tipo === 'provider' || user.role === 'provider';
      
      const endpoint = isProvider 
        ? `/orders/provider/${user.id}` 
        : `/orders/user/${user.id}`;
      
      const response = await api.get(endpoint);
      
      if (Array.isArray(response.data)) {
        setOrders(response.data);
      }
    } catch (error: any) {
      // Log silencioso apenas para erro real
      console.error("❌ Lartop Sync Error");
    } finally {
      isFetchingRef.current = false;
      setLoading(false); 
    }
  }, [currentUser?.id]); // Apenas o ID do usuário dispara a recriação da função

  // --- EFEITO DE SINCRONIZAÇÃO CONTROLADA ---
  useEffect(() => {
    if (currentUser?.id) {
      // Primeira busca ao logar
      fetchOrders(); 

      // Sincronização em segundo plano a cada 20 segundos (mais econômico que 10s)
      const interval = setInterval(() => {
        fetchOrders();
      }, 20000); 

      return () => clearInterval(interval);
    }
  }, [currentUser?.id, fetchOrders]); // Agora fetchOrders é estável devido ao useCallback

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('lartop_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('lartop_user');
      setOrders([]);
    }
  }, [currentUser]);

  const addOrder = async (orderData: any) => {
    try {
      await api.post('/orders', orderData);
      await fetchOrders(); 
      toast.success("Solicitação enviada com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar solicitação.");
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: number, status: string, additionalData?: any) => {
    try {
      await api.patch(`/orders/${orderId}`, { 
        status,
        ...additionalData 
      });

      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: status as any, ...additionalData } : o
      ));
      
      toast.success("Pedido atualizado!");
    } catch (error) {
      toast.error("Erro técnico ao atualizar pedido.");
      throw error;
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        orders,
        fetchOrders,
        addOrder,
        updateOrderStatus,
        selectedService,
        setSelectedService,
        selectedProvider,
        setSelectedProvider,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};