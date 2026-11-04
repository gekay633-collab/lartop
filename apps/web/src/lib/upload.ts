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
  const resposta = await fetch("/api/upload/imagem", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": arquivo.type === "image/jpg" ? "image/jpeg" : arquivo.type,
    },
    body: arquivo,
  });
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
