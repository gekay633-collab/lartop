# Lartop — plano de correção de segurança do MVP
**Data:** 10/11/2026 · **Situação:** execução em branch isolada, sem implantação automática autorizada

## Premissas e proteção operacional
- Código-base: `main` do repositório `gekay633-collab/lartop`; Next.js na Vercel, Fastify no Railway, PostgreSQL Supabase, Redis privado e Cloudinary.
- O projeto precisa preservar login HttpOnly, renovação/rotação de sessão, pedidos, WhatsApp e Push já testados em dispositivos.
- **Não alterar a produção sem PR revisado, CI integral aprovado e checklist de homologação.** Não colocar segredos em commits, issues, logs, capturas nem respostas de ferramentas.
- Algumas verificações (score do Mozilla Observatory, SecurityHeaders, configuração privada da Vercel, ACL/moderação Cloudinary e força efetiva de segredos) exigem acesso externo e devem ser marcadas como **pendentes**, nunca presumidas.

## Etapa 1 — Impedir acesso indevido e vazamento de dados (P0/P1)
**Escopo:** Fastify /admin, rotas de usuário e solicitação, acesso direto ao Railway, Prisma e Next BFF.

1. Manter autorização no **backend**, exigindo token válido, role ADMIN e validação da conta ativa para TODAS as rotas administrativas; testar visitante, CLIENTE, PROFISSIONAL, JWT com role forjada e conta desativada.
2. Testar BOLA/IDOR nas operações de pedidos/notificações/perfil: cliente A não lê/altera pedidos de B, prestador A não gerencia pedidos de B. A API deve responder 401/403/404 apropriados sem dados de terceiros.
3. Substituir `$queryRawUnsafe` da busca por `Prisma.sql` + `$queryRaw`; testar categoria legítima e payload de injeção, mantendo geolocalização/paginação e sem expor telefone/e-mail/CEP-base.
4. Confirmar que o endpoint Railway público não oferece autenticação fraca, CORS permissivo nem bypass da autorização; **não realizar testes destrutivos nem força bruta em produção**.
5. Adicionar teste de ausência de variáveis sensíveis nos assets estáticos e proteger módulo de chamadas server-side com `server-only`.

**Aceite:** integração PostgreSQL/Redis descartável + Chromium verdes, nenhum dado privado em buscas anônimas, e nenhuma operação administrativa por cliente/prestador. Sem mudanças no banco de produção nesta etapa.

## Etapa 2 — Headers, transporte e infraestrutura (P1)
1. No Next configurar `Strict-Transport-Security: max-age=31536000` (sem `includeSubDomains` ou `preload` até aprovar domínio próprio e subdomínios). Preservar CSP por nonce, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; adicionar testes de resposta HTTP.
2. Medir HTTPS/CSP/HSTS nos **domínios efetivamente públicos** do frontend e Railway usando [SecurityHeaders](https://securityheaders.com) e [Mozilla Observatory](https://observatory.mozilla.org), registrando data, URL, scores, erros e diferença entre API/Next; repetir no domínio próprio após configurá-lo.
3. Confirmar Redis protegido pela rede privada, exigindo senha e sem TCP público; revisar restrições da API externa, CORS, limites de requisição/IP e cabeçalhos enviados pela Vercel.
4. Inspecionar o build real `/_next/static` para sinais de URLs privadas, tokens ou `DATABASE_URL`/`REDIS_URL`/`JWT_*_SECRET`. Não basta inspecionar apenas os arquivos-fonte.

**Aceite:** HTTPS válido, headers verificados em resposta real, sem exposição de segredos no bundle e nenhuma regressão da CSP ou do BFF.

## Etapa 3 — Uploads e Cloudinary (P1/P2)
1. Manter limite de 5 MiB e lista restrita de MIME/assinatura; **validar a decodificação integral** (incluindo dimensões/pixels para prevenir imagens-bomba) e rejeitar arquivos corrompidos/poliglotas. Se implementar biblioteca, atualizar lockfiles juntos, executar auditoria de dependências.
2. Vincular cada asset ao usuário que o enviou, preferencialmente por registro persistido `assetId` / `public_id` associado ao dono; não confiar somente em URL da conta Cloudinary. Testar vinculação de imagem de outro usuário e incompatibilidade com fotos antigas.
3. Conferir ACL, listagem de recursos públicos, URLs de entrega e políticas de exclusão/retenção da conta Cloudinary. Avaliar análise antimalware/moderação com serviço apropriado sem bloquear o MVP indiscriminadamente.
4. Fazer rollout compatível com uploads existentes, sem deletar imagens antigas antes da migração validada.

**Aceite:** só JPG/PNG/WebP decodificados, até 5 MiB, proprietário correto, arquivos indevidos recusados, upload real de teste funcional.

## Etapa 4 — Segredos, sessões e proteção contra abuso (P1)
1. Confirmar existência e **qualidade** de JWT_ACCESS_SECRET/JWT_REFRESH_SECRET (independentes e suficientemente aleatórios), DATABASE_URL, REDIS_URL, CLOUDINARY_API_SECRET, RESEND_API_KEY e VAPID_PRIVATE_KEY em plataformas certas. Validar apenas comprimentos/ausência/políticas, nunca divulgar valores.
2. Revalidar rotação de refresh, replay, logout, bloqueio, sessão em múltiplos aparelhos, ausência de JWT em localStorage e regras CSRF; manter expiração curta (~15 min) e refresh rotativo.
3. Verificar rate limits de login, recuperação, administração, upload e pesquisas; limitar enumeração e abuso sem bloquear usuários legítimos.
4. Planejar rotação de chaves com janela e rollback: mudar JWT secrets revoga sessões; VAPID pode exigir nova inscrição Push; não fazer alteração silenciosa.

**Aceite:** nenhum segredo no repositório/bundle/log, autenticação e Push funcionando após testes físicos.

## Etapa 5 — Dados pessoais, LGPD e cadeia de suprimentos (P1/P2)
1. Minimização: perfis/buscas públicas sem telefone, CEP-base, localização exata ou e-mail; somente revelar dados necessários no estágio autorizado de contato.
2. Documentar acesso/eliminação/retenção de dados, consentimento e finalidade de uso de telefone/WhatsApp e CEP; logs sem payload pessoal. **Telefone e CEP são dados pessoais; não são automaticamente dados pessoais sensíveis na classificação legal da LGPD.**
3. Habilitar Dependabot para workspace pnpm, lockfile próprio do frontend e GitHub Actions, mantendo `pnpm audit --prod --audit-level high` no CI. Revisar alertas GitHub/Dependabot no painel administrativo da organização: configurar requer permissão do proprietário.
4. Não executar `npm audit fix --force` em produção. Abrir PRs com lockfile atualizado, suíte de testes e rollback claro. Verificar também dependências de desenvolvimento por revisão periódica.

**Aceite:** documentação de privacidade/retenção consistente, dependências auditadas, alertas visíveis à equipe.

## Execução e critérios de liberação
| Sequência | Entrega | Situação inicial |
| --- | --- | --- |
| 1 | Substituir raw SQL, testes de admin/busca, HSTS, server-only, análise de bundle e Dependabot | Em implementação na branch isolada |
| 2 | Teste de acesso cruzado de pedidos e revisão da API pública / Railway | Em validação |
| 3 | Ownership de imagens, decode integral e ACL Cloudinary | Pendente — dependente de inventário de arquivos |
| 4 | Medições SecurityHeaders/Observatory e verificação de segredos sem divulgação | Pendente — validar domínio final e acesso das plataformas |
| 5 | LGPD/retenção, alertas de dependências e aprovação do rollout | Pendente |

Antes de cada publicação: CI completo; banco descartável; preview Next/Proxy/CSP; teste cliente ↔ prestador e admin; checagem de notificação com tela bloqueada; observabilidade 401/403/429/5xx; revisão de alterações e plano de reversão. Publicar inicialmente **sem migração destrutiva**. Se os indicadores de login ou pedidos regredirem, reverter o commit/deploy; nunca desfazer mudanças aditivas do banco às cegas.

## Evidências já conhecidas — sem extrapolar
- Rotas admin do Fastify usam `exigirAutenticacao` e `exigirTipo(['ADMIN'])`.
- Banco Supabase: 14 tabelas públicas do aplicativo com RLS ativo, sem SELECT direto para `anon`/`authenticated`; revisão de políticas sempre necessária ao mudar grants.
- Redis do Railway: instância privada, senha obrigatória, nenhum TCP público encontrado na inspeção de 10/11.
- Upload atual: 5 MiB, MIME permitido e reconhecimento dos primeiros bytes; validação completa e propriedade Cloudinary pendentes.
- Web: CSP por nonce, HttpOnly JWT, proteção CSRF e BFF; teste externo do cabeçalho efetivo no domínio final pendente.
- Não confundir sucesso de CI ou deploy verde com ausência de falhas no dispositivo real.
