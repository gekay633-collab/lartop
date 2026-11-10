# Lartop — domínio próprio e migração futura de hospedagem

**Preparado em 10/11/2026. Domínio confirmado pelo proprietário: `lartop.app.br`, comprado no Registro.br.** Este guia não ativa o domínio por si só. **Não publicar novas URLs nem editar DNS no escuro.**

## Objetivo e arquitetura
- **Agora:** `https://lartop.app.br` → Vercel/Next.js; navegador usa **sempre** caminhos relativos `/api/*` e `/bff/auth/*`. Next.js valida CSRF, lê cookies HttpOnly e encaminha a chamada servidor-servidor para Fastify no Railway.
- **Depois:** `https://lartop.app.br` → novo servidor/reverse proxy com Next.js (ou Vercel durante a migração); Fastify poderá mudar de Railway para outro host sem alterar o endereço público.
- **DNS fica com o registrador ou provedor DNS independente**, se possível. Evitar mover nameservers para Vercel apenas para colocar o site no ar: manter DNS portátil simplifica a troca de infraestrutura.
- Um único domínio canônico: escolher raiz (`lartop.app.br`) ou `www.lartop.app.br` e redirecionar o outro via Vercel, sem duplicar cookies e SEO. Não é necessário expor uma API pública em `api.lartop.app.br` agora.

## Valores escolhidos para a virada
- URL canônica: **`https://lartop.app.br`**.
- Redirecionamento secundário: **`https://www.lartop.app.br` → `https://lartop.app.br`**.
- DNS: manter no **Registro.br**, sem mudar nameservers por conveniência.
- Sistema atual continua em Vercel para frontend e Railway para backend.
- Registros de DNS da Vercel devem ser obtidos em **Settings → Domains** deste projeto; não supor IP ou CNAME genérico.

## Fase A — conectar ao projeto Vercel existente
1. Confirmado domínio `lartop.app.br` no Registro.br; verificar se a zona DNS é gerenciada no próprio Registro.br. Guardar a zona DNS atual (A, AAAA, CNAME, MX, TXT, SPF, DKIM, DMARC, CAA) antes de editar; **não remover registros de e-mail**.
2. Vercel → projeto do Lartop → **Settings → Domains** → adicionar raiz e `www`, escolhendo qual é o principal; configurar redirecionamento do secundário ao canônico.
3. Usar **apenas os valores A/CNAME/TXT indicados pela Vercel para este projeto** (os valores podem variar por conta). No registrador, remover registros conflitantes **somente para os hosts alterados**, não alterar MX/TXT de e-mail por engano.
4. Aguardar confirmação DNS e certificado SSL automático; validar `https://lartop.app.br`, `https://www.lartop.app.br`, redirecionamento, HTTPS, HSTS, CSP e nenhuma origem inesperada.
5. Até validar tudo, manter `https://lartop-ats6.vercel.app` funcionando para acesso e recuperação de senha antigos.

## Fase B — trocar as origens oficiais com segurança
**Configurar depois de confirmar HTTPS do domínio canônico**:
- Railway (serviço **lartop**, produção):
  - `FRONTEND_URL=https://lartop.app.br` — **essencial**: o backend monta links de recuperação de senha a partir desta variável; atualmente há fallback para `https://lartop-ats6.vercel.app`.
  - `CORS_ORIGIN=https://lartop.app.br` — somente origem HTTPS autorizada, sem `*`; chamadas do navegador continuam via BFF na mesma origem, não diretamente ao Railway. Conferir necessidades de preview separadamente.
  - `VAPID_SUBJECT=https://lartop.app.br` — identificador de contato do remetente Push; **não trocar VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY** durante migração.
  - `EMAIL_REMETENTE` — só mudar após validar DNS/domínio no Resend (SPF/DKIM e demais requisitos do provedor). Nunca copiar chaves de API para o frontend.
- Vercel (projeto web, produção):
  - `API_BACKEND_URL` é **apenas do servidor Next.js** e pode permanecer como endereço do Railway enquanto a API estiver lá. Não criar `NEXT_PUBLIC_API_BACKEND_URL`, não expor banco, Redis nem JWT ao navegador.
  - Evitar hardcode de `lartop.app.br` nas páginas ou bundle client. O PWA usa `manifest.id='/'`, `start_url='/'` e links relativos, adequados para mudança de host.
  - Variáveis alteradas na Vercel só entram no ar com um **novo deployment**.
- Atenção: nunca criar rewrites Vercel `/api/*` diretamente para Railway — **contornam o BFF, cookies HttpOnly e as verificações CSRF** já existentes.

## Teste obrigatório da virada
1. Site responde no domínio novo com TLS válido; raiz/`www` redirecionam corretamente.
2. Criar conta de testes, login, refresh, logout, recuperação de senha — links do e-mail apontam para o domínio novo. Não usar dados reais nas capturas.
3. Cliente busca prestador, envia pedido; profissional recebe, aceita/recusa; cliente recebe atualização; verificar imagem/WhatsApp.
4. Testar PWA em Android: **domínio novo é outra origem**. Cookies, service worker e assinaturas Web Push não se transferem automaticamente. Cada usuário precisará entrar novamente, instalar novo atalho se desejado e **reativar notificações** nesse novo domínio.
5. Testar Android com tela bloqueada. Monitorar 401/403/404/429/5xx e falhas de Push no Railway.
6. Testar links antigos compartilhados; manter o domínio `vercel.app` como fallback enquanto necessário. Não redirecionar `/api` indiscriminadamente e não perder caminhos `/.well-known` se usados em validação TLS.

## Fase C — migração futura para hospedagem paga própria
1. Preparar novo host com **HTTPS antes de mudar o DNS**, certificados, backups testados, healthcheck e mesma versão de Next/Fastify. Não migrar banco junto se não for necessário.
2. Importar segredos via variáveis do novo host, nunca via Git; proteger cookies `__Host-`, CORS, CSP, HSTS, renovação de token e reverse proxy.
3. Manter tráfego do navegador na origem oficial e o BFF Next.js. Se frontend e API ficarem em servidores distintos, o BFF continua sendo proxy servidor-servidor. O servidor web não deve repassar `/api/*` diretamente à API em substituição ao BFF.
4. Reduzir TTL de DNS na véspera quando possível, validar instalação paralela com host de homologação e depois apontar A/AAAA/CNAME para o novo servidor, **sem alterar a URL oficial**.
5. Manter Vercel de reserva até tráfego, sessão e Push estarem testados. Plano de retorno: reverter registros DNS para Vercel, sem reverter DB às cegas. Rever renovações TLS e HSTS (`max-age=31536000`).

## Itens já verificados no código em 10/11/2026
- `apps/web/src/app/api/[...path]/route.ts`, `apps/web/src/app/bff/auth/[...path]/route.ts` e `apps/web/src/lib/api.ts`: usam `API_BACKEND_URL` do lado servidor, com fallback temporário Railway.
- `apps/web/src/lib/seguranca-bff.ts`: cookies access com prefixo `__Host-` em HTTPS, proteção por origem da requisição; nova origem tem sessões próprias.
- `apps/api/src/lib/email.ts`: `FRONTEND_URL` tem fallback antigo e **precisa ser configurada** ao usar o domínio novo.
- `apps/api/src/plugins/seguranca.ts`: `CORS_ORIGIN` restringe origem; no Railway a variável não apareceu entre os nomes configurados, portanto a configuração padrão de desenvolvimento pode estar ativa. Definir origem canônica quando adicionar domínio.
- `apps/web/src/app/manifest.ts`: URLs relativas e escopo da origem.
- No Railway, `VAPID_SUBJECT` existe. Confirmar seu valor correto no painel sem divulgar segredos.

## Pendente para ativação
- Verificar que a **zona DNS** de `lartop.app.br` está no Registro.br; registrador e DNS podem ser diferentes.
- Capturar os **registros exatos** exigidos no projeto Vercel, para `lartop.app.br` e `www.lartop.app.br`.
- Aplicar os registros na zona DNS com acesso do titular e confirmar a emissão de certificado HTTPS na Vercel.
- Somente então alterar FRONTEND_URL, CORS_ORIGIN e VAPID_SUBJECT no Railway; confirmar e-mails Resend.
- Testar PWA, login, pedidos, redefinição de senha e Push no domínio novo.

**Nenhum registro DNS, variável de produção nem segredo foi alterado pela criação deste documento.**
