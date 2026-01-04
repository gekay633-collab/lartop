import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Star, Send, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useApp } from '@/contexts/AppContext';

const ProviderReviewPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/api/orders/details/${orderId}`);
        setOrderData(response.data);
      } catch (error) {
        console.error("Erro ao buscar detalhes do pedido:", error);
      }
    };
    if (orderId) fetchOrderDetails();
  }, [orderId]);

  const handleSubmitReview = async () => {
    if (!comment.trim()) {
      toast.error("Por favor, escreva um comentário.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`http://localhost:3001/api/reviews`, {
        order_id: orderId,
        provider_id: orderData.provider_id,
        user_id: currentUser?.id,
        rating,
        comment
      });

      toast.success("Avaliação enviada com sucesso!");
      navigate('/my-orders');
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      toast.error("Erro ao enviar avaliação.");
    } finally {
      setLoading(false);
    }
  };

  if (!orderData) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header showBack title="Avaliar Serviço" />
      
      <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-10 h-10 text-primary" fill="currentColor" />
          </div>
          <h2 className="text-2xl font-black">Como foi o serviço?</h2>
          <p className="text-muted-foreground">Sua avaliação ajuda o profissional <strong>{orderData.provider_nome}</strong> e a comunidade.</p>
        </div>

        {/* Seleção de Estrelas */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="transition-transform active:scale-125"
            >
              <Star 
                size={40} 
                fill={star <= rating ? "#f59e0b" : "none"} 
                className={star <= rating ? "text-amber-500" : "text-muted-foreground/30"}
              />
            </button>
          ))}
        </div>

        {/* Campo de Texto */}
        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2">
            <MessageSquare size={16} /> Seu comentário:
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte-nos os detalhes do serviço..."
            className="w-full h-32 p-4 rounded-2xl border bg-card resize-none focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <Button 
          className="w-full h-14 rounded-2xl font-black text-lg shadow-lg"
          onClick={handleSubmitReview}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
          ENVIAR AVALIAÇÃO
        </Button>
      </main>
    </div>
  );
};

export default ProviderReviewPage;