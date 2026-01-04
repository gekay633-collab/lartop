import { Home, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceType } from '@/types';

interface ServiceCardProps {
  type: ServiceType;
  onClick: () => void;
}

const serviceConfig = {
  domestica: {
    icon: Home,
    title: 'Doméstica / Diarista',
    description: 'Limpeza completa da sua casa com profissionais de confiança',
    color: 'primary',
  },
  quintal: {
    icon: Leaf,
    title: 'Limpeza de Quintal',
    description: 'Corte de grama, poda e limpeza de áreas externas',
    color: 'secondary',
  },
};

export function ServiceCard({ type, onClick }: ServiceCardProps) {
  const config = serviceConfig[type];
  const Icon = config.icon;
  const isPrimary = config.color === 'primary';

  return (
    <Button
      variant="service"
      className="w-full h-auto flex-col gap-4 p-8 animate-slide-up"
      onClick={onClick}
      style={{ animationDelay: type === 'quintal' ? '0.1s' : '0s' }}
    >
      <div
        className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
          isPrimary ? 'bg-primary/10' : 'bg-secondary/10'
        }`}
      >
        <Icon
          className={`w-10 h-10 ${isPrimary ? 'text-primary' : 'text-secondary'}`}
        />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-foreground">{config.title}</h3>
        <p className="text-muted-foreground text-sm font-normal">
          {config.description}
        </p>
      </div>
    </Button>
  );
}
