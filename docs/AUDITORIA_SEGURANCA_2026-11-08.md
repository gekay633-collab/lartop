# Auditoria de segurança Lartop — 8/11/2026

**Escopo:** commit `083563930f4f538fc0dd08f26cec85dac24dca21` (main antes da auditoria), API Fastify/Prisma, Next.js/PWA, Supabase, Railway, código público no GitHub, perfis, pedidos, auth, avaliações, upload, notificações e analytics.

**Método:** inspeção estática do código e das rotas, leitura de configurações e permissões sem revelar segredos, SQL exclusivamente de leitura no Supabase, testes de integração PostgreSQL/Redis descartáveis e testes Chromium desktop/mobile simulados. **Não foi feito pentest externo, exploit em contas de usuários nem teste de intrusão em produção.** O resultado não certifica ausência de vulnerabilidades.

## Evidências de proteção já existentes

- As 14 tabelas `public` no Supabase têm RLS ativada. A consulta de privilégios não identificou concessões de tabela para os papéis `anon` ou `authenticated`; o advisor registra 14 achados informativos de RLS sem políticas. Não criar políticas abertas indiscriminadamente: a API usa Prisma.
- O serviço API e Redis estavam online na consulta de 8/11. O serviço Railway `Postgres` offline é distinto do PostgreSQL Supabase que sustenta a aplicação; não foi alterado.
- Fastify verifica assinatura JWT, conta ativa, papel e versão de credenciais vinculada à senha; revogação de token de acesso/refresh utiliza Redis. A API administrativa exige ADMIN.
- Pedidos verificam papel CLIENTE/PROFISSIONAL e titularidade no servidor; transições de status protegidas por `updateMany` condicionado e notificações criadas na transação.
- Upload novo valida `Content-Type`, assinatura de JPG/PNG/WEBP, tamanho máximo de 5 MB e quota por conta; segredo Cloudinary só na API.
- Frontend já possui `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e CSP parcial; redefinição de senha declara `no-referrer`.

## Correções nesta branch (aguardam CI, revisão e publicação)

| Severidade | Achado | Correção |
|---|---|---|
| Alta | `GET /api/profissionais/:id` devolvia o modelo Prisma inteiro, incluindo CEP-base, latitude e longitude do prestador, apesar de a UI não precisar desses dados | `select` explícito só para campos públicos; testes contra regressão e contra exposição de perfil despublicado |
| Alta | `GET /api/profissionais/:id/avaliacoes` podia expor avaliações e nomes de avaliadores mesmo com perfil despublicado ou conta inativa | Restrição de visibilidade no serviço e projeção de campos públicos |
| Alta | Script de bootstrap de ADMIN continha e-mail/senha padrão visíveis no repositório público e imprimia senha no console | Remoção completa de defaults e argumentos de senha; exige variáveis explícitas, senha longa e autorização especial em produção |
| Alta | Fluxo de senha montava URL com `FRONTEND_URL` ausente do Railway; SDK Resend devolve `error` sem necessariamente lançar exceção | Construção com URL oficial HTTPS (fallback temporário conhecido), verificação de resposta/erro do provedor e sanitização HTML; logs não recebem token/link/e-mail |
| Alta | Qualquer URL HTTPS podia ser cadastrada como imagem pública em perfil, portfólio e fotos de pedido, permitindo rastreadores de terceiros | URLs limitadas ao `res.cloudinary.com` da conta configurada, caminho `/image/upload/`; rejeita URLs externas e redirecionamentos em query |
| Alta | Endpoint obsoleto `/api/upload/assinatura` podia ser religado por flag, oferecendo assinatura direta ao navegador e contornando o novo limite de tamanho da API | Rota removida; fallback legado também retirado do frontend |
| Média | Faltava quota por CLIENTE para impedir tempestade de pedidos e Push a um prestador | 12 pedidos por janela de 15 minutos, contador Redis atômico depois da autenticação; HTTP 429 |
| Média | Endpoint público `POST /api/eventos` pode distorcer métricas e inflar a base | Limite de ingestão de 15 eventos por minuto/IP, além do limite global já existente; eventos permanecem aproximados e nunca devem decidir valores financeiros |
| Média | JWT assinava e verificava sem algoritmo fixado explicitamente | Algoritmo HS256 explícito para access/refresh e verificação; teste contra token HS384 |
| Média | Entrada de login e recuperação sem limite adequado; e-mail com caixa inconsistente; paginação admin permitia decimais e valores gigantes | Limites e normalização de e-mail, tamanho de token/senha, busca e paginação `int` com máximo |
| Baixa | Interface pode mostrar avaliações e muitas imagens de terceiros por URL criada em API | A validação de URL reduz o vetor de tracking; todas as imagens atuais identificadas no banco estão em Cloudinary |

## Pendências IMPORTANTES que não devem ser anunciadas como resolvidas

### Prioridade 0 — antes de escalar o piloto
1. **Access JWT em `localStorage`** (`apps/web/src/lib/auth-client.ts`). Um XSS de mesma origem pode extrair o token, sobretudo da conta de administrador. Planejar sessão HttpOnly/BFF com proteção CSRF e migração coordenada de login, logout, refresh e PWA. Mudança grande; **não alterar abruptamente antes dos testes com usuários reais**.
2. **CSP sem `script-src` restritivo.** A política atual bloqueia framing, objetos, base-uri e form-action, mas ainda não impede scripts injetados. A implementação correta para Next.js exige nonce por resposta e testes de hidratação, navegação e PWA.
3. **E-mail não verificado.** Em 8/11, os quatro usuários cadastrados tinham `email_verificado=false`. Fluxo de verificação e domínio remetente confiável não estão implementados. A alteração de envio corrige falha silenciosa, **mas não confirma que o Resend entrega para destinatários reais sem domínio verificado**.
4. **Confirmação de Push em Android bloqueado.** O último envio foi aceito pelo provedor, mas não comprovou exibição física. PR #12 diagnóstico pendente e separado; não foi mesclado nesta auditoria.
5. **Autenticação administrativa reforçada.** A conta ADMIN existente não usa o e-mail padrão do script (verificação de contagem; nenhuma credencial pessoal exposta neste documento). Não foi possível confirmar força da senha ou MFA. Recomendar rotação e MFA antes de produção ampla.
6. **Backups/restauração.** Não foi possível demonstrar um teste de restauração Supabase. Sem esse teste, não tratar continuidade de negócios como aprovada.

### Prioridade 1
- Revisar `CORS_ORIGIN` real, regras de proxy e limites por IP; Railway redige os valores das variáveis, então sua existência não prova conteúdo seguro. O limite global 100/min pode prejudicar pessoas atrás de um mesmo proxy; testar a IP real no Fastify antes de ajustar `trustProxy`.
- Revisar dependências com SCA (`npm audit`/GitHub Dependabot) em ambiente com acesso à rede; nenhum teste de pacote malicioso foi realizado.
- Verificar quotas totais de Cloudinary e e-mail, além de quotas por usuário; o controle por conta não impede bots que criam múltiplas contas.
- Rotas públicas de analytics recebem dados não autenticados; limite de requisições reduz abuso mas **não garante integridade das métricas**.
- URLs de recuperação devem ser testadas em endereço de e-mail real, sem expor token em logs, analytics, referrers ou tickets.
- Fotos/publicações têm limites de tamanho para o arquivo, mas não há limite máximo de registros de portfólio por prestador (risco de abuso/custo).
- Revisar permissões de publicação de profissão/categorias, mídia maliciosa poliglota e classificação de arquivos em Cloudinary com conta de homologação.
- Testar URL/API/headers reais em ambiente autorizado, incluindo login em múltiplas abas e tentativas de acesso cruzado entre duas contas distintas.
- Revisar segredos do histórico GitHub e credenciais de CI/terceiros. Remover um default no commit atual **não o apaga do histórico**; rotacionar se qualquer segredo verdadeiro tiver sido compartilhado.

### Desempenho e disponibilidade
- Supabase Advisor: quatro chaves estrangeiras sem índices (não é uma brecha de autenticação); planejar migrações Prisma com cuidado.
- Redis `KEYS refresh:*` e `KEYS busca:*` bloqueiam o servidor enquanto procuram chaves, com impacto potencial em escala. Migrar a SCAN/índice de sessões em janela controlada.
- Carga de IP e rate-limit distribuído sob proxy requer teste para prevenir bloqueio de clientes legítimos.
- Métricas de HTTP podem não ter tráfego suficiente na janela; status online não certifica todos os fluxos.

## Checklist de liberação da auditoria

- [x] Revisão de fluxos de autenticação e autorização principais por código.
- [x] Inspeção do controle de acesso `public`/RLS/grants no Supabase (somente leitura).
- [x] Inspeção de nomes das variáveis do Railway sem revelar valores.
- [x] Correções isoladas em branch, sem alterar dados de produção.
- [ ] CI (API/Prisma, integração, TypeScript, Chromium e casos de segurança novos) completamente verde.
- [ ] Revisão humana do PR e aprovação de publicação.
- [ ] Teste em celulares reais e verificação de regressões em login, pedidos, fotos e notificações.
- [ ] Teste de e-mail real e DNS do domínio.
- [ ] Sessão HttpOnly + CSP nonce com testes/rollout próprios.
- [ ] Varredura de dependências, secret scanning histórico e backup/restauração.
- [ ] Pentest independente antes de expansão significativa.

**Situação:** A auditoria é uma avaliação técnica de código/configuração; não fornece garantia de sistema invulnerável. Nenhuma correção deve ser divulgada como publicada antes do merge e da confirmação dos deploys.
