import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  ShieldCheck, Loader2, Lock, User as UserIcon, Mail, 
  KeyRound, ArrowLeft, LogOut, Search, Clock, CheckCircle, Ban,
  MapPin, Phone, Users
} from 'lucide-react';
import { api } from '@/api'; 

const Admin = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState(''); // Novo campo para o código do e-mail
  const [newPassword, setNewPassword] = useState('');

  // --- 1. GESTÃO DE DADOS (API -> NEON) ---
  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      // Busca todos os prestadores para moderação
      const response = await api.get('/admin/providers');
      setProviders(response.data || []);
    } catch (error) {
      console.error("Erro Neon:", error);
      toast.error("Erro ao sincronizar base de dados Lartop.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 2. LOGIN ADMINISTRATIVO ---
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const response = await api.post('/login', { 
        email: email.trim().toLowerCase(), 
        senha: password 
      });

      const user = response.data.user;

      if (user.is_admin === true || user.tipo === 'admin') {
        setIsAuthorized(true);
        localStorage.setItem('@LartopAdmin:user', JSON.stringify(user));
        toast.success(`Acesso autorizado: Olá, ${user.nome.split(' ')[0]}!`);
      } else {
        toast.error("Acesso negado: Restrito a administradores.");
      }
    } catch (error: any) {
      toast.error("Credenciais inválidas ou erro no servidor Neon.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --- 3. RECUPERAÇÃO DE SENHA (FLUXO COMPLETO) ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      // Chama o endpoint que envia o código por e-mail via Nodemailer
      await api.post('/forgot-password', { identifier: email.trim().toLowerCase() });
      
      toast.success("Código de recuperação enviado ao seu e-mail!");
      setView('reset');
    } catch (error: any) {
      toast.error("Erro ao validar conta administrativa no Neon.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      // CORREÇÃO: Chama a rota específica de reset com o código recebido
      await api.post('/reset-password', { 
        email: email.trim().toLowerCase(),
        code: resetCode,
        newPassword: newPassword 
      });

      toast.success("Senha administrativa atualizada!");
      setView('login');
      setPassword('');
      setResetCode('');
      setNewPassword('');
    } catch (error: any) {
      const msg = error.response?.data?.error || "Erro ao salvar nova senha.";
      toast.error(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --- 4. AÇÕES DE MODERAÇÃO ---
  const updateStatus = async (userId: any, newStatus: string) => {
    const loadingToast = toast.loading("Salvando no Neon...");
    try {
      await api.patch(`/admin/providers/${userId}/status`, { status: newStatus });

      toast.dismiss(loadingToast);
      const messages: any = {
        'ativo': 'Prestador APROVADO e ONLINE.',
        'pendente': 'Prestador em LISTA DE ESPERA.',
        'bloqueado': 'Acesso do prestador SUSPENSO.'
      };
      
      toast.success(messages[newStatus]);
      
      setProviders(current => 
        current.map(p => p.id === userId ? { ...p, status: newStatus } : p)
      );
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Falha na operação de moderação.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('@LartopAdmin:user');
    setIsAuthorized(false);
    setProviders([]);
    setView('login');
    setEmail('');
    setPassword('');
  };

  useEffect(() => { 
    const savedUser = localStorage.getItem('@LartopAdmin:user');
    if (savedUser) setIsAuthorized(true);
  }, []);

  useEffect(() => {
    if (isAuthorized) loadProviders();
  }, [isAuthorized, loadProviders]);

  const filteredProviders = providers.filter((p: any) => 
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nicho?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl border-t-[12px] border-primary transition-all">
          <div className="text-center mb-10">
             <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-inner">
                {view === 'login' ? <ShieldCheck className="text-primary" size={40} /> : <KeyRound className="text-primary" size={40} />}
             </div>
             <h1 className="text-3xl font-black italic uppercase text-slate-900 tracking-tighter">
                {view === 'login' ? 'Lartop Admin' : view === 'forgot' ? 'Recuperar' : 'Confirmar'}
             </h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acesso Restrito Neon</p>
          </div>

          {view === 'login' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-primary/30 transition-all" placeholder="E-MAIL" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-primary/30 transition-all" placeholder="SENHA" required />
              </div>
              <button type="button" onClick={() => setView('forgot')} className="text-[10px] font-black uppercase text-primary hover:underline ml-1">Esqueci minha senha administrativa</button>
              <Button type="submit" className="w-full h-16 rounded-2xl font-black italic text-lg shadow-xl uppercase" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="animate-spin" /> : 'ENTRAR NO PAINEL'}
              </Button>
            </form>
          )}

          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none" placeholder="E-MAIL CADASTRADO" required />
              </div>
              <Button type="submit" className="w-full h-16 rounded-2xl font-black italic uppercase" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="animate-spin" /> : 'ENVIAR CÓDIGO'}
              </Button>
              <button type="button" onClick={() => setView('login')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 mt-2 hover:text-slate-600 transition-colors"><ArrowLeft size={14}/> Voltar ao login</button>
            </form>
          )}

          {view === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-primary/30" placeholder="CÓDIGO DO E-MAIL" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-primary/30" placeholder="NOVA SENHA" required />
              </div>
              <Button type="submit" className="w-full h-16 rounded-2xl font-black italic uppercase" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="animate-spin" /> : 'REDEFINIR SENHA'}
              </Button>
              <button type="button" onClick={() => setView('forgot')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 mt-2 hover:text-slate-600 transition-colors"><ArrowLeft size={14}/> Reenviar e-mail</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-slate-900">
          <ShieldCheck className="text-primary" /> Lartop <span className="text-primary">Admin</span>
        </h2>
        <div className="flex items-center gap-4">
           <div className="hidden sm:block text-right">
             <p className="text-[9px] font-black uppercase text-slate-400 leading-none">Database Neon</p>
             <p className="text-xs font-bold text-green-500 flex items-center gap-1 justify-end">
               <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> CONECTADO
             </p>
           </div>
           <Button onClick={handleLogout} variant="ghost" size="sm" className="font-black text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all">
             <LogOut size={18} className="mr-2" /> SAIR
           </Button>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
           <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
             <input 
               type="text"
               placeholder="Buscar no Neon por nome, nicho ou e-mail..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-12 h-16 bg-white border-2 border-transparent rounded-[1.5rem] font-bold outline-none focus:border-primary shadow-sm transition-all text-slate-700"
             />
           </div>
           
           <div className="flex gap-3 overflow-x-auto no-scrollbar">
             <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                   <CheckCircle size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Ativos</p>
                   <p className="text-lg font-black text-slate-900 leading-tight">{providers.filter((p:any) => p.status === 'ativo').length}</p>
                </div>
             </div>
             <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                   <Clock size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Pendentes</p>
                   <p className="text-lg font-black text-slate-900 leading-tight">{providers.filter((p:any) => p.status === 'pendente').length}</p>
                </div>
             </div>
           </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="font-black uppercase text-[10px] text-slate-400 tracking-[0.2em]">Consultando NeonDB...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProviders.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200">
                 <Users className="mx-auto text-slate-200 mb-4" size={64} />
                 <p className="font-black uppercase text-slate-400 italic">Nenhum talento encontrado no banco</p>
              </div>
            ) : (
              filteredProviders.map((p: any) => (
                <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-white shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-md transition-all group">
                  <div className="flex-1 w-full">
                     <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5 ${
                          p.status === 'ativo' ? 'bg-green-100 text-green-600' : 
                          p.status === 'pendente' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                             p.status === 'ativo' ? 'bg-green-500' : p.status === 'pendente' ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                          {p.status === 'ativo' ? 'Aprovado' : p.status === 'pendente' ? 'Aguardando' : 'Bloqueado'}
                        </span>
                        <h3 className="font-black italic uppercase text-2xl text-slate-900 tracking-tight leading-none">{p.nome}</h3>
                     </div>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px] font-bold text-slate-500">
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl group-hover:bg-white transition-colors"><Mail size={14} className="text-primary"/> {p.email}</div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl group-hover:bg-white transition-colors"><Phone size={14} className="text-primary"/> {p.telefone}</div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl group-hover:bg-white transition-colors"><MapPin size={14} className="text-primary"/> {p.cidade}</div>
                        <div className="flex items-center gap-2 bg-primary/5 text-primary uppercase italic p-2 rounded-xl border border-primary/10"><ShieldCheck size={14}/> {p.nicho}</div>
                     </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto border-t md:border-t-0 pt-6 md:pt-0">
                      {p.status !== 'ativo' && (
                        <button onClick={() => updateStatus(p.id, 'ativo')} className="flex-1 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"><CheckCircle size={16}/> Aprovar</button>
                      )}
                      {p.status !== 'pendente' && (
                        <button onClick={() => updateStatus(p.id, 'pendente')} className="flex-1 px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"><Clock size={16}/> Espera</button>
                      )}
                      {p.status !== 'bloqueado' && (
                        <button onClick={() => updateStatus(p.id, 'bloqueado')} className="flex-1 px-6 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95"><Ban size={16}/> Bloquear</button>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;