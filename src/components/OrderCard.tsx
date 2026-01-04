import { Calendar, Clock, MapPin, MessageCircle, Home, Leaf, XCircle, Navigation, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceOrder } from '@/contexts/AppContext'; 

interface OrderCardProps {
  order: ServiceOrder;
  showActions?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  providerPhone?: string;
  clientPhone?: string;
}

// MAPEAMENTO COMPLETO - Se faltar algum aqui, o sistema pode exibir "Cancelado" por erro
const statusConfig: Record<string, { label: string, class: string }> = {
  pending: { label: 'Aguardando', class: 'bg-amber-100 text-amber-700 border-amber-200' },
  accepted: { label: 'Aceito', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  arrived: { label: 'No Local 📍', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  in_progress: { label: 'Em Realização ⚡', class: 'bg-green-100 text-green-700 border-green-200' },
  waiting_confirmation: { label: 'Finalizado', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  completed: { label: 'Concluído ✅', class: 'bg-slate-100 text-slate-700 border-slate-200' },
  cancelled: { label: 'Cancelado', class: 'bg-red-100 text-red-700 border-red-200' },
};

export function OrderCard({
  order,
  showActions,
  onAccept,
  onReject,
  providerPhone,
  clientPhone,
}: OrderCardProps) {
  
  // LOGICA DE SEGURANÇA: Se o status vindo do banco não existir no nosso objeto, 
  // ele mostra o nome do status original para não confundir com cancelado.
  const currentStatus = order.status || 'pending';
  const statusInfo = statusConfig[currentStatus] || { 
    label: currentStatus, 
    class: 'bg-gray-100 text-gray-700 border-gray-200' 
  };
  
  const ServiceIcon = order.service_type === 'domestica' ? Home : Leaf;
  const contactPhone = providerPhone || clientPhone || order.cliente_telefone;

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const whatsappUrl = contactPhone
    ? `https://wa.me/55${contactPhone.replace(/\D/g, '')}?text=Olá! Sobre o agendamento no LARTOP para o dia ${formatDate(order.date)}...`
    : null;

  return (
    <div className="card-service animate-slide-up border border-border/50 bg-card p-4 rounded-3xl shadow-sm mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              order.service_type === 'domestica' ? 'bg-primary/10' : 'bg-secondary/10'
            }`}
          >
            <ServiceIcon
              className={`w-6 h-6 ${
                order.service_type === 'domestica' ? 'text-primary' : 'text-secondary'
              }`}
            />
          </div>
          <div>
            <h3 className="font-bold text-foreground capitalize leading-tight">
              {order.service_type === 'domestica' ? 'Doméstica' : 'Limpeza de Quintal'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {order.cliente_nome || order.provider_nome || 'Usuário Lartop'}
            </p>
          </div>
        </div>
        
        {/* BADGE DE STATUS ATUALIZADA */}
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${statusInfo.class}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0 text-primary" />
          <span className="text-sm truncate font-medium">{order.address}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">{formatDate(order.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">{order.time}</span>
          </div>
        </div>
      </div>

      {Number(order.price) > 0 && (
        <div className="mt-3 flex justify-between items-center bg-muted/30 p-2 px-3 rounded-xl border border-dashed">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Valor do Serviço</span>
          <span className="font-black text-primary">R$ {Number(order.price).toFixed(2)}</span>
        </div>
      )}

      {/* Ações Pendentes */}
      {showActions && currentStatus === 'pending' && (
        <div className="mt-4 flex gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-destructive text-destructive rounded-xl font-bold"
            onClick={onReject}
          >
            Recusar
          </Button>
          <Button variant="default" size="sm" className="flex-1 bg-primary rounded-xl font-bold" onClick={onAccept}>
            Aceitar
          </Button>
        </div>
      )}

      {/* WhatsApp Visível apenas se NÃO estiver cancelado ou pendente */}
      {!['cancelled', 'pending'].includes(currentStatus) && whatsappUrl && (
        <div className="mt-4">
          <Button
            variant="default"
            size="sm"
            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-bold"
            onClick={() => window.open(whatsappUrl, '_blank')}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Contatar via WhatsApp
          </Button>
        </div>
      )}
      
      {/* Visual de Cancelamento REAL */}
      {currentStatus === 'cancelled' && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-[10px] font-bold justify-center bg-red-50 py-2 rounded-xl border border-red-100 uppercase">
          <XCircle className="w-3 h-3" />
          <span>Agendamento Cancelado</span>
        </div>
      )}
    </div>
  );
}