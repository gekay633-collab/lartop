import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { OrderCard } from '@/components/OrderCard';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { 
  Plus, 
  ClipboardList, 
  Loader2, 
  CloudRain,
  Home,
  FolderSync,
  Star,
  DollarSign,
  CheckCircle2,
  Image as ImageIcon,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const MyOrders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { currentUser, orders, fetchOrders, loading, updateOrderStatus } = useApp();
  
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // --- CORREÇÃO DE CONSUMO DE DADOS ---
  useEffect(() => {
    if (!currentUser) {
      const t = setTimeout(() => { if (!currentUser) navigate('/auth'); }, 500);
      return () => clearTimeout(t);
    }

    // Carrega os pedidos ao montar a tela
    fetchOrders();

    // Removido o setInterval de 4s que causava o consumo excessivo.
    // O fetchOrders agora só será chamado em eventos específicos (status change/review).
  }, [currentUser?.id, navigate]); // Removido fetchOrders das dependências para evitar loops

  const handleUpdateStatus = async (orderId: number, status: string, orderData?: any) => {
    try {
      const loadingToast = toast.loading("Sincronizando Lartop...");
      const targetStatus = status === 'in_progress' ? 'in_progress_authorized' : status;
      
      await updateOrderStatus(orderId, targetStatus);
      toast.dismiss(loadingToast);
      
      if (status === 'completed' && orderData) {
        setSelectedOrder(orderData);
        setShowReviewDialog(true);
      }
      
      // Atualiza os dados apenas após uma ação do usuário
      await fetchOrders();
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleConfirmRainCancellation = async (orderId: number) => {
    try {
      await updateOrderStatus(orderId, 'cancelled_rain_confirmed');
      toast.success("Cancelamento por chuva confirmado! 🌧️");
      await fetchOrders();
    } catch (error) {
      toast.error("Erro ao confirmar cancelamento.");
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedOrder || !currentUser) return;
    try {
      setSubmittingReview(true);
      await api.post('/reviews', {
        order_id: Number(selectedOrder.id),
        user_id: Number(currentUser.id), 
        provider_id: Number(selectedOrder.provider_id), 
        rating: Number(rating),
        comment: comment.trim() || "Serviço realizado com sucesso via Lartop"
      });

      toast.success("Obrigado pela sua avaliação!");
      setShowReviewDialog(false);
      setComment("");
      setRating(5);
      
      // Atualiza a lista após avaliar
      await fetchOrders();
    } catch (error) {
      console.error("Erro review:", error);
      toast.error("Erro ao enviar avaliação.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!currentUser) return <div className="flex justify-center items-center min-h-screen bg-background"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-40 text-foreground">
      <Header showBack={false} title="Minhas Solicitações" />

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase opacity-40">Buscando seus pedidos Lartop...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-card border-2 border-dashed rounded-[32px] p-10 mx-2">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="italic text-muted-foreground mb-6 font-medium">Nenhum pedido ativo no momento.</p>
            <Button onClick={() => navigate('/')} className="rounded-full px-8 font-black uppercase text-xs">Solicitar Agora</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order: any) => {
              // CORREÇÃO: Usar parseFloat para garantir leitura de centavos (ex: 0.50)
              const currentPrice = order.price ? parseFloat(String(order.price)) : 0;
              const isOwner = currentUser.id === order.user_id;
              const safeProvider = order.prestador ? { ...order.prestador, senha: null } : null;
              const providerDisplayName = safeProvider?.nome || "Profissional Lartop";

              return (
                <div key={order.id} className="space-y-3">
                  <OrderCard order={{ ...order, prestador: safeProvider, providerName: providerDisplayName }} />

                  {/* CORREÇÃO: Removido 'currentPrice > 0' para permitir valores < 1 aparecerem */}
                  {isOwner && order.status === 'waiting_client' && (
                    <div className="bg-primary/10 p-5 rounded-[2.5rem] border-2 border-primary shadow-xl mx-2">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                          <DollarSign size={20} className="text-primary" />
                          <span className="text-[10px] font-black uppercase text-primary">Proposta Lartop</span>
                        </div>
                        <p className="text-2xl font-black italic text-primary">R$ {currentPrice.toFixed(2)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="rounded-2xl h-12 font-black uppercase text-[10px] text-red-500 border-red-200" onClick={() => handleUpdateStatus(order.id, 'cancelled')}>Recusar</Button>
                        <Button className="rounded-2xl h-12 font-black uppercase text-[10px] bg-primary text-white" onClick={() => handleUpdateStatus(order.id, 'accepted')}>Aceitar</Button>
                      </div>
                    </div>
                  )}

                  {isOwner && order.status === 'arrived' && (
                    <div className="bg-indigo-600 p-5 rounded-[2.5rem] shadow-xl text-white mx-2 text-center">
                      <div className="flex justify-center mb-3">
                        <MapPin className="animate-bounce" />
                      </div>
                      <p className="text-[11px] font-black uppercase italic mb-4">
                        O profissional informou que chegou ao local. Confirma?
                      </p>
                      <Button 
                        className="w-full bg-white text-indigo-600 font-black rounded-2xl h-12 text-[10px] uppercase"
                        onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                      >
                        Confirmar Chegada
                      </Button>
                    </div>
                  )}

                  {isOwner && (order.status === 'waiting_confirmation' || order.status === 'waiting_completion') && (
                    <div className="bg-green-600 p-5 rounded-[2.5rem] shadow-xl text-white mx-2">
                      <p className="text-[11px] font-black uppercase italic text-center mb-3">
                          Confira o resultado final:
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="space-y-1 text-center">
                          <p className="text-[7px] uppercase font-bold text-white/70">Antes</p>
                          <div className="h-24 w-full bg-black/10 rounded-xl overflow-hidden border border-white/20">
                            {order.photo_before ? (
                                <img src={order.photo_before} alt="Antes" className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full flex items-center justify-center opacity-30"><ImageIcon size={16} /></div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 text-center">
                          <p className="text-[7px] uppercase font-bold text-white/70">Depois</p>
                          <div className="h-24 w-full bg-black/10 rounded-xl overflow-hidden border border-white/20">
                            {order.photo_after ? (
                                <img src={order.photo_after} alt="Depois" className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full flex items-center justify-center opacity-30"><Loader2 className="animate-spin" size={16} /></div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button 
                        className="w-full bg-white text-green-600 hover:bg-slate-100 font-black rounded-2xl h-12 text-[10px] uppercase gap-2 shadow-lg"
                        onClick={() => handleUpdateStatus(order.id, 'completed', order)}
                      >
                        <CheckCircle2 size={16} /> Confirmar e Pagar
                      </Button>
                    </div>
                  )}

                  {order.status === 'cancelled_rain' && (
                    <div className="bg-blue-600 p-5 rounded-[2.5rem] shadow-lg text-white mx-2">
                      <div className="flex items-center gap-2 justify-center mb-3">
                        <CloudRain size={20} />
                        <p className="text-[10px] font-black uppercase italic text-center">O Profissional reportou chuva intensa.</p>
                      </div>
                      <Button className="w-full bg-white text-blue-600 font-black rounded-xl h-10 text-[10px] uppercase" onClick={() => handleConfirmRainCancellation(order.id)}>Ok, Entendido</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t px-8 py-4 z-50">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/')} className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-primary' : 'text-slate-300'}`}>
            <Home size={24} /><span className="text-[8px] font-black uppercase">Início</span>
          </button>
          <div className="relative -mt-14">
            <button onClick={() => navigate('/')} className="w-16 h-16 rounded-full bg-primary border-[6px] border-background text-white flex items-center justify-center shadow-xl active:scale-90 transition-transform">
              <Plus size={32} />
            </button>
          </div>
          <button onClick={() => navigate('/my-orders')} className={`flex flex-col items-center gap-1 ${location.pathname === '/my-orders' ? 'text-primary' : 'text-slate-300'}`}>
            <FolderSync size={24} /><span className="text-[8px] font-black uppercase">Pedidos</span>
          </button>
        </div>
      </nav>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="rounded-[2.5rem] w-[92%] mx-auto p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-center font-black text-primary uppercase italic text-lg tracking-tight">
                Avaliar Lartop
            </DialogTitle>
            <DialogDescription className="text-center text-[10px] font-bold text-slate-400 uppercase">
               Sua opinião ajuda a manter a qualidade dos nossos serviços.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center gap-2 py-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)} type="button" className="transition-transform active:scale-90">
                <Star size={36} className={s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
              </button>
            ))}
          </div>
          <textarea 
            className="w-full bg-muted/40 border-none rounded-2xl p-4 text-sm min-h-[100px] outline-none font-medium" 
            placeholder="Conte-nos como foi sua experiência..." 
            value={comment} 
            onChange={(e) => setComment(e.target.value)} 
          />
          <Button 
            className="w-full bg-primary text-white font-black mt-4 h-14 rounded-2xl uppercase italic" 
            onClick={handleSubmitReview} 
            disabled={submittingReview}
          >
            {submittingReview ? <Loader2 className="animate-spin" /> : "Finalizar Experiência"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyOrders;