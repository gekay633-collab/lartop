import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { UserRole, ServiceType } from '@/types';
import { toast } from 'sonner';
import { 
  Home, Leaf, Wrench, Eye, EyeOff, Loader2, MapPin, 
  KeyRound, ArrowLeft, Mail, Phone, CheckCircle2, DollarSign 
} from 'lucide-react';
import api from '@/api'; 

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCurrentUser, selectedService } = useApp();

  const initialRole = (searchParams.get('role') as UserRole) || 'client';
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false); 
  const [role, setRole] = useState<UserRole>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Campos do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('domestica');
  const [basePrice, setBasePrice] = useState('');
  const [serviceArea, setServiceArea] = useState('');

  // 1. SOLICITAR CÓDIGO (Esqueceu Senha)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Informe seu e-mail cadastrado.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/forgot-password', { 
        identifier: email.trim().toLowerCase() 
      });
      
      toast.success(response.data?.message || 'Código enviado com sucesso!');
      setForgotStep('verify');
    } catch (error: any) {
      console.error("Erro Forgot Password:", error);
      const errorMsg = error.response?.data?.error || 'Erro ao enviar recuperação.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 2. REDEFINIR SENHA
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode || !newPassword) return toast.error('Preencha o código e a nova senha.');
    if (newPassword !== newPasswordConfirm) return toast.error('As senhas não coincidem.');
    
    setLoading(true);
    try {
      await api.post('/reset-password', { 
        email: email.trim().toLowerCase(), 
        code: resetCode, 
        newPassword 
      });
      
      toast.success('Senha alterada com sucesso! Faça login.');
      setIsForgotPassword(false);
      setForgotStep('request');
      setResetCode('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: any) {
      console.error("Erro Reset Password:", err);
      toast.error(err.response?.data?.error || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  // 3. LOGIN OU CADASTRO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha e-mail e senha');
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.post('/login', { 
          email: email.trim().toLowerCase(), 
          senha: password 
        });

        const user = response.data.user;
        if (!user) throw new Error('Dados inválidos recebidos.');

        const userTypeDB = user.tipo; 
        const selectedRole = role === 'client' ? 'cliente' : 'prestador';

        if (user.tipo !== 'admin' && userTypeDB !== selectedRole) {
          const msg = role === 'client' 
            ? "Esta conta é de um Prestador. Use a aba 'Sou Prestador'." 
            : "Esta conta é de um Cliente. Use a aba 'Sou Cliente'.";
          setLoading(false);
          return toast.error(msg);
        }

        const { senha, ...userDataSafe } = user;

        const userData = {
          ...userDataSafe,
          id: user.id,
          name: user.nome,
          role: user.tipo === 'cliente' ? 'client' : (user.tipo === 'admin' ? 'admin' : 'provider'),
          foto_url: user.foto_url || user.prof_foto,
        };

        setCurrentUser(userData);
        localStorage.setItem('lartop_user', JSON.stringify(userData));
        
        if (user.tipo !== 'admin') {
          localStorage.removeItem('@LartopAdmin:user');
        }

        toast.success(`Bem-vindo(a), ${user.nome}!`);

        if (user.tipo === 'prestador') {
          navigate('/provider-dashboard');
        } else if (user.tipo === 'admin') {
          navigate('/admin-lartop-privado');
        } else {
          navigate(selectedService ? `/providers?nicho=${selectedService}` : '/');
        }

      } else {
        if (role === 'provider' && (!basePrice || Number(basePrice) <= 0)) {
          setLoading(false);
          return toast.error("Informe seu valor base por turno.");
        }

        const payload = {
          nome: name,
          telefone: phone,
          email: email.trim().toLowerCase(),
          senha: password,
          tipo: role === 'client' ? 'cliente' : 'prestador',
          cidade: serviceArea,
          nicho: role === 'provider' ? serviceType : 'domestica', 
          valor_base: role === 'provider' ? Number(basePrice) : 0
        };

        await api.post('/register', payload);
        toast.success('Cadastro realizado! Agora faça o login.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (error: any) {
      console.error("Erro Auth:", error);
      const errorMessage = error?.response?.data?.error || "E-mail ou senha incorretos.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-background">
        <Header showBack={false} title="Recuperar Senha" />
        <main className="max-w-lg mx-auto px-6 py-12">
          <button 
            onClick={() => { setIsForgotPassword(false); setForgotStep('request'); }} 
            className="flex items-center gap-2 text-muted-foreground font-black uppercase text-[10px] mb-8 hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} /> Voltar ao login
          </button>
          
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-4 rotate-3">
              <KeyRound className="text-primary" size={38} />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Esqueceu a senha?</h2>
          </div>

          {forgotStep === 'request' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">E-mail Cadastrado</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold"
                    placeholder="seu@email.com"
                    required
                  />
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={18} />
                </div>
              </div>
              <Button type="submit" className="w-full py-8 rounded-[28px] font-black uppercase italic tracking-widest text-base shadow-lg shadow-primary/20" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'ENVIAR CÓDIGO'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">Código de 6 dígitos</label>
                <input 
                  type="text" 
                  value={resetCode} 
                  onChange={(e) => setResetCode(e.target.value)} 
                  className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold text-center tracking-[10px]" 
                  placeholder="000000" 
                  maxLength={6}
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">Nova senha</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold" placeholder="Nova senha" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">Confirme a senha</label>
                <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold" placeholder="Confirme a nova senha" required />
              </div>
              <Button type="submit" className="w-full py-8 rounded-[28px] font-black uppercase italic tracking-widest text-base shadow-lg shadow-primary/20" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'REDEFINIR SENHA'}
              </Button>
            </form>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <Header showBack title={isLogin ? 'Login' : 'Cadastro'} />

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="flex gap-2 p-1.5 bg-muted rounded-2xl mb-8 border border-border">
          <button
            type="button"
            className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center justify-center gap-2 ${
              role === 'client' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
            }`}
            onClick={() => setRole('client')}
          >
            {role === 'client' && <CheckCircle2 size={12} />} Sou Cliente
          </button>
          <button
            type="button"
            className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center justify-center gap-2 ${
              role === 'provider' ? 'bg-white shadow-sm text-secondary' : 'text-muted-foreground'
            }`}
            onClick={() => setRole('provider')}
          >
            {role === 'provider' && <CheckCircle2 size={12} />} Sou Prestador
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold italic"
                placeholder="Ex: Maria Oliveira"
                required={!isLogin}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">E-mail</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold italic"
                placeholder="seu@email.com"
                required
              />
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/20" size={18} />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">WhatsApp</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold"
                  placeholder="219XXXXXXXX"
                  required={!isLogin}
                />
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/20" size={18} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between items-center pr-1">
              <label className="text-[10px] font-black uppercase ml-1 text-muted-foreground">Senha</label>
              {isLogin && (
                <button 
                  type="button" 
                  onClick={() => setIsForgotPassword(true)}
                  className="text-[9px] font-black text-primary uppercase hover:underline"
                >
                  Esqueceu a senha?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-muted/50 border-2 border-transparent focus:border-primary rounded-2xl px-4 outline-none font-bold pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="pt-2 space-y-4 animate-in fade-in duration-500">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase ml-1 text-secondary flex items-center gap-1">
                  <MapPin size={12} /> {role === 'provider' ? 'Cidade onde atende' : 'Sua Cidade'}
                </label>
                <input
                  type="text"
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  className="w-full h-14 bg-secondary/5 border-2 border-secondary/20 focus:border-secondary rounded-2xl px-4 outline-none font-black italic"
                  placeholder="Ex: Maricá"
                  required={!isLogin}
                />
              </div>

              {role === 'provider' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase ml-1 text-primary flex items-center gap-1">
                      <DollarSign size={12} /> Valor por Turno (Base)
                    </label>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full h-14 bg-primary/5 border-2 border-primary/20 focus:border-primary rounded-2xl px-4 outline-none font-black"
                      placeholder="Ex: 150"
                      required={role === 'provider'}
                    />
                  </div>

                  {/* GRID ATUALIZADO PARA 3 COLUNAS */}
                  <div className="grid grid-cols-3 gap-2 animate-in zoom-in-95 duration-300">
                    <button
                      type="button"
                      onClick={() => setServiceType('domestica')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                        serviceType === 'domestica' ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground opacity-50'
                      }`}
                    >
                      <Home size={20} />
                      <span className="text-[8px] font-black uppercase">Interno</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceType('quintal')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                        serviceType === 'quintal' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-muted text-muted-foreground opacity-50'
                      }`}
                    >
                      <Leaf size={20} />
                      <span className="text-[8px] font-black uppercase">Externo</span>
                    </button>
                    {/* NOVO CARD: MANUTENÇÃO */}
                    <button
                      type="button"
                      onClick={() => setServiceType('manutencao' as any)}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                        serviceType === ('manutencao' as any) ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground opacity-50'
                      }`}
                    >
                      <Wrench size={20} />
                      <span className="text-[8px] font-black uppercase">Técnico</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <Button 
            type="submit" 
            className={`w-full py-8 rounded-[28px] shadow-xl font-black uppercase italic tracking-widest text-base mt-4 transition-all active:scale-95 ${role === 'provider' ? 'bg-secondary hover:bg-secondary/90 shadow-secondary/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`} 
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Acessar Conta' : 'Concluir Cadastro')}
          </Button>
        </form>

        <div className="mt-8 text-center flex flex-col gap-4">
          <button 
            type="button"
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground underline hover:text-primary transition-colors" 
            onClick={() => {
              setIsLogin(!isLogin);
              setPassword('');
            }}
          >
            {isLogin ? 'Não tem conta? Crie uma aqui' : 'Já tem uma conta? Entre aqui'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Auth;