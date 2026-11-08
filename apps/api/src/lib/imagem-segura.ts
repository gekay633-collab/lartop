/**
 * Imagens visíveis ao público devem vir do Cloudinary configurado pelo Lartop.
 * Evita que um prestador cadastre uma URL arbitrária usada para rastrear os
 * visitantes do seu perfil, ou links remotos maliciosos.
 */
export function imagemDaContaLartop(valor: string): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName)) return false;
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        url.username || url.password || url.port ||
        url.search || url.hash) return false;

    return url.pathname.startsWith(`/${cloudName}/image/upload/`) &&
      url.pathname.length > `/${cloudName}/image/upload/`.length;
  } catch {
    return false;
  }
}
