import type { FastifyInstance } from 'fastify';
import { cloudinary } from '../../lib/cloudinary.js';
import { redis } from '../../lib/redis.js';

export const LIMITE_IMAGEM_BYTES = 5 * 1024 * 1024;
const FORMATOS_UPLOAD = ['image/jpeg', 'image/png', 'image/webp'] as const;

// A extensão e o Content-Type enviados pelo cliente não são provas do tipo real.
export function reconhecerImagem(buffer: Buffer): typeof FORMATOS_UPLOAD[number] | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const SCRIPT_LIMITE = `
  local quantidade = redis.call('INCR', KEYS[1])
  if quantidade == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
  return quantidade
`;

async function permitirUpload(usuarioId: string): Promise<boolean> {
  // Limita por conta (além do rate limit global por IP). Falhas no Redis recusam upload.
  const chave = `limite:upload:${usuarioId}:${Math.floor(Date.now() / 3600000)}`;
  const quantidade = Number(await redis.eval(SCRIPT_LIMITE, 1, chave, '3600'));
  return quantidade <= 40;
}

export async function uploadRoutes(app: FastifyInstance) {
  app.addContentTypeParser([...FORMATOS_UPLOAD], {
    parseAs: 'buffer', bodyLimit: LIMITE_IMAGEM_BYTES,
  }, (_request, corpo, done) => done(null, corpo));

  app.post('/upload/imagem', {
    preHandler: app.exigirAutenticacao,
    bodyLimit: LIMITE_IMAGEM_BYTES,
  }, async (request, reply) => {
    const corpo = request.body;
    if (!Buffer.isBuffer(corpo) || !corpo.length) {
      return reply.status(400).send({ erro: 'Imagem ausente ou inválida' });
    }
    const tipoDeclarado = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    const tipoReal = reconhecerImagem(corpo);
    if (!tipoReal || tipoReal !== tipoDeclarado) {
      return reply.status(400).send({ erro: 'O conteúdo não corresponde a uma imagem JPG, PNG ou WEBP válida' });
    }

    try {
      if (!(await permitirUpload(request.usuario!.id))) {
        return reply.status(429).send({ erro: 'Limite de uploads atingido. Tente novamente em uma hora.' });
      }
      const arquivo = `data:${tipoReal};base64,${corpo.toString('base64')}`;
      const resultado = await cloudinary.uploader.upload(arquivo, {
        resource_type: 'image',
        folder: `lartop/${request.usuario!.id}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        overwrite: false,
        unique_filename: true,
      });
      if (!resultado.secure_url?.startsWith('https://')) {
        throw new Error('Cloudinary não retornou URL segura');
      }
      return reply.status(201).send({ url: resultado.secure_url });
    } catch (erro) {
      request.log.error({ causa: erro instanceof Error ? erro.name : 'desconhecida' }, 'Falha no upload');
      return reply.status(502).send({ erro: 'Não foi possível enviar a imagem. Tente novamente.' });
    }
  });

  // Compatibilidade para uma publicação em duas etapas: primeiro API, depois web.
  // Desligar após validar o novo frontend. Sem a flag, a API deixa de emitir assinaturas diretas.
  app.post('/upload/assinatura', { preHandler: app.exigirAutenticacao }, async (request, reply) => {
    if (process.env.UPLOAD_ASSINATURA_LEGADO !== 'true') {
      return reply.status(410).send({ erro: 'Atualize o site para enviar novas imagens' });
    }
    try {
      if (!(await permitirUpload(request.usuario!.id))) {
        return reply.status(429).send({ erro: 'Limite de uploads atingido. Tente novamente em uma hora.' });
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `lartop/${request.usuario!.id}`;
      const parametrosAssinados = { timestamp, folder, allowed_formats: 'jpg,jpeg,png,webp' };
      const assinatura = cloudinary.utils.api_sign_request(
        parametrosAssinados, process.env.CLOUDINARY_API_SECRET as string
      );
      return reply.send({
        timestamp, folder, allowedFormats: 'jpg,jpeg,png,webp',
        signature: assinatura, apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    } catch {
      return reply.status(503).send({ erro: 'Não foi possível iniciar o upload' });
    }
  });
}
