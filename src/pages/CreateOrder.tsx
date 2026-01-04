import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { MapPin, Calendar, Clock, FileText, Star, Loader2 } from 'lucide-react';
import api from '@/api'; // Usando sua instância configurada do axios

const CreateOrder = () => {
  const navigate = useNavigate();
  const { providerId } = useParams();
  const { currentUser, selectedService } = useApp();

  const [provider, setProvider] = useState<any>(null);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isProcessing = useRef(false);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        // Busca os dados do prestador selecionado
        const response = await api.get(`/api/providers?id=${providerId}`);
        if (response.data && response.data.length > 0) {
          setProvider(response.data[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar prestador:", error);
        toast.error("Erro ao carregar dados do profissional.");
      }
    };
    if (providerId) fetchProvider();
  }, [providerId]);

  if (!currentUser) {
    navigate('/auth');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !date || !time) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (isProcessing.current) return;
    
    isProcessing.current = true;
    setIsSubmitting(true);

    // Payload ajustado para o novo SQL (service_orders)
    const payload = {
      user_id: currentUser.id,
      provider_id: Number(providerId),
      service_type: selectedService || provider?.nicho || 'Serviço Geral',
      description_request: description, // Nome da coluna no novo SQL
      photos_request: null, // Pode ser implementado no futuro
      date: date,
      time: time,
      price: Number(provider?.valor_base || 0),
      address: address
    };

    try {
      const response = await api.post('/api/orders', payload);

      if (response.status === 201 || response.status === 200) {
        toast.success('Solicitação enviada com sucesso! 🎉');
        
        // Limpeza e navegação
        setAddress('');
        setDate('');
        setTime('');
        
        // Redireciona para a lista de pedidos do cliente
        navigate('/my-orders'); 
      }
    } catch (error: any) {
      console.error("Erro ao criar pedido:", error.response?.data || error.message);
      toast.error(error.response?.data?.error || "Erro ao processar pedido.");
      
      isProcessing.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <Header showBack title="Novo Pedido" />

      <main className="max-w-lg mx-auto px-4 py-6">
        {!provider ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <>
            <div className="bg-card p-4 rounded-2xl border border-border mb-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted overflow-hidden flex-shrink-0">
                  {provider.foto_url ? (
                    <img src={provider.foto_url} className="w-full h-full object-cover" alt={provider.nome} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-primary bg-primary/10">
                      {provider.nome?.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{provider.nome}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                      <Star size={14} fill="currentColor" /> {Number(provider.rating || 5).toFixed(1)}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      Preço Base: R$ {Number(provider.valor_base).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <MapPin className="w-4 h-4 text-primary" /> Endereço Completo
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Rua, número, bairro..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Calendar className="w-4 h-4 text-primary" /> Data
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 rounded-xl border bg-background"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Clock className="w-4 h-4 text-primary" /> Horário
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full p-3 rounded-xl border bg-background"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <FileText className="w-4 h-4 text-primary" /> Descrição do Serviço
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-xl border bg-background min-h-[120px] resize-none focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Descreva o que precisa ser feito com detalhes..."
                />
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-4">
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider text-center">
                  O valor final pode ser negociado com o profissional após o envio.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 rounded-xl font-bold text-lg shadow-lg" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} /> Processando...
                  </div>
                ) : "Enviar Solicitação"}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default CreateOrder;