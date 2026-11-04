# Auditoria de segurança — Lartop
**Data:** 03/11/2026 (horário de Brasília)  
**Escopo:** API Fastify/Prisma, frontend Next.js, Supabase, Redis e infraestrutura Railway.  
**Estratégia:** mudanças propostas em branch isolada; não foram aplicadas alterações no banco real nem deploy.

## Correções implementadas nesta branch
1. JWT de renovação recebe `jti` aleatório e único; sessão é registrada no Redis.
2. Renovação consome o token via `GETDEL`, valida identidade e conta ativa e impede replay do mesmo token.
3. Logout revoga **somente o refresh token deste dispositivo** e, quando enviado, inclui o access token atual em uma lista de revogação no Redis até sua expiração. Isso evita derrubar sessões de outros dispositivos.
4. Redefinição de senha consome o token de recuperação condicionalmente dentro de transação, evitando uso concorrente.
5. Sessões de renovação anteriores são revogadas após redefinição de senha.
6. Middleware de autenticação verifica se a conta existe, está ativa e se o papel no JWT corresponde ao papel atual no banco.
7. Bloqueio administrativo aciona revogação de sessões; perfis de profissionais desativados não aparecem em consultas públicas.
8. Busca por cidade e paginação de solicitações recebem validação e limites numéricos.
9. URLs de imagens recebidas nos perfis e solicitações precisam utilizar HTTPS, sem usuário/senha embutidos.
10. O botão **Sair** do frontend agora chama o logout no backend antes de apagar os dados locais; em caso de falha não informa sucesso e permite tentar novamente. A assinatura push local é desativada após a confirmação de logout.
11. Access tokens passaram a ter identificador aleatório único para permitir revogação individual mesmo quando emitidos no mesmo segundo.
12. Foram adicionados testes HTTP de login, cookies HttpOnly, logout em dois dispositivos, reuso e concorrência de refresh, recuperação de senha e revogação do access token. As integrações de notificação encerram as conexões Redis corretamente no fim dos testes.
13. O access JWT é vinculado a uma versão de credenciais derivada por HMAC do hash atual da senha. A API rejeita imediatamente tokens antigos depois da troca de senha, sem alterar o esquema do banco.
14. O token de redefinição é retirado da URL após hidratação da página. A rota adota Referrer-Policy no-referrer e Cache-Control no-store.
15. O upload normal agora é recebido na API, limitado a 5 MB no parser do servidor, validado por assinatura dos bytes e limitado a 40 requisições por conta/hora. A assinatura direta anterior fica disponível somente com UPLOAD_ASSINATURA_LEGADO=true, durante a migração.
16. O frontend recebeu cabeçalhos de segurança de enquadramento e origem, e a página de recuperação passou a informar erro se o servidor não confirmar o pedido.
17. Adicionados testes Playwright Chromium no Next.js real, em resolução desktop e celular emulado, com API simulada para não alterar produção.

## Comprovações e limites
- A suíte GitHub Actions do PR passou na execução [41764042852](https://github.com/gekay633-collab/lartop/actions/runs/41764042852): compilação da API, migrações em banco descartável, testes de notificações, push, autenticação HTTP, revogação de sessões, verificação de uploads, integração, checagem de tipos do frontend e Chromium desktop/celular emulado.
- A integração HTTP ocorreu via Fastify.inject em banco e Redis isolados. O navegador Chromium executou o frontend Next.js em resolução desktop e celular emulado, com respostas de API simuladas. **Não equivale a teste em aparelho físico, em produção nem a entrega real de Push**, que permanecem pendentes.
- Nenhuma alteração foi implantada na produção como parte desta auditoria; nenhuma linha da base real foi alterada.
- A mudança do formato do refresh JWT exige novo login de sessões antigas após deploy.
- O backend consulta o banco e o Redis para autorizar operações; isso protege contas bloqueadas e tokens revogados, com custo de uma consulta adicional a cada serviço por requisição autenticada. Se o Redis ficar indisponível, a API responde 503 em vez de autorizar sem verificação; monitorar esta dependência.

## Achados pendentes — não tratar como corrigidos

### Prioridade alta
- **Tokens de acesso antigos após reset:** corrigido na branch com assinatura HMAC vinculada às credenciais. Os access JWTs antigos (sem esta assinatura) exigirão novo login quando a nova versão for publicada.
- **Token de acesso em localStorage:** um XSS pode roubar o bearer token. Projetar migração para sessão baseada em cookie HttpOnly e controles CSRF, ou armazenamento em memória, sem alterar o fluxo atual abruptamente.
- **CSP:** o frontend Next.js recebeu proteções base-uri, object-src, frame-ancestors e form-action. A API mantém CSP desligada para endpoints JSON; uma política restritiva de scripts com nonce ainda depende de revisão específica para evitar quebra de hidratação.

### Prioridade média
- **Cloudinary:** limite de 5 MB agora é obrigatório na API no fluxo novo, com validação do arquivo e quota por conta. Ainda falta um teste real com credenciais de homologação e desativar o endpoint legado após migrar o frontend. Limites globais/quotas do provedor não foram inspecionados.
- **Privilégios Supabase:** todas as 14 tabelas do esquema `public` têm RLS ativada e nenhum policy; o auditor classifica como informativo. Confirmar se a Data API está restrita e quais grants existem antes de mudar qualquer policy. Como a API usa Prisma, não criar policies indiscriminadas.
- **Validação em navegadores:** Chromium desktop e emulação móvel automatizados aprovados com API mockada. Ainda faltam testes com backend real em homologação, múltiplas abas, cookies e notificação push no sistema operacional de aparelho físico.
- **Redis:** `KEYS` é usado para localizar sessões; para volume maior, migrar para SCAN/índice de sessões. Rever concorrência em revogação e renovação.
- **Eventos de analytics públicos:** validar prevenção de tráfego automatizado e manipulação das métricas por cliente anônimo.
- **Confirmação de e-mail:** depende da configuração de domínio de envio e de fluxo de verificação; não está concluída nesta auditoria.

### Otimização / manutenção
- O auditor de performance Supabase informa **quatro chaves estrangeiras sem índice de cobertura**: `avaliacoes.avaliador_id`, `notificacoes.solicitacao_id`, `profissional_categorias.categoria_id` e `solicitacoes_orcamento.categoria_id`. Planejar migração Prisma com índices e medir antes/depois.
- Avisos de índices sem uso têm pouco valor estatístico em banco de testes; não remover automaticamente.
- Railway: serviço de aplicação e Redis estavam online; Redis usa imagem 8.2, suporta GETDEL (desde 6.2) e tem volume persistente; REDIS_URL e credenciais de Cloudinary/VAPID estão registradas na API com valores protegidos. Não houve teste de comando Redis em produção. Existe PostgreSQL do Railway offline e PostgreSQL Supabase ativo; confirmar se instância Railway é legado antes de qualquer ação.
- Verificar atualizações de dependências e executar auditoria de vulnerabilidades com repositório acessível por ferramentas de build.

## Checklist para aprovação e deploy
- [x] Revisão estática das áreas críticas de API, sessão e autorização.
- [x] Testes automatizados de CI passaram.
- [x] Testar navegação de login/logout e remoção de token da URL no Chromium desktop + mobile emulado, com API simulada.
- [ ] Testar com backend de homologação e em aparelho físico (Android e iPhone, caso aplicável), incluindo notificações push em segundo plano.
- [x] Testar sessões simultâneas de dois dispositivos e refresh concorrente em integração HTTP isolada.
- [ ] Testar sessões simultâneas em navegadores/abas reais; uma renovação concorrente do mesmo token será recusada e pode exigir novo login.
- [x] Confirmar por configuração que o Redis 8.2 do Railway suporta GETDEL (6.2+), com REDIS_URL cadastrada.
- [ ] Validar comando e saúde de Redis no ambiente de homologação e monitorar disponibilidade devido à consulta por requisição autenticada.
- [ ] Planejar comunicação de novo login após deploy.
- [ ] Publicar API e frontend em etapas coordenadas: antes da atualização da API, ativar temporariamente UPLOAD_ASSINATURA_LEGADO=true, se o frontend antigo precisar continuar realizando uploads; implantar frontend com o novo endpoint, testar JPG/PNG/WEBP até 5 MB e somente então retirar a flag.
- [ ] Verificar cotas do Cloudinary, validade do upload real e ambiente Vercel; executar teste de segurança em homologação.
- [ ] Fazer revisão humana do PR e implantar em janela controlada.

**Importante:** este documento não certifica ausência de vulnerabilidades e não representa pentest externo.


## Estratégia recomendada para acesso no navegador (ainda não implementada)
O access token continua em `localStorage`, legível por scripts de mesma origem. A correção definitiva é uma migração em etapas para um BFF/proxy Next.js, em que o navegador não receba bearer tokens e a sessão fique em cookie HttpOnly, Secure, SameSite, com proteção CSRF nas mutações. Essa migração precisa adaptar guards, notificações e chamadas API, ser testada em navegador/celular e prever sessão legada. Trocar silenciosamente por `sessionStorage` não elimina o risco de XSS e pode prejudicar o retorno do usuário ao PWA pelo aviso push.

## Critérios de liberação
1. GitHub Actions verde na branch de segurança.
2. Validação de upload real e de login com backend de homologação, sem usuários/dados reais.
3. Teste em dispositivos físicos (som, permissão, primeiro plano, segundo plano e clique da notificação).
4. Confirmação explícita da sequência de rollout de API e Vercel, desativação posterior do mecanismo de assinatura direta e observação dos logs.
5. Pull Request continua rascunho até a revisão final. Nenhum merge automático.
