export type UserRole = 'client' | 'provider';

// Status atualizados para o fluxo iFood (MySQL ENUM)
export type OrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'arrived' 
  | 'in_progress' 
  | 'waiting_confirmation' 
  | 'completed' 
  | 'cancelled';

export type ServiceType = 'domestica' | 'quintal'| 'manutencao';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  cidade?: string;       // Bate com a coluna 'cidade' do MySQL
  serviceType?: ServiceType;
  basePrice?: number;
  serviceArea?: string;
  avatar?: string;       // Mapeia para foto_url do banco
  address?: string;
  homeImages?: string[];
}

export interface ServiceOrder {
  id: string;
  clientId: string;
  clientName: string;
  providerId: string;
  providerName: string;
  providerFoto?: string; // Para mostrar a foto do prestador no card do cliente
  serviceType: string;   // Mudado para string para aceitar subtipos como "Limpeza Pesada"
  address: string;
  date: string;
  time: string;
  description?: string;
  status: OrderStatus;
  price?: number;        // Adicionado para bater com service_orders.price
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  phone: string;
  serviceType: ServiceType; // nicho no banco
  basePrice: number;        // valor_base no banco
  location: string;         // cidade no banco
  rating: number;           // rating decimal no banco
  completedJobs: number;    // total_servicos no banco
  avatar?: string;          // foto_url no banco
  description?: string;     // descricao no banco
}

// Interface para as avaliações (Reviews)
export interface Review {
  id: number;
  provider_id: number;
  user_id: number;
  cliente_nome?: string;    // Nome do cliente que avaliou
  rating: number;
  comment: string;
  created_at: string;
}