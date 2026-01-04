import { Star, MapPin, Briefcase, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Provider } from '@/types';

interface ProviderCardProps {
  provider: Provider;
  onSelect: () => void;
}

export function ProviderCard({ provider, onSelect }: ProviderCardProps) {
  const navigate = useNavigate();

  // Mapeamento extra-seguro dos dados (MySQL vs Mock)
  const p = provider as any;
  const id = p.id || p.user_id; 
  const name = p.nome || p.name || "Profissional";
  const phone = p.telefone || p.phone || "";
  const rating = p.rating || 5.0;
  const basePrice = p.valor_base || p.basePrice || 0;
  const city = p.cidade || p.serviceArea || "Cidade não informada";
  const photo = p.foto_url || null;

  // Função de navegação principal
  const handleViewDetails = (e: React.MouseEvent) => {
    // IMPORTANTE: Impede que o clique se perca em outros elementos
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Card clicado! ID do prestador:", id);

    if (id) {
      navigate(`/provider/${id}`);
    } else {
      alert("Erro: ID do prestador não encontrado. Verifique o console.");
      console.error("Dados do prestador recebidos:", p);
    }
  };

  return (
    <div 
      className="bg-card group border border-border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md rounded-3xl p-4 cursor-pointer relative overflow-hidden"
      onClick={handleViewDetails}
    >
      <div className="flex items-start gap-4">
        {/* Foto ou Inicial */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden shrink-0 pointer-events-none">
          {photo ? (
            <img src={photo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span>{name.charAt(0)}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 pointer-events-none">
          <h3 className="text-lg font-bold text-foreground truncate group-hover:text-primary transition-colors">
            {name}
          </h3>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-semibold text-foreground">
              {Number(rating).toFixed(1)}
            </span>
          </div>
        </div>

        <div className="text-right pointer-events-none">
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Diária</p>
          <p className="text-lg font-black text-primary">
            R$ {Number(basePrice).toFixed(0)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-muted-foreground pointer-events-none">
        <MapPin className="w-4 h-4 shrink-0 text-primary" />
        <span className="text-xs truncate font-medium">{city}</span>
      </div>

      <div className="mt-4 flex gap-3 relative z-10">
        {/* Botão Ver Perfil (Reforço do clique) */}
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-xl border-primary/20 hover:bg-primary/5 text-xs font-bold h-10"
          onClick={handleViewDetails}
        >
          Ver Perfil
        </Button>

        {/* Botão Contratar (Fluxo direto) */}
        <Button 
          variant="default" 
          size="sm" 
          className="flex-1 rounded-xl font-bold shadow-sm text-xs h-10" 
          onClick={(e) => {
            e.stopPropagation(); // Não abre o perfil ao clicar em contratar
            onSelect();
          }}
        >
          <Briefcase className="w-4 h-4 mr-1" />
          Contratar
        </Button>
      </div>

      {/* WhatsApp Link */}
      <div className="mt-3 text-center relative z-10">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://wa.me/${phone}`, '_blank');
          }}
          className="text-[10px] font-black text-green-600 hover:text-green-700 uppercase tracking-tighter flex items-center justify-center gap-1 w-full"
        >
          <MessageCircle className="w-3 h-3" />
          Chamar no WhatsApp
        </button>
      </div>
    </div>
  );
}