import { ArrowLeft, LogOut, User, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showProfile?: boolean;
}

export function Header({ title, showBack, showProfile = true }: HeaderProps) {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lartop_user'); 
    toast.success("Sessão encerrada");
    navigate('/');
  };

  // Função para tratar o nome com segurança
  const getFirstName = (fullName: string | undefined | null) => {
    if (!fullName) return 'Usuário';
    return fullName.trim().split(' ')[0];
  };

  // Lógica de destino ao clicar no Logo ou no botão Início
  const handleLogoClick = () => {
    if (currentUser?.role === 'provider') {
      navigate('/provider-dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          
          {title ? (
            <h1 className="text-xl font-bold text-foreground truncate max-w-[180px]">{title}</h1>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={handleLogoClick}
            >
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:shadow-glow transition-all">
                <span className="text-primary-foreground font-bold text-sm">L</span>
              </div>
              <span className="text-xl font-black text-foreground tracking-tighter">
                LAR<span className="text-primary">TOP</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Início rápido (Apenas para Clientes logados quando estiverem em outras telas) */}
          {currentUser?.role === 'client' && (title || showBack) && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="rounded-full text-muted-foreground"
              title="Voltar para o início"
            >
              <Home className="w-5 h-5" />
            </Button>
          )}

          {/* Exibe o perfil se a prop showProfile for true e existir um usuário logado */}
          {showProfile && currentUser ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-full hover:bg-muted/80 transition-colors border border-transparent hover:border-border"
              >
                {currentUser.avatar ? (
                  <img 
                    src={currentUser.avatar} 
                    alt="Avatar" 
                    className="w-6 h-6 rounded-full object-cover border border-background" 
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="text-xs font-bold text-foreground truncate max-w-[60px]">
                  {getFirstName(currentUser.name)}
                </span>
              </button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout} 
                title="Sair"
                className="rounded-full hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            /* Botão de Entrar caso não haja usuário */
            !currentUser && showProfile && (
              <Button 
                variant="default" 
                size="sm" 
                className="rounded-full px-4 font-bold shadow-md"
                onClick={() => navigate('/auth')}
              >
                Entrar
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
}