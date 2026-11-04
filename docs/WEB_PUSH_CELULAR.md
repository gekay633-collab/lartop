# Alertas Web Push no celular — Etapa B

## Por que esta etapa existe
A central de notificações criada na etapa A é consultada apenas com o site
aberto. Esta etapa adiciona notificações Web Push que **podem chegar
enquanto o Lartop está fechado**.

## Jornada do usuário

- O prestador entra em **Meu painel** e toca em **Ativar alertas no celular**.
- O cliente faz a mesma configuração em **Minhas solicitações**.
- O navegador solicita permissão; sem consentimento explícito não há inscrição.
- Uma inscrição vinculada à conta é gravada em `assinaturas_push` no Supabase.
- Novo serviço: o prestador recebe push após o pedido ser confirmado.
- Aceite, recusa, resposta e conclusão: o cliente recebe push.
- Cancelamento: o prestador recebe push.
- O alerta abre o painel correspondente. **Jamais aceita/recusa serviço pelo próprio push.**
- O menu de desativação e o logout removem a inscrição do aparelho.

## Compatibilidade e limites

- Android: navegadores atualizados compatíveis com Push API.
- iPhone/iPad (iOS/iPadOS 16.4+): instalar Lartop pela opção
  **Adicionar à Tela de Início**, abri-lo pelo ícone e permitir notificações.
- Som/vibração são gerenciados pelo sistema operacional. O servidor
  não pode obrigar um aparelho a emitir som, sobretudo em modo silencioso,
  Não Perturbe ou sem permissão.
- Web Push depende da rede e do serviço push do navegador: entrega e horário
  não são garantidos. Em caso de falha, a notificação interna permanece.
- Entrega é tentada **depois** de a operação no banco ter sido confirmada;
  erro de envio não desfaz pedido. Esta versão não possui fila de reenvio.

## Privacidade e proteção
- A inscrição contém endpoint e chaves criptográficas **do dispositivo**,
  armazenadas no Supabase, nunca incluídas no HTML da página.
- A tabela tem RLS ativado e privilégios revogados para anon/authenticated.
- As APIs de inscrição são autenticadas e bloqueiam contas inativas.
- Até cinco dispositivos por usuário.
- Destinos dos servidores push são limitados por allowlist HTTPS para
  reduzir risco de SSRF.
- A **chave VAPID privada** fica somente nas variáveis do Railway,
  nunca no repositório. Apenas a chave pública é retornada ao cliente.

## Preparação da produção (ordem obrigatória)

1. Revisar CI e validar builds e testes de integração.
2. Criar a tabela `assinaturas_push` e verificar RLS/permissões no Supabase.
   O projeto de teste não tem a tabela de histórico Prisma
   `_prisma_migrations`; portanto **não rodar todo o migrate deploy**.
3. Criar um **único par de chaves VAPID** seguro. Configurar no Railway:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
   Nunca regenerar chaves depois de inscrever usuários, a menos que aceite
   a necessidade de reativar notificações nos dispositivos.
4. Só então fazer merge na main (deploy automático Railway e Vercel).
5. Testar autorização, ativação e revogação com contas de teste.
6. Fazer teste real em Android e iPhone com o site fechado. Sem dispositivo
   inscrito, não é possível confirmar entrega nem som fisicamente.

## Reversão

Reverter o código da API e do frontend. Manter a tabela e inscrições
para possível retorno; não apagar dados sem necessidade.
