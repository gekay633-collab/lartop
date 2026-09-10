import type { FastifyInstance } from 'fastify';
import { cloudinary } from '../../lib/cloudinary.js';

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/upload/assinatura', { preHandler: app.exigirAutenticacao }, async (request, reply) => {
    const timestamp = Math.round(Date.now() / 1000);
    const pasta = `lartop/${request.usuario!.id}`;

    const parametrosAssinados = {
      timestamp,
      folder: pasta,
      allowed_formats: 'jpg,jpeg,png,webp',
    };

    const assinatura = cloudinary.utils.api_sign_request(
      parametrosAssinados,
      process.env.CLOUDINARY_API_SECRET as string
    );

    return reply.send({
      timestamp,
      folder: pasta,
      allowedFormats: 'jpg,jpeg,png,webp',
      signature: assinatura,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  });
}
