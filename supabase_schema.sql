-- Schema do Banco de Dados Lartop para Supabase
-- Execute este SQL no SQL Editor do Supabase

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cliente', 'prestador')),
  cidade VARCHAR(100),
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Perfis Profissionais
CREATE TABLE IF NOT EXISTS professional_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nicho VARCHAR(50) DEFAULT 'domestica',
  valor_base DECIMAL(10, 2) DEFAULT 0,
  service_city VARCHAR(100),
  service_radius INTEGER DEFAULT 20,
  rating DECIMAL(3, 2) DEFAULT 5.0,
  status VARCHAR(20) DEFAULT 'pendente',
  descricao TEXT,
  working_days JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de Pedidos/Ordens
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled', 'postponed_pending', 'cancelled_rain')),
  price DECIMAL(10, 2) NOT NULL,
  address TEXT NOT NULL,
  cliente_nome VARCHAR(255),
  cliente_telefone VARCHAR(20),
  cliente_foto TEXT,
  provider_nome VARCHAR(255),
  provider_foto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Portfólio
CREATE TABLE IF NOT EXISTS portfolio (
  id BIGSERIAL PRIMARY KEY,
  provider_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  service VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Avaliações (se necessário)
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  provider_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_professional_profiles_user_id ON professional_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_provider_id ON portfolio(provider_id);

-- RLS (Row Level Security) - Habilitar política básica para permitir todas as operações
-- NOTA: Em produção, você deve criar políticas mais restritivas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir todas as operações - AJUSTE EM PRODUÇÃO!)
CREATE POLICY "Permitir todas as operações em usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todas as operações em professional_profiles" ON professional_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todas as operações em orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todas as operações em portfolio" ON portfolio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todas as operações em reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);


