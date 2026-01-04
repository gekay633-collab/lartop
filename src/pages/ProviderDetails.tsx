import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { Star, MapPin, DollarSign, MessageSquare, Calendar, User, Loader2, Info } from 'lucide-react';
import { api } from '@/api'; 
import { toast } from 'sonner';

const ProviderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setSelectedProvider } = useApp();
  
  const [provider, setProvider] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFullData = async () => {
      if (!id) return;
      try {
        setLoading(true);

        // 1. Busca os dados consolidados do prestador (utilizando a query id no endpoint providers)
        // Isso retorna o objeto que já une a tabela 'users' e 'professional_profiles'
        const { data: providersList } = await api.get(`/providers?id=${id}`);
        
        // 2. Busca as avaliações específicas deste prestador
        const { data: reviewsData } = await api.get(`/providers/${id}/reviews`);
        
        if (providersList && providersList.length > 0) {
          const providerInfo = providersList[0];
          
          setProvider(providerInfo);
          setReviews(Array.isArray(reviewsData) ? reviewsData : []);
        } else {
          toast.error("Profissional não encontrado no Lartop.");
          navigate(-1);
        }
      } catch (error: any) {
        console.error("Erro Lartop ao carregar detalhes:", error);
        toast.error("Erro ao carregar perfil do profissional.");
      } finally {
        setLoading(false);
      }
    };

    fetchFullData();
  }, [id, navigate]);

  const handleStartBooking = () => {
    if (!provider) return;
    // Salva o prestador no contexto global para ser usado na tela de agendamento/pagamento
    setSelectedProvider(provider);
    navigate(`/booking/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-[10px] font-black uppercase italic animate-pulse tracking-widest text-slate-400">Sincronizando Lartop...</p>
        </div>
      </div>
    );
  }

  if (!provider) return null;

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <Header showBack title="Perfil Profissional" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Card de Identidade */}
        <div className="bg-card rounded-[2.5rem] p-8 border-2 shadow-sm flex flex-col items-center text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-28 h-28 rounded-3xl bg-muted overflow-hidden border-4 border-primary/10 mb-4 shadow-xl">
            {provider.foto_url || provider.user_foto ? (
              <img 
                src={provider.foto_url || provider.user_foto} 
                className="w-full h-full object-cover" 
                alt={provider.nome} 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary">
                <User size={48} />
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-black uppercase italic leading-tight tracking-tighter">
            {provider.nome}
          </h2>
          
          <div className="flex items-center gap-2 mt-3">
            <span className="bg-primary text-white text-[9px] px-3 py-1.5 rounded-full font-black uppercase italic tracking-widest">
              {provider.nicho || 'Prestador'}
            </span>
            <div className="flex items-center gap-1 text-amber-600 font-black bg-amber-50 px-3 py-1 rounded-full text-xs border border-amber-100">
              <Star size={12} fill="currentColor" /> {Number(provider.rating || 5.0).toFixed(1)}
            </div>
          </div>
        </div>

        {/* Informações Rápidas (Preço e Local) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card p-5 rounded-[2rem] border-2 shadow-sm flex flex-col items-center justify-center text-center">
            <DollarSign className="text-primary mb-1" size={18} />
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Preço Base</span>
            <span className="font-black text-lg">R$ {Number(provider.valor_base || 0).toFixed(2)}</span>
          </div>
          <div className="bg-card p-5 rounded-[2rem] border-2 shadow-sm flex flex-col items-center justify-center text-center">
            <MapPin className="text-primary mb-1" size={18} />
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Localização</span>
            <span className="font-black text-base truncate w-full">{provider.cidade || "Maricá"}</span>
          </div>
        </div>

        {/* Sobre o Profissional */}
        <div className="bg-card p-6 rounded-[2.2rem] border-2 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
             <Info size={14} className="text-primary" />
             <h3 className="font-black text-[10px] uppercase text-primary italic tracking-widest">Sobre o profissional</h3>
          </div>
          <p className="text-sm text-muted-foreground font-medium italic leading-relaxed">
            "{provider.descricao || `Olá! Sou ${provider.nome}, profissional parceiro Lartop disponível para ${provider.nicho}. Compromisso com a qualidade e satisfação do cliente.`}"
          </p>
          
          {provider.working_days && (
            <div className="mt-4 pt-4 border-t border-dashed flex flex-col gap-1">
               <span className="text-[9px] font-black uppercase text-slate-400">Dias disponíveis:</span>
               <span className="text-xs font-bold italic text-slate-700">{provider.working_days}</span>
            </div>
          )}
        </div>

        {/* Seção de Feedbacks/Avaliações */}
        <div className="space-y-4 pt-4 pb-10">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-lg uppercase italic flex items-center gap-2 tracking-tighter">
              <MessageSquare size={20} className="text-primary" /> Feedbacks ({reviews.length})
            </h3>
          </div>
          
          {reviews.length === 0 ? (
            <div className="bg-muted/10 border-2 border-dashed rounded-[2rem] p-10 text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground italic">
                Nenhum feedback registrado ainda.
              </p>
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="bg-card p-5 rounded-[2rem] border-2 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                      {rev.cliente_foto ? (
                         <img src={rev.cliente_foto} className="w-full h-full object-cover" alt="Cliente" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={14} /></div>
                      )}
                    </div>
                    <span className="font-black text-[10px] uppercase italic text-primary">
                      {rev.cliente_nome || 'Cliente Lartop'}
                    </span>
                  </div>
                  <div className="flex text-amber-500 gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={10} fill={i < rev.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-medium italic text-muted-foreground leading-snug px-1">
                  "{rev.comment}"
                </p>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer Fixo com Ação de Agendamento */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-background/90 backdrop-blur-xl border-t z-50">
        <div className="max-w-lg mx-auto">
          <Button 
            className="w-full h-16 rounded-[1.8rem] font-black text-lg shadow-2xl shadow-primary/30 uppercase italic transition-all active:scale-95 gap-3"
            onClick={handleStartBooking}
          >
            <Calendar size={20} /> Agendar Agora
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProviderDetails;