import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { api } from '@/api'; 
import { 
  Camera, User, LogOut, 
  Home, FolderSync, Plus, Loader2, Image as ImageIcon,
  ChevronRight, Save, ShoppingBag
} from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos campos básicos
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [foto_url, setFotoUrl] = useState('');
  
  // Campos do Perfil Profissional
  const [valor_base, setValorBase] = useState('');
  const [nicho, setNicho] = useState('');
  const [descricao, setDescricao] = useState('');
  
  // PROTEÇÃO DA AGENDA: Armazena os dias atuais para não apagá-los ao salvar o perfil
  const [currentWorkingDays, setCurrentWorkingDays] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [portfolioPhotos, setPortfolioPhotos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'perfil' | 'portfolio'>('perfil');

  const user = currentUser as any;
  const isProvider = user?.tipo === 'prestador' || user?.tipo === 'admin';

  const cleanImageUrl = (url: string) => {
    if (!url) return '';
    return String(url).replace(/[\[\]"]/g, "");
  };

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      if (isProvider) {
        // Busca portfólio baseado em ordens
        const portfolioRes = await api.get(`/orders/provider/${user.id}`);
        const completedOrders = Array.isArray(portfolioRes.data) 
          ? portfolioRes.data.filter((o: any) => o.status === 'completed')
          : [];

        const photos: any[] = [];
        completedOrders.forEach((order: any) => {
          if (order.photo_before) photos.push({ url: cleanImageUrl(order.photo_before), service: order.service_type || 'Serviço', label: 'Antes' });
          if (order.photo_after) photos.push({ url: cleanImageUrl(order.photo_after), service: order.service_type || 'Serviço', label: 'Depois' });
        });
        setPortfolioPhotos(photos);
      }
    } catch (error) {
      console.error("Erro ao sincronizar dados Lartop:", error);
    }
  };

  useEffect(() => {
    if (!currentUser) { 
        navigate('/auth'); 
        return; 
    }
    
    setNome(user.nome || '');
    setTelefone(user.telefone || '');
    setCidade(user.cidade || '');
    setFotoUrl(user.foto_url || '');

    const loadProfessionalInfo = async () => {
        try {
          const response = await api.get(`/professional_profiles/${user.id}`);
          const data = Array.isArray(response.data) ? response.data[0] : response.data;
          
          if (data) {
              setValorBase(data.valor_base?.toString() || '');
              setNicho(data.nicho || '');
              setDescricao(data.descricao || '');
              // CRÍTICO: Guarda a agenda atual na memória
              setCurrentWorkingDays(data.working_days || '');
          }
        } catch (e) {
          console.log("Perfil profissional ainda não criado.");
        }
    };

    if (isProvider) loadProfessionalInfo();
    fetchData();
  }, [currentUser]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Máximo 2MB");

    try {
      const loadingToast = toast.loading("Subindo imagem para o Lartop...");
      const uploadedUrl = await api.uploadPhoto(file);
      if (uploadedUrl) {
        setFotoUrl(uploadedUrl);
        toast.success("Foto carregada!", { id: loadingToast });
      }
    } catch (error) {
      toast.error("Erro no upload.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading("Salvando dados no Lartop...");

    try {
      // 1. Atualiza dados básicos do usuário
      await api.put(`/users/${user.id}`, { 
        nome, 
        telefone, 
        cidade, 
        foto_url 
      });

      if (isProvider) {
        // 2. Atualiza dados profissionais (INCLUINDO A AGENDA PRESERVADA)
        await api.put(`/professional_profiles/${user.id}`, {
          nicho,
          valor_base: parseFloat(valor_base) || 0,
          descricao,
          working_days: currentWorkingDays // <--- Isso evita que a agenda suma!
        });
      }

      // Atualiza o contexto global
      setCurrentUser({ 
          ...user, 
          nome, telefone, cidade, foto_url,
          nicho, valor_base, descricao 
      });

      toast.success('Perfil atualizado com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error('Erro ao salvar. Verifique sua conexão.', { id: toastId });
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl">
            <ChevronRight className="text-gray-400 rotate-180" />
          </Button>
          <h1 className="font-black italic uppercase tracking-tighter text-lg text-primary">Lartop Perfil</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { setCurrentUser(null); navigate('/auth'); }} className="text-red-500">
          <LogOut size={20} />
        </Button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isProvider && (
          <div className="flex bg-muted p-1 rounded-[22px] gap-1 border shadow-inner">
            <button 
              onClick={() => setActiveTab('perfil')}
              className={`flex-1 py-3 rounded-[18px] font-black text-[10px] uppercase transition-all ${activeTab === 'perfil' ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}
            >
              Meus Dados
            </button>
            <button 
              onClick={() => setActiveTab('portfolio')}
              className={`flex-1 py-3 rounded-[18px] font-black text-[10px] uppercase transition-all ${activeTab === 'portfolio' ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}
            >
              Portfólio ({portfolioPhotos.length})
            </button>
          </div>
        )}

        {activeTab === 'perfil' ? (
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-[32px] border-2 shadow-sm">
              <div className="flex flex-col items-center">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-[40px] bg-primary/5 flex items-center justify-center overflow-hidden border-4 border-background shadow-xl cursor-pointer"
                >
                  {foto_url ? (
                    <img src={cleanImageUrl(foto_url)} className="w-full h-full object-cover" alt="Perfil" />
                  ) : (
                    <User className="w-12 h-12 text-primary/20" />
                  )}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera className="text-white" />
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                <p className="mt-2 text-[9px] font-black uppercase text-muted-foreground italic">Toque para alterar</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase ml-2 text-muted-foreground">Nome Completo</label>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full h-12 px-4 rounded-2xl border bg-muted/30 font-bold outline-none" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase ml-2 text-muted-foreground">WhatsApp</label>
                    <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full h-12 px-4 rounded-2xl border bg-muted/30 font-bold outline-none" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase ml-2 text-muted-foreground">Cidade</label>
                    <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full h-12 px-4 rounded-2xl border bg-muted/30 font-bold outline-none" required />
                  </div>
                </div>

                {isProvider && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase ml-2 text-primary">Nicho de Atuação</label>
                        <input type="text" value={nicho} onChange={(e) => setNicho(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-primary/20 bg-primary/5 font-black text-primary uppercase text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase ml-2 text-primary">Preço Base (R$)</label>
                        <input type="number" value={valor_base} onChange={(e) => setValorBase(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-primary/20 bg-primary/5 font-black text-primary" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase ml-2 text-primary">Bio / Sobre Você</label>
                      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full min-h-[100px] p-4 rounded-2xl border border-primary/20 bg-primary/5 font-medium text-sm outline-none" placeholder="Conte um pouco sobre sua experiência..." />
                    </div>
                  </>
                )}
              </div>
              
              <Button type="submit" className="w-full h-16 rounded-2xl font-black uppercase italic text-lg shadow-lg" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : <><Save className="mr-2" size={20}/> Salvar Lartop Perfil</>}
              </Button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-300">
            {portfolioPhotos.length > 0 ? (
              portfolioPhotos.map((item, idx) => (
                <div key={idx} className="aspect-square rounded-[24px] overflow-hidden bg-muted border relative group">
                  <img src={item.url} className="w-full h-full object-cover" alt="Portfólio" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-3 flex justify-between items-end">
                    <p className="text-[8px] text-white font-black uppercase italic truncate max-w-[70%]">{item.service}</p>
                    <span className="text-[7px] text-white/70 font-bold uppercase">{item.label}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-20 text-center border-2 border-dashed rounded-[32px] bg-muted/30">
                <ImageIcon className="mx-auto mb-4 opacity-10" size={48} />
                <p className="text-[10px] font-black uppercase text-muted-foreground">Seu portfólio será gerado <br/> após concluir serviços!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Nav Fixa */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t px-8 py-4 z-50">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
            <Home size={24}/>
            <span className="text-[8px] font-black uppercase">Home</span>
          </button>

          <button 
            onClick={() => navigate(isProvider ? '/provider-dashboard' : '/my-orders')} 
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            {isProvider ? <FolderSync size={24}/> : <ShoppingBag size={24}/>}
            <span className="text-[8px] font-black uppercase">{isProvider ? 'Painel' : 'Pedidos'}</span>
          </button>

          <div className="relative -mt-14">
            <button onClick={() => navigate('/')} className="w-16 h-16 rounded-full bg-primary shadow-xl border-[6px] border-background text-white flex items-center justify-center transition-transform active:scale-90">
              <Plus size={32}/>
            </button>
          </div>

          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-primary">
            <User size={24}/>
            <span className="text-[8px] font-black uppercase">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Profile;