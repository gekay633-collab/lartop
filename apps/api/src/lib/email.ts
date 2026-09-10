import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function enviarEmailRecuperacaoSenha(destinatario: string, nome: string, link: string) {
  await resend.emails.send({
    from: process.env.EMAIL_REMETENTE as string,
    to: destinatario,
    subject: 'Recupere sua senha na Lartop',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1F3524;">Recupere sua senha</h2>
        <p>Ola, ${nome}!</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta na Lartop. Clique no botao abaixo para criar uma nova senha:</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${link}" style="background: #6FA33B; color: #F7F9F1; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Redefinir senha
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Esse link expira em 1 hora. Se voce nao pediu essa alteracao, pode ignorar este e-mail com seguranca.</p>
      </div>
    `,
  });
}
