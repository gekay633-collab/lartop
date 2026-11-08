import { Resend } from 'resend';

// Somente a origem oficial deve receber URLs de recuperação. O endereço
// temporário conhecido é usado até a configuração do domínio próprio.
const ORIGEM_TEMPORARIA = 'https://lartop-ats6.vercel.app';

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caractere] ?? caractere);
}

export function gerarLinkRecuperacao(usuarioId: string, token: string): string {
  const base = process.env.FRONTEND_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? ORIGEM_TEMPORARIA : 'http://localhost:3000');
  const origem = new URL(base);
  if (origem.username || origem.password || origem.search || origem.hash ||
      (process.env.NODE_ENV === 'production' && origem.protocol !== 'https:') ||
      (origem.protocol !== 'https:' && origem.protocol !== 'http:')) {
    throw new Error('URL oficial da aplicação inválida para recuperação de senha');
  }
  const link = new URL('/redefinir-senha', origem);
  link.searchParams.set('token', token);
  link.searchParams.set('id', usuarioId);
  return link.toString();
}

export async function enviarEmailRecuperacaoSenha(destinatario: string, nome: string, link: string) {
  const remetente = process.env.EMAIL_REMETENTE?.trim();
  if (!remetente || !process.env.RESEND_API_KEY) {
    throw new Error('Envio de e-mail não configurado');
  }

  const cliente = new Resend(process.env.RESEND_API_KEY);
  const nomeSeguro = escaparHtml(nome);
  const linkSeguro = escaparHtml(link);

  // Resend devolve { data, error } em falhas HTTP; Promise resolvida
  // não significa que o e-mail tenha sido aceito.
  const resposta = await cliente.emails.send({
    from: remetente,
    to: destinatario,
    subject: 'Recupere sua senha na Lartop',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1F3524;">Recupere sua senha</h2>
        <p>Olá, ${nomeSeguro}!</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta na Lartop.</p>
        <p style="text-align:center; margin:32px 0;">
          <a href="${linkSeguro}" style="background:#6FA33B; color:#F7F9F1; padding:12px 24px; border-radius:8px;">
            Redefinir senha
          </a>
        </p>
        <p style="color:#666; font-size:14px;">O link expira em 1 hora. Se você não pediu essa alteração, ignore este e-mail.</p>
      </div>
    `,
    text: `Olá, ${nome}!\n\nRecupere sua senha pelo link: ${link}\n\nO link expira em 1 hora. Se não solicitou a alteração, ignore este e-mail.`,
  });
  if (resposta.error || !resposta.data?.id) {
    // Não incluir link, token ou endereço de e-mail nos logs.
    throw new Error('O provedor de e-mail não confirmou o envio de recuperação');
  }
}
