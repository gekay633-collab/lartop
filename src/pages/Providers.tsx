import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Star, 
  MapPin, 
  User, 
  ClipboardList, 
  Home, 
  FolderSync, 
  Plus, 
  XCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '@/api'; // Utilizando nossa API centralizada do Lartop

const Providers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [providers, setProviders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        // BUSCA: Utiliza a rota /providers do seu servidor Node/Neon
        const response = await api.get('/providers');
        
        const data = response.data || [];

        // FILTRO: Remove administradores da listagem e formata os campos
        const formattedData = data
          .filter((p: any) => p.tipo !== 'admin' && p.is_admin !== true)
          .map((p: any) => ({
            ...p,
            // Fallback para campos caso venham dentro do objeto users ou direto
            nome: p.nome || p.users?.nome || 'Profissional',
            cidade: p.cidade || p.users?.cidade || 'Maricá, RJ',
            user_id: p.user_id || p.id // Garante o ID correto para navegação
          }));

        setProviders(formattedData);
      } catch (err) {
        console.error("Erro ao buscar prestadores via Lartop API:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  const filteredProviders = providers.filter(p => 
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nicho?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-2xl hover:bg-slate-100">
            <XCircle className="w-6 h-6 text-slate-400" />
          </Button>
          <h1 className="font-black italic uppercase tracking-tighter text-lg text-slate-800">Profissionais</h1>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl h-9 w-9 text-slate-500 hover:text-primary">
            <Home size={18} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/my-orders')} 
            className={`rounded-xl h-9 w-9 ${location.pathname === '/my-orders' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
          >
            <FolderSync size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="rounded-xl h-9 w-9 text-slate-500 hover:text-primary">
            <User size={18} />
          </Button>
        </div>
      </header>
      
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-4 h-4" />
          <Input 
            placeholder="O que você precisa hoje?" 
            className="pl-12 rounded-[22px] h-14 bg-white border-none shadow-sm font-bold text-slate-700 placeholder:text-slate-400 focus-visible:ring-2 ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-[10px] font-black uppercase italic tracking-widest">Localizando talentos...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProviders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-100">
                <Search className="mx-auto text-slate-200 mb-4" size={48} />
                <p className="text-slate-400 font-black uppercase italic text-xs">Nenhum profissional online no momento</p>
              </div>
            ) : (
              filteredProviders.map((p) => (
                <div 
                  key={p.id} 
                  className="bg-white border border-slate-50 rounded-[35px] p-5 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-[28px] bg-slate-100 overflow-hidden flex-shrink-0 border-4 border-slate-50 shadow-inner">
                      {p.foto_url ? (
                        <img src={p.foto_url} className="w-full h-full object-cover" alt={p.nome} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                          <User size={32} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-black text-slate-800 italic uppercase tracking-tighter truncate text-base">{p.nome}</h3>
                        <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-xl text-amber-600 text-[10px] font-black border border-amber-100 shrink-0">
                          <Star size={10} fill="currentColor" /> {Number(p.rating || 5.0).toFixed(1)}
                        </div>
                      </div>
                      <p className="text-[10px] text-primary font-black uppercase tracking-[0.15em] mt-1 italic">{p.nicho || 'Profissional'}</p>
                      
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mt-3">
                        <MapPin size={10} className="text-primary" /> {p.cidade}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-5">
                    <div className="flex gap-2">
                      <button 
                        className="flex-1 bg-white border-2 border-slate-100 rounded-[18px] h-12 text-[10px] font-black uppercase italic hover:bg-slate-50 active:scale-95 transition-all text-slate-700"
                        onClick={() => navigate(`/provider/${p.user_id}`)}
                      >
                        Ver Perfil
                      </button>

                      <button 
                        className="flex-1 bg-white border-2 border-indigo-100 rounded-[18px] h-12 text-[10px] font-black uppercase italic text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                        onClick={() => navigate(`/portfolio/${p.user_id}`)}
                      >
                        <ImageIcon size={14} /> Portfólio
                      </button>
                    </div>

                    <Button 
                      className="w-full rounded-[18px] h-12 text-[10px] font-black uppercase italic gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                      onClick={() => navigate(`/booking/${p.user_id}`)}
                    >
                      <ClipboardList size={14} /> Contratar Agora
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Navegação Inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-8 py-4 z-50">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-slate-300 hover:text-primary transition-all">
            <Home size={24} />
            <span className="text-[8px] font-black uppercase tracking-tighter">Início</span>
          </button>

          <button 
            onClick={() => navigate('/my-orders')} 
            className={`flex flex-col items-center gap-1 transition-all ${location.pathname === '/my-orders' ? 'text-primary' : 'text-slate-300'}`}
          >
            <FolderSync size={24} />
            <span className="text-[8px] font-black uppercase tracking-tighter">Pedidos</span>
          </button>

          <div className="relative -mt-14">
            <button 
              onClick={() => navigate('/')} 
              className="w-16 h-16 rounded-full bg-primary shadow-2xl shadow-primary/40 border-[6px] border-slate-50 text-white flex items-center justify-center transition-transform active:scale-90"
            >
              <Plus size={32} />
            </button>
          </div>

          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-slate-300 hover:text-primary transition-all">
            <User size={24} />
            <span className="text-[8px] font-black uppercase tracking-tighter">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Providers;