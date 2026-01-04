import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Smile, Frown, Meh, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const ClientReview = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Função para retornar o ícone baseado na nota
  const getFeedbackIcon = () => {
    if (rating === 0) return null;
    if (rating <= 2) return <Frown className="text-red-500 w-12 h-12 animate-bounce" />;
    if (rating === 3) return <Meh className="text-amber-500 w-12 h-12 animate-bounce" />;
    return <Smile className="text-green-500 w-12 h-12 animate-bounce" />;
  };

  const handleSubmit = async () => {
    if (rating === 0) return toast.error("Por favor, selecione uma nota de 1 a 5");

    setIsSubmitting(true);
    try {
      // Endpoint atualizado para bater com o seu backend
      await axios.post(`http://localhost:3001/api/orders/${orderId}/client-review`, {
        rating,
        comment,
        date: new Date().toISOString()
      });
      
      toast.success("Obrigado! Sua avaliação ajuda a manter a comunidade LARTOP segura.");
      
      // Pequeno delay para o usuário ver o sucesso antes de redirecionar
      setTimeout(() => {
        navigate('/provider-dashboard');
      }, 1000);

    } catch (error: any) {
      console.error("Erro ao avaliar:", error);
      
      // Tratamento para o erro de ID inexistente (Foreign Key fail)
      if (error.response?.status === 500) {
        toast.error("Erro: Este pedido não foi encontrado ou já foi avaliado.");
      } else {
        toast.error("Não foi possível enviar a avaliação agora.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Avaliar Cliente" showBack />
      
      <main className="max-w-lg mx-auto px-6 py-10 space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 flex items-center justify-center">
            {getFeedbackIcon()}
          </div>
          <div>
            <h2 className="text-2xl font-black italic">COMO FOI O SERVIÇO?</h2>
            <p className="text-muted-foreground text-sm">
              Sua experiência na casa do cliente ajuda outros profissionais.
            </p>
          </div>
        </div>

        {/* Estrelas Gigantes e Interativas */}
        <div className="flex justify-center gap-3 bg-secondary/30 py-6 rounded-3xl">
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star} 
              type="button"
              onClick={() => setRating(star)}
              className="transition-transform active:scale-90 hover:scale-110"
            >
              <Star 
                size={44} 
                className={`${
                  star <= rating 
                    ? "text-amber-500 fill-amber-500" 
                    : "text-muted border-none"
                } transition-colors`} 
              />
            </button>
          ))}
        </div>

        <div className="space-y-4 text-left">
          <label className="text-xs font-black uppercase ml-1 text-muted-foreground">
            Conte mais sobre o cliente (opcional)
          </label>
          <Textarea 
            placeholder="Ex: O cliente foi educado? O local estava pronto para o serviço? Recomenda para outros?"
            className="rounded-3xl min-h-[140px] border-primary/10 focus:border-primary transition-all p-4"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="pt-4 space-y-4">
          <Button 
            className="w-full h-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 transition-all active:scale-95" 
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? "ENVIANDO..." : "FINALIZAR AVALIAÇÃO"}
          </Button>
          
          <button 
            onClick={() => navigate('/provider-dashboard')}
            className="text-xs font-bold text-muted-foreground uppercase hover:text-primary transition-colors"
          >
            Pular avaliação por enquanto
          </button>
        </div>

        {/* Rodapé de segurança */}
        <div className="flex items-center justify-center gap-2 pt-8 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          <AlertCircle size={12} />
          <span>Comunidade Segura Maricá</span>
        </div>
      </main>
    </div>
  );
};

export default ClientReview;    