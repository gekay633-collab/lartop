const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB

export async function enviarImagem(arquivo: File, accessToken: string): Promise<string> {
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new Error("Formato de imagem nao suportado. Use JPG, PNG ou WEBP.");
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("Imagem muito grande. O tamanho maximo e 5MB.");
  }

  const respostaAssinatura = await fetch(`${API_URL}/api/upload/assinatura`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!respostaAssinatura.ok) {
    throw new Error("Nao foi possivel iniciar o upload");
  }

  const { timestamp, folder, allowedFormats, signature, apiKey, cloudName } = await respostaAssinatura.json();

  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  formData.append("allowed_formats", allowedFormats);
  formData.append("signature", signature);
  formData.append("api_key", apiKey);

  const respostaUpload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!respostaUpload.ok) {
    throw new Error("Falha ao enviar a imagem");
  }

  const dados = await respostaUpload.json();
  return dados.secure_url as string;
}
