import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useApp } from '@/contexts/AppContext';
import api from '@/api';
import { toast } from 'sonner';
import { MapPin, Clock, Calendar as CalendarIcon, Loader2, AlertCircle, Camera, FileText, X, Info, CheckCircle2 } from 'lucide-react';

const Booking = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState(''); 
  const [address, setAddress] = useState(currentUser?.endereco || '');
  const [description, setDescription] = useState('');
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [fetchingProvider, setFetchingProvider] = useState(true);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);

  const shifts = [
    { label: "Período da Manhã", sub: "Início às 08:00", value: "08:00" },
    { label: "Período da Tarde", sub: "Início às 14:00", value: "14:00" }
  ];

  // 1. Carrega dados do prestador
  useEffect(() => {
    const fetchProvider = async () => {
      if (!providerId) {
        setFetchingProvider(false);
        return;
      }
      try {
        setFetchingProvider(true);
        // Busca via api.ts que já faz o join correto
        const res = await api.get(`/api/providers?id=${providerId}`);
        if (res.data && res.data.length > 0) {
          setProvider(res.data[0]);
        } else {
          toast.error("Prestador não encontrado.");
        }
      } catch (err) {
        console.error("Erro ao buscar prestador:", err);
      } finally {
        setFetchingProvider(false);
      }
    };
    fetchProvider();
  }, [providerId]);

  // 2. Checa horários ocupados (Sincronizado com as regras do Lartop)
  useEffect(() => {
    const checkBookedSlots = async () => {
      if (!date || !providerId) return;
      
      try {
        const formattedDate = date.toISOString().split('T')[0];
        // Busca pedidos do prestador via Supabase (definido no api.ts)
        const res = await api.get(`/api/service_orders?provider_id=eq.${providerId}`);
        
        const dayOrders = res.data.filter((order: any) => {
          return order.date === formattedDate && 
                 ['pending', 'accepted', 'in_progress', 'waiting_confirmation'].includes(order.status);
        });
        
        // Normaliza o formato da hora para bater com o shifts.value
        setOccupiedSlots(dayOrders.map((o: any) => o.time.substring(0, 5)));
      } catch (err) {
        console.error("Erro ao checar horários ocupados", err);
      }
    };
    checkBookedSlots();
  }, [date, providerId]);

  const getDayName = (selectedDate: Date) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[selectedDate.getDay()];
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (photos.length + files.length > 3) {
      toast.error("Limite máximo de 3 fotos atingido.");
      return;
    }
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = ''; 
  };

  // 3. LOGICA DE ENVIO REFINADA
  const handleConfirmBooking = async () => {
    if (!currentUser) {
      toast.error("Acesse sua conta para agendar.");
      return;
    }

    if (!date || !time || !address || !description) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    // Validação de dias de trabalho do prestador
    if (provider?.working_days) {
      const chosenDay = getDayName(date);
      const allowedDays = provider.working_days.split(',').map((d: string) => d.trim());
      if (!allowedDays.includes(chosenDay)) {
        toast.error(`Este profissional não atende aos ${chosenDay}s.`);
        return; 
      }
    }

    try {
      setLoading(true);

      const formattedDate = date.toISOString().split('T')[0];

      const bookingData = {
        user_id: Number(currentUser.id),
        provider_id: Number(providerId),
        service_type: provider?.nicho || 'Geral',
        date: formattedDate,
        time: time,
        address: address,
        description_request: description,
        // Enviamos o array puro, o api.ts ou o Backend cuidam do JSON.stringify
        photos_request: photos, 
        price: Number(provider?.valor_base) || 0,
        status: 'pending'
      };

      // O api.post('/api/orders') agora vai para o NODE (ajustado no seu api.ts)
      await api.post('/api/orders', bookingData);
      
      toast.success("Solicitação enviada com sucesso!");
      navigate('/my-orders'); 
      
    } catch (error: any) {
      console.error("Erro no agendamento Lartop:", error);
      toast.error("Erro ao processar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const isShiftPassed = (shiftValue: string) => {
    const now = new Date();
    if (!date || date.toDateString() !== now.toDateString()) return false;
    const [hours] = shiftValue.split(':').map(Number);
    const shiftTime = new Date();
    shiftTime.setHours(hours, 0, 0, 0);
    return shiftTime <= now;
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <Header title="Solicitar Orçamento" showBack />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        
        {/* Card do Prestador */}
        <section className="bg-primary/5 border border-primary/20 rounded-[2rem] p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-black text-lg uppercase tracking-tighter text-foreground italic">
              {fetchingProvider ? "Carregando..." : provider?.nome}
            </h2>
            <div className="bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} /> VERIFICADO
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-2 uppercase italic">
            <Info size={14} className="text-primary" />
            Trabalhos de ~3h a 4h por turno.
          </p>
        </section>

        {/* 1. Calendário */}
        <section className="space-y-3">
          <h3 className="font-black text-xs uppercase flex items-center gap-2 text-foreground tracking-widest">
            <CalendarIcon size={18} className="text-primary"/> 1. Escolha o dia
          </h3>
          <div className="bg-card border-2 rounded-[2rem] p-4 flex justify-center shadow-sm border-primary/10">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => { setDate(newDate); setTime(''); }}
              disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
            />
          </div>
        </section>

        {/* 2. Turnos */}
        <section className="space-y-4">
          <h3 className="font-black text-xs uppercase flex items-center gap-2 text-foreground tracking-widest">
            <Clock size={18} className="text-primary"/> 2. Período Disponível
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            {shifts.map((shift) => {
              const isOccupied = occupiedSlots.includes(shift.value);
              const isPassed = isShiftPassed(shift.value);
              const isBlocked = isOccupied || isPassed;

              return (
                <Button
                  key={shift.value}
                  variant={time === shift.value ? "default" : "outline"}
                  onClick={() => !isBlocked && setTime(shift.value)}
                  disabled={isBlocked}
                  className={`w-full h-20 rounded-2xl flex flex-col items-start px-6 transition-all border-2
                    ${time === shift.value ? 'bg-primary border-primary scale-[1.01]' : 'bg-card border-border'}
                    ${isBlocked ? 'opacity-50 grayscale bg-slate-50' : 'hover:border-primary'}
                  `}
                >
                  <div className="flex justify-between w-full items-center">
                    <div className="text-left">
                      <p className="font-black text-lg uppercase italic">{shift.label}</p>
                      <p className={`text-[10px] font-bold uppercase ${time === shift.value ? 'text-white/80' : 'text-muted-foreground'}`}>{shift.sub}</p>
                    </div>

                    {isOccupied ? (
                      <div className="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <AlertCircle size={12} /> OCUPADO
                      </div>
                    ) : isPassed ? (
                      <div className="bg-orange-100 text-orange-600 text-[10px] font-bold px-3 py-1.5 rounded-lg">EXPIRADO</div>
                    ) : (
                      <div className={`text-[10px] font-bold px-3 py-1.5 rounded-lg ${time === shift.value ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>LIVRE</div>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </section>

        {/* 3. Descrição */}
        <section className="space-y-3">
          <h3 className="font-black text-xs uppercase flex items-center gap-2 text-foreground tracking-widest">
            <FileText size={18} className="text-primary"/> 3. Descrição do Serviço
          </h3>
          <textarea
            className="w-full bg-card border-2 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none min-h-[100px] text-foreground resize-none transition-all"
            placeholder="Detalhe o que precisa ser feito..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>

        {/* 4. Fotos */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs uppercase flex items-center gap-2 text-foreground tracking-widest">
              <Camera size={18} className="text-primary"/> 4. Fotos (Opcional)
            </h3>
            <span className="text-[10px] font-black text-muted-foreground uppercase">{photos.length} / 3</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {photos.map((src, index) => (
              <div key={index} className="relative w-24 h-24">
                <img src={src} alt="Preview" className="w-full h-full object-cover rounded-2xl border-2 border-primary shadow-sm" />
                <button 
                  onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-lg"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-2xl flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-accent transition-all"
              >
                <Camera size={24} />
                <span className="text-[10px] mt-1 font-black uppercase">Adicionar</span>
              </div>
            )}
            <input type="file" accept="image/*" hidden multiple ref={fileInputRef} onChange={handlePhotoChange} />
          </div>
        </section>

        {/* 5. Endereço */}
        <section className="space-y-3">
          <h3 className="font-black text-xs uppercase flex items-center gap-2 text-foreground tracking-widest">
            <MapPin size={18} className="text-primary"/> 5. Endereço do Serviço
          </h3>
          <textarea
            className="w-full bg-card border-2 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none min-h-[80px] text-foreground resize-none transition-all"
            placeholder="Rua, número, bairro..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </section>

        <Button 
          onClick={handleConfirmBooking}
          disabled={loading || fetchingProvider || !time}
          className="w-full h-20 bg-primary text-white font-black text-xl rounded-[2rem] shadow-xl active:scale-95 transition-transform italic uppercase tracking-tighter"
        >
          {loading ? <Loader2 className="animate-spin" /> : "SOLICITAR ORÇAMENTO"}
        </Button>
      </main>
    </div>
  );
};

export default Booking;