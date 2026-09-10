import { prisma } from '../../lib/prisma.js';

type TipoEvento = 'PESQUISA' | 'VISUALIZACAO_PERFIL' | 'CONTATO_GERADO';

export async function registrarEvento(input: {
  tipo: TipoEvento;
  cidadeId?: string;
  categoriaId?: string;
  profissionalId?: string;
}) {
  try {
    await prisma.eventoAnalytics.create({ data: input });
  } catch (err) {
    console.error('[evento] falha ao registrar evento:', err);
  }
}
