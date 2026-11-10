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

/**
 * O Cloudinary é público para leitura, mas uma URL pública não prova posse.
 * Uploads novos são salvos exclusivamente pelo backend em lartop/<usuarioId>
 * e o uploader retorna links canônicos SEM transformações.
 *
 * Não modificar as fotos já persistidas: a checagem vale somente para novas
 * referências vinculadas por clientes/prestadores.
 */
export function imagemPertenceAoUsuario(valor: string, usuarioId: string): boolean {
  if (!imagemDaContaLartop(valor) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(usuarioId)) {
    return false;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
  const caminho = new URL(valor).pathname;
  const prefixo = `/${cloudName}/image/upload/`;
  const relativa = caminho.slice(prefixo.length);
  // Exige URL original do uploader: v<versão>/lartop/<conta>/<arquivo>.
  // Proíbe transformações, pastas de terceiros, %2F, query e dot segments.
  const match = /^v[0-9]+\/lartop\/([0-9a-f-]{36})\/([a-zA-Z0-9_-]+)\.(jpe?g|png|webp)$/i.exec(relativa);
  return !!match && match[1].toLowerCase() === usuarioId.toLowerCase();
}
