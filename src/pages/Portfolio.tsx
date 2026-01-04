import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/api';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, X, ArrowRight, Loader2 } from 'lucide-react';

const Portfolio = () => {
  const { id } = useParams(); // provider_id
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        
        /**
         * Lartop - Sincronização de Portfólio:
         * Buscamos pedidos concluídos onde as colunas de foto não estão nulas.
         * Note: Ajustei a query para buscar 'photo_before' e 'photo_after' 
         * que é o padrão que configuramos no seu Storage do Supabase.
         */
        const res = await api.get(`/api/service_orders?provider_id=eq.${id}&status=eq.completed&select=id,service_type,photo_before,photo_after,created_at`);
        
        // Filtramos para garantir que só apareçam no portfólio serviços que tenham pelo menos uma das fotos
        const portfolioItems = res.data.filter((order: any) => 
          order.photo_before || order.photo_after
        );
        
        setItems(portfolioItems);
      } catch (err: any) {
        console.error('Erro ao buscar portfólio Lartop:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32">
      <Header showBack title="Portfólio de Serviços" />

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-primary">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="font-black uppercase italic text-xs tracking-widest">Carregando Galeria Lartop...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 mx-2">
            <ImageIcon className="mx-auto text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-black uppercase italic text-[10px] tracking-widest px-10">
              Este profissional ainda não possui transformações registradas no portfólio.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((order) => (
              <div key={order.id} className="bg-white rounded-[2.5rem] overflow-hidden border shadow-sm p-4 animate-in fade-in slide-in-from-bottom-3 mx-2">
                
                {/* Cabeçalho do Card */}
                <div className="flex justify-between items-center mb-4 px-2">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase italic text-primary tracking-tighter">
                       {order.service_type || 'Serviço Realizado'}
                     </span>
                     <span className="text-[8px] font-bold text-muted-foreground uppercase">
                       {new Date(order.created_at).toLocaleDateString('pt-BR')}
                     </span>
                   </div>
                   <div className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-1 rounded-full uppercase">
                     Concluído
                   </div>
                </div>

                {/* Grid de Antes e Depois */}
                <div className="grid grid-cols-2 gap-3 relative">
                  
                  {/* Lado: ANTES */}
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border bg-slate-50">
                    {order.photo_before ? (
                      <img 
                        src={order.photo_before} 
                        alt="Antes" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2">
                        <ImageIcon size={16} className="text-slate-200" />
                        <span className="text-[7px] font-black text-slate-300 uppercase">Sem foto</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase">
                      Antes
                    </div>
                  </div>

                  {/* Lado: DEPOIS */}
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border-2 border-primary/20 bg-slate-50">
                    {order.photo_after ? (
                      <img 
                        src={order.photo_after} 
                        alt="Depois" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2">
                        <ImageIcon size={16} className="text-slate-200" />
                        <span className="text-[7px] font-black text-slate-300 uppercase">Sem foto</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-primary text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase shadow-lg">
                      Depois
                    </div>
                  </div>
                  
                  {/* Ícone Indicador Central */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-xl border-4 border-slate-50 z-10">
                    <ArrowRight size={14} className="text-primary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Botão Flutuante de Fechar */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <Button 
          onClick={() => navigate(-1)} 
          className="rounded-full px-8 h-14 bg-white border-2 border-slate-200 text-slate-900 hover:bg-slate-50 shadow-2xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all active:scale-90"
        > 
          <X size={20} /> Fechar Galeria
        </Button>
      </nav>
    </div>
  );
};

export default Portfolio;