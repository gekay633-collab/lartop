import { fetchAutenticado } from "@/lib/auth-client";
const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // O servidor também aplica este limite.

export async function enviarImagem(arquivo: File, accessToken: string): Promise<string> {
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new Error("Formato não suportado. Use JPG, PNG ou WEBP.");
  }
  if (arquivo.size < 1 || arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("A imagem precisa ter entre 1 byte e 5 MB.");
  }

  // Não há mais assinatura Cloudinary no navegador. A API valida tamanho e conteúdo.
  const resposta = await fetchAutenticado("/api/upload/imagem", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": arquivo.type === "image/jpg" ? "image/jpeg" : arquivo.type,
    },
    body: arquivo,
  });
  if (resposta.status === 404) {
    // Compatibilidade transitória quando Vercel for atualizado antes do Railway.
    // A API antiga ainda oferece assinatura; só usar enquanto a rota nova não existir.
    return enviarImagemNoBackendAntigo(arquivo);
  }
  if (!resposta.ok) {
    const corpo: unknown = await resposta.json().catch(() => null);
    const erro = corpo && typeof corpo === "object" && "erro" in corpo &&
      typeof corpo.erro === "string" ? corpo.erro : null;
    if (resposta.status === 413) throw new Error("Imagem muito grande. O limite é 5 MB.");
    throw new Error(erro ?? "Não foi possível enviar a imagem.");
  }

  const dados: unknown = await resposta.json().catch(() => null);
  if (!dados || typeof dados !== "object" || !("url" in dados) ||
    typeof dados.url !== "string" || !dados.url.startsWith("https://")) {
    throw new Error("O servidor não confirmou o endereço seguro da imagem.");
  }
  return dados.url;
}


/**
 * Ponte temporária para o intervalo de implantação: frontend novo / API antiga.
 * Depois que todos os ambientes estiverem na API nova, remover este fallback.
 * Sempre respeita o limite local de 5MB validado por enviarImagem.
 */
async function enviarImagemNoBackendAntigo(arquivo: File): Promise<string> {
  const assinatura = await fetchAutenticado("/api/upload/assinatura", { method: "POST" });
  if (!assinatura.ok) {
    throw new Error("Não foi possível iniciar o envio. Atualize a página e tente novamente.");
  }
  const resultado: unknown = await assinatura.json().catch(() => null);
  if (!resultado || typeof resultado !== "object") {
    throw new Error("Resposta inválida do serviço de imagens.");
  }
  const campos = resultado as Record<string, unknown>;
  const { timestamp, folder, allowedFormats, signature, apiKey, cloudName } = campos;
  if (typeof timestamp !== "number" || typeof folder !== "string" ||
      typeof allowedFormats !== "string" || typeof signature !== "string" ||
      typeof apiKey !== "string" || typeof cloudName !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
    throw new Error("Assinatura de upload inválida.");
  }
  const dados = new FormData();
  dados.set("file", arquivo);
  dados.set("timestamp", String(timestamp));
  dados.set("folder", folder);
  dados.set("allowed_formats", allowedFormats);
  dados.set("signature", signature);
  dados.set("api_key", apiKey);
  const envio = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST", body: dados,
  });
  if (!envio.ok) throw new Error("Falha ao enviar a imagem. Tente novamente.");
  const upload: unknown = await envio.json().catch(() => null);
  if (!upload || typeof upload !== "object" || !("secure_url" in upload) ||
      typeof upload.secure_url !== "string" ||
      !upload.secure_url.startsWith("https://")) {
    throw new Error("O serviço não retornou uma imagem segura.");
  }
  return upload.secure_url;
}
