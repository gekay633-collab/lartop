import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useApp } from '@/contexts/AppContext';
import { 
  MapPin, Star, 
  Image as ImageIcon, Loader2, Camera, Play, CloudRain, Send,
  Calendar
} from 'lucide-react';
import { api } from '@/api'; // Centralizado no seu Node
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * FUNÇÃO DE LIMPEZA LARTOP (V3 - MULTI-FOTO):
 * Mantida exatamente como solicitada.
 */
const cleanAllImages = (rawUrl: any): string[] => {
  if (!rawUrl) return [];
  try {
    let urls: any[] = [];
    if (Array.isArray(rawUrl)) {
      urls = rawUrl;
    } else if (typeof rawUrl === 'string' && (rawUrl.startsWith('[') || rawUrl.startsWith('{'))) {
      const parsed = JSON.parse(rawUrl);
      urls = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      urls = [String(rawUrl)];
    }
    return urls
      .map(u => String(u).replace(/[\[\]"\\ ]/g, "").trim())
      .filter(u => u && u !== "null" && u !== "undefined");
  } catch (e) {
    return [String(rawUrl).replace(/[\[\]"\\ ]/g, "").trim()];
  }
};

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'orders' | 'reviews' | 'agenda'>('orders');
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState<{ [key: number]: string }>({});
  
  // ESTADO DA AGENDA LARTOP
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  
  const knownOrderIds = useRef<Set<number>>(new Set());

  // CARREGAR PEDIDOS VIA NODE (LARTOP BACKEND)
  const loadOrders = useCallback(async (isSilent = false) => {
    if (!currentUser?.id) return;
    try {
      const response = await api.get(`/orders/provider/${currentUser.id}`);
      const ordersData = Array.isArray(response.data) ? response.data : [];

      const earnings = ordersData
        .filter((o: any) => o.status === 'completed')
        .reduce((acc, o) => acc + Number(o.price || 0), 0);
      setTotalEarnings(earnings);

      const activeOrders = ordersData.filter((o: any) => 
        !['completed', 'cancelled', 'cancelled_rain_confirmed'].includes(o.status)
      );

      if (isSilent && activeOrders.length > knownOrderIds.current.size) {
        const hasNew = activeOrders.some(o => !knownOrderIds.current.has(o.id));
        if (hasNew) toast.info("🔔 Novo pedido Lartop recebido!");
      }

      knownOrderIds.current = new Set(activeOrders.map((o: any) => o.id));
      setOrders(activeOrders);
    } catch (err: any) {
      console.error("Erro ao carregar pedidos Lartop via Node:", err);
    }
  }, [currentUser]);

  // CARREGAR PERFIL E REVIEWS COM SINCRONIZAÇÃO DE AGENDA
  const loadProfileAndReviews = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const [reviewsRes, profileRes] = await Promise.all([
        api.get(`/reviews/provider/${currentUser.id}`),
        api.get(`/professional_profiles/${currentUser.id}`)
      ]);

      if (reviewsRes.data) setReviews(reviewsRes.data);
      
      if (profileRes.data) {
        // Algumas APIs retornam array, outras objeto direto
        const pData = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
        setProfile(pData);
        
        // SINCRONIA: Se houver dias no banco, carrega no estado de marcação
        if (pData.working_days) {
          const daysArray = pData.working_days.split(',').map((d: string) => d.trim()).filter(Boolean);
          setWorkingDays(daysArray);
        }
      }
    } catch (err) { 
        console.error("Erro ao carregar feedbacks/perfil via Node:", err); 
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProfileAndReviews(), loadOrders()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(() => loadOrders(true), 5000);
    return () => clearInterval(interval);
  }, [currentUser, loadOrders, loadProfileAndReviews]);

  const handleUpdateStatus = async (orderId: number, status: string, extraData = {}) => {
    try {
      await api.patch(`/orders/${orderId}`, { status, ...extraData });
      toast.success(`Lartop: Status atualizado!`);
      await loadOrders(true);
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleRainDelay = async (orderId: number) => {
    try {
      await api.patch(`/orders/${orderId}`, { status: 'cancelled_rain' });
      toast.info("Aviso de chuva enviado!");
      loadOrders(true);
    } catch (error) {
      toast.error("Erro ao reportar chuva.");
    }
  };

  const handleFileUpload = async (orderId: number, type: 'before' | 'after', file: File) => {
    const uploadKey = `${orderId}-${type}`;
    try {
      setUploadingId(uploadKey);
      const photoUrl = await api.uploadPhoto(file);
      if (!photoUrl) throw new Error("Falha no upload");

      await api.patch(`/orders/${orderId}`, { 
        [type === 'before' ? 'photo_before' : 'photo_after']: photoUrl 
      });

      toast.success("Foto salva no Cloudinary!");
      loadOrders(true);
    } catch (e: any) {
      toast.error("Erro no upload de mídia.");
    } finally {
      setUploadingId(null);
    }
  };

  const toggleDay = (day: string) => {
    setWorkingDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  /**
   * SALVAR AGENDA: Persiste e mantém a marcação visual
   */
  const saveAgenda = async () => {
    if (!currentUser?.id) return;
    try {
      const daysString = workingDays.join(',');

      // 1. Salva no banco de dados via PATCH
      await api.patch(`/professional_profiles/${currentUser.id}`, { 
        working_days: daysString
      });
      
      // 2. Atualiza o estado do profile local para manter a consistência
      setProfile((prev: any) => ({
        ...prev,
        working_days: daysString
      }));

      toast.success("Agenda Lartop salva com sucesso!");
    } catch (e) { 
      console.error("Erro ao salvar agenda Lartop:", e);
      toast.error("Erro ao salvar agenda."); 
    }
  };

  if (loading && !profile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase italic">Sincronizando Painel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header showProfile title="Painel Lartop" />
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-black uppercase italic mb-6">Olá, {currentUser?.nome?.split(' ')[0]}!</h1>

        {/* GANHOS */}
        <section className="bg-primary rounded-[32px] p-6 text-primary-foreground shadow-2xl mb-8 relative overflow-hidden">
          <p className="text-[10px] font-black uppercase opacity-70 mb-1">Ganhos em Aberto</p>
          <h2 className="text-4xl font-black italic mb-6">
            R$ {totalEarnings.toFixed(2)}
          </h2>
          <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-4 text-center">
            <div><p className="text-[9px] font-bold uppercase opacity-60">Fila</p><p className="font-black text-lg">{orders.length}</p></div>
            <div><p className="text-[9px] font-bold uppercase opacity-60">Nota</p><p className="font-black text-lg">{profile?.rating || '5.0'}</p></div>
            <div><p className="text-[9px] font-bold uppercase opacity-60">Status</p><p className="font-black text-[10px] uppercase">Online</p></div>
          </div>
        </section>

        {/* TABS */}
        <div className="flex bg-muted p-1.5 rounded-2xl mb-6">
          {(['orders', 'reviews', 'agenda'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === tab ? 'bg-background shadow-md text-primary' : 'text-muted-foreground'}`}>
              {tab === 'orders' ? 'Pedidos' : tab === 'reviews' ? 'Feedback' : 'Agenda'}
            </button>
          ))}
        </div>

        {/* CONTEÚDO PEDIDOS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-card border-2 border-dashed rounded-[32px] p-12 text-center text-muted-foreground italic font-black uppercase text-[10px]">Sem chamados ativos.</div>
            ) : (
              orders.map((order) => {
                const imageUrls = cleanAllImages(order.photos_request);

                return (
                  <div key={order.id} className="bg-card border-2 rounded-[28px] p-5 space-y-4 shadow-sm border-primary/10">
                    <div className="flex justify-between items-start">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[8px] font-black uppercase italic">{order.status}</span>
                      <span className="font-black italic text-lg text-primary">R$ {Number(order.price || 0).toFixed(2)}</span>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div className="flex-1">
                        <h3 className="font-black uppercase text-sm italic">{order.client?.nome || 'Cliente Lartop'}</h3>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {order.address}</p>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {imageUrls.length > 0 ? (
                          imageUrls.map((url, idx) => (
                            <div 
                              key={idx}
                              onClick={() => setSelectedImage(url)} 
                              className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center overflow-hidden border border-border cursor-pointer shrink-0"
                            >
                              <img 
                                src={url} 
                                className="w-full h-full object-cover" 
                                alt={`Solicitação ${idx + 1}`} 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://placehold.co/200x200?text=Lartop";
                                }}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center border border-border">
                            <ImageIcon className="opacity-20" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-primary uppercase mb-1 italic">Solicitação do Cliente:</p>
                      <p className="text-[11px] italic text-muted-foreground leading-relaxed">
                        {order.description_request || "O cliente não enviou uma descrição."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 border-t pt-4">
                      {(order.status === 'pending' || order.status === 'pending_quote') && (
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="Valor"
                            className="flex-1 bg-muted border-none rounded-xl px-4 text-xs font-bold"
                            onChange={(e) => setQuotePrice({...quotePrice, [order.id]: e.target.value})}
                          />
                          <Button 
                            onClick={() => handleUpdateStatus(order.id, 'waiting_client', { price: quotePrice[order.id] })} 
                            disabled={!quotePrice[order.id]}
                            className="bg-primary font-black uppercase text-[10px]"
                          >
                            <Send size={14} className="mr-2"/> Enviar
                          </Button>
                        </div>
                      )}

                      {order.status === 'waiting_client' && (
                        <div className="bg-muted p-3 rounded-xl text-center">
                          <p className="text-[9px] font-black uppercase text-muted-foreground animate-pulse">Aguardando Cliente...</p>
                        </div>
                      )}

                      {order.status === 'accepted' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => handleUpdateStatus(order.id, 'arrived')} className="bg-indigo-600 font-black uppercase text-[10px]">Cheguei</Button>
                          <Button onClick={() => handleRainDelay(order.id)} variant="outline" className="text-blue-500 border-blue-200 font-black uppercase text-[10px]"><CloudRain size={14} className="mr-2"/> Chuva</Button>
                        </div>
                      )}

                      {order.status === 'arrived' && (
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center">
                          <p className="text-[9px] font-black uppercase text-orange-600 animate-pulse italic">Aguardando Confirmação...</p>
                        </div>
                      )}

                      {order.status === 'in_progress_authorized' && (
                        <Button onClick={() => handleUpdateStatus(order.id, 'in_progress')} className="bg-orange-500 font-black uppercase text-[10px] h-12 shadow-lg">
                          <Play size={16} fill="white" className="mr-2"/> Começar o Serviço
                        </Button>
                      )}

                      {order.status === 'in_progress' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer bg-muted/30 overflow-hidden relative">
                              {uploadingId === `${order.id}-before` ? <Loader2 className="animate-spin" /> : (
                                cleanAllImages(order.photo_before)[0] ? <img src={cleanAllImages(order.photo_before)[0]} className="w-full h-full object-cover" /> : <><Camera size={20}/><span className="text-[8px] font-black">FOTO ANTES</span></>
                              )}
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(order.id, 'before', e.target.files[0])} />
                            </label>
                            <label className="h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer bg-muted/30 overflow-hidden relative">
                              {uploadingId === `${order.id}-after` ? <Loader2 className="animate-spin" /> : (
                                cleanAllImages(order.photo_after)[0] ? <img src={cleanAllImages(order.photo_after)[0]} className="w-full h-full object-cover" /> : <><Camera size={20}/><span className="text-[8px] font-black">FOTO DEPOIS</span></>
                              )}
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(order.id, 'after', e.target.files[0])} />
                            </label>
                          </div>
                          <Button 
                            disabled={!order.photo_after || !order.photo_before}
                            onClick={() => handleUpdateStatus(order.id, 'waiting_confirmation')} 
                            className="w-full bg-green-600 font-black uppercase text-[10px] shadow-lg"
                          >
                            Finalizar Serviço
                          </Button>
                        </div>
                      )}

                      {order.status === 'waiting_confirmation' && (
                        <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                          <p className="text-[9px] font-black uppercase text-green-600 italic">Aguardando Pagamento...</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* FEEDBACK */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-card border-2 border-dashed rounded-[32px] p-12 text-center text-muted-foreground italic font-black uppercase text-[10px]">Ainda não há avaliações.</div>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="bg-card p-5 rounded-[28px] border-2 border-primary/5 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black uppercase text-xs italic">{rev.nome || 'Cliente Lartop'}</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} className={i < rev.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">"{rev.comment}"</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* AGENDA - CORRIGIDA PARA PERSISTIR MARCAÇÃO */}
        {activeTab === 'agenda' && (
          <div className="bg-card p-6 rounded-[32px] border-2 border-primary/10 shadow-sm">
            <h3 className="font-black uppercase italic text-sm mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-primary" /> Dias de Atendimento
            </h3>
            <div className="grid grid-cols-4 gap-2 mb-8">
              {daysOfWeek.map(day => {
                const isSelected = workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all duration-200 ${
                      isSelected 
                        ? 'bg-primary text-white shadow-lg scale-105' 
                        : 'bg-muted text-muted-foreground active:scale-95'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <Button 
              onClick={saveAgenda} 
              className="w-full h-14 rounded-2xl bg-primary font-black uppercase italic tracking-wider shadow-md hover:shadow-lg transition-all"
            >
              Salvar Agenda Lartop
            </Button>
            <p className="text-[8px] text-center mt-4 text-muted-foreground font-bold uppercase italic">Os dias marcados ficarão ativos no seu perfil público.</p>
          </div>
        )}
      </main>

      {/* MODAL DE FOTO */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="p-0 border-none bg-transparent max-w-[95vw] flex items-center justify-center">
          <div className="sr-only">
            <DialogTitle>Visualização Lartop</DialogTitle>
            <DialogDescription>Foto ampliada.</DialogDescription>
          </div>
          {selectedImage && (
            <img src={selectedImage} className="w-full rounded-[2.5rem] shadow-2xl" alt="Preview Lartop" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProviderDashboard;