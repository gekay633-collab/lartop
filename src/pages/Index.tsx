import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceCard } from '@/components/ServiceCard';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { ServiceType } from '@/types';
import { Sparkles, Shield, Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const { setSelectedService, currentUser, setCurrentUser } = useApp();

  // Se um Prestador tentar acessar a Home de seleção, redirecionamos para o Dashboard dele
  useEffect(() => {
    // Usamos currentUser.tipo para manter a consistência com seu banco
    if (currentUser?.tipo === 'prestador' || currentUser?.tipo === 'provider') {
      navigate('/provider-dashboard');
    }
  }, [currentUser, navigate]);

  const handleServiceClick = (type: ServiceType) => {
    setSelectedService(type);
    
    // Se logado como cliente, vai para a lista. Se não, vai para o login.
    if (currentUser) {
      navigate(`/providers?nicho=${type}`);
    } else {
      // Passamos o nicho na URL para o Auth saber para onde voltar depois
      navigate(`/auth?role=client&redirect=${type}`);
    }
  };

  const handleLogout = () => {
    // 1. Limpa o usuário comum
    localStorage.removeItem('lartop_user');
    
    // 2. LIMPEZA DE SEGURANÇA: Remove dados de administrador para evitar vazamento
    localStorage.removeItem('@LartopAdmin:user');
    localStorage.removeItem('@LartopAdmin:token');
    
    // 3. Reseta o estado global
    setCurrentUser(null);
    
    toast.success("Sessão encerrada com segurança!");
    navigate('/auth');
  };

 return (
  <div className="min-h-screen gradient-hero overflow-x-hidden">
    {/* Adicionamos flex, flex-col (coluna), items-center (alinhamento horizontal) e text-center */}
    <div className="max-w-lg mx-auto px-4 py-6 md:py-12 flex flex-col items-center text-center">
        {/* Header de Boas-vindas ou Logout */}
        {currentUser && (
          <div className="flex justify-end mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive flex gap-2 font-bold uppercase text-[10px]"
            >
              <LogOut size={16} />
              Sair da Conta
            </Button>
          </div>
        )}

        {/* Logo Section */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-primary shadow-glow mb-4">
            <span className="text-3xl font-extrabold text-primary-foreground italic">L</span>
          </div>
          <h1 className="text-4xl font-black italic text-foreground tracking-tighter uppercase">
            LAR<span className="text-primary">TOP</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium italic">
            {currentUser ? `Olá, ${String(currentUser.nome).split(' ')[0]}!` : 'Serviços domésticos de confiança'}
          </p>
        </div>

        {/* Benefits Icons */}
        <div className="flex justify-center gap-3 md:gap-8 mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Confiança</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-secondary" />
            </div>
            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Rapidez</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">Qualidade</span>
          </div>
        </div>

        {/* Service Selection Card List */}
        <div className="space-y-4 mb-10">
          <h2 className="text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-6 italic">
            O que você precisa hoje?
          </h2>
          
          <div className="grid gap-4">
            <ServiceCard 
              type="domestica" 
              onClick={() => handleServiceClick('domestica' as ServiceType)} 
            />
            <ServiceCard 
              type="quintal" 
              onClick={() => handleServiceClick('quintal' as ServiceType)} 
            />
            <ServiceCard 
              type="manutencao" 
              onClick={() => handleServiceClick('manutencao' as ServiceType)} 
            />
          </div>
        </div>

        {/* Footer CTA - Apenas aparece se não estiver logado */}
        {!currentUser && (
          <div className="text-center animate-fade-in border-t border-dashed pt-8" style={{ animationDelay: '0.3s' }}>
            <p className="text-muted-foreground mb-4 font-black uppercase text-[10px] italic">Quer trabalhar conosco?</p>
            <Button
              variant="outline"
              onClick={() => navigate('/auth?role=provider')}
              className="w-full py-6 rounded-2xl border-2 font-black uppercase italic text-xs hover:bg-primary/5 transition-all shadow-sm"
            >
              Seja um Prestador LARTOP
            </Button>
          </div>
        )}

        {/* Informação da Cidade */}
        {(currentUser as any)?.cidade && (
          <p className="text-center text-[9px] font-black uppercase text-muted-foreground mt-8 italic opacity-50">
            Atendendo em: {(currentUser as any).cidade}
          </p>
        )}
      </div>
    </div>
  );
};

export default Index;