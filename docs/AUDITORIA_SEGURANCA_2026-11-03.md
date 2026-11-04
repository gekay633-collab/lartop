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

## Comprovações e limites
- A suíte GitHub Actions do PR passou na execução [41760441077](https://github.com/gekay633-collab/lartop/actions/runs/41760441077): compilação da API, migrações em banco descartável, testes de notificações, push, autenticação HTTP, revogação de sessões, integração e checagem de tipos do frontend.
- A validação HTTP ocorreu via `Fastify.inject` em ambiente isolado. **Não equivale a testes manuais no navegador ou no celular**, que permanecem pendentes.
- Nenhuma alteração foi implantada na produção como parte desta auditoria; nenhuma linha da base real foi alterada.
- A mudança do formato do refresh JWT exige novo login de sessões antigas após deploy.
- O backend consulta o banco e o Redis para autorizar operações; isso protege contas bloqueadas e tokens revogados, com custo de uma consulta adicional a cada serviço por requisição autenticada. Se o Redis ficar indisponível, a API responde 503 em vez de autorizar sem verificação; monitorar esta dependência.

## Achados pendentes — não tratar como corrigidos

### Prioridade alta
- **Sessões antigas após reset de senha:** refresh tokens anteriores não renovam mais, mas access tokens já emitidos podem ser aceitos até expirar (padrão de 15 minutos). Uma invalidação imediata exige versão/época de sessão checada pelo middleware.
- **Token de acesso em localStorage:** um XSS pode roubar o bearer token. Projetar migração para sessão baseada em cookie HttpOnly e controles CSRF, ou armazenamento em memória, sem alterar o fluxo atual abruptamente.
- **CSP da API desligada:** `contentSecurityPolicy: false` no Helmet. Avaliar CSP no frontend Next.js e sua compatibilidade com scripts, imagens e integrações antes de ativar.

### Prioridade média
- **Cloudinary:** a verificação de 5 MB é feita no navegador; não equivale a limite obrigatório no serviço externo. Configurar limites de tamanho e quota também no Cloudinary (preset ou política de conta). Avaliar limites por conta para assinatura de upload.
- **Privilégios Supabase:** todas as 14 tabelas do esquema `public` têm RLS ativada e nenhum policy; o auditor classifica como informativo. Confirmar se a Data API está restrita e quais grants existem antes de mudar qualquer policy. Como a API usa Prisma, não criar policies indiscriminadas.
- **Validação em navegadores:** testes HTTP automatizados já cobrem login, logout, troca de senha e dois dispositivos; ainda precisam ser exercitados em navegador, celular e com múltiplas abas, avaliando cookies, expiração e notificações push.
- **Redis:** `KEYS` é usado para localizar sessões; para volume maior, migrar para SCAN/índice de sessões. Rever concorrência em revogação e renovação.
- **Eventos de analytics públicos:** validar prevenção de tráfego automatizado e manipulação das métricas por cliente anônimo.
- **Confirmação de e-mail:** depende da configuração de domínio de envio e de fluxo de verificação; não está concluída nesta auditoria.

### Otimização / manutenção
- O auditor de performance Supabase informa **quatro chaves estrangeiras sem índice de cobertura**: `avaliacoes.avaliador_id`, `notificacoes.solicitacao_id`, `profissional_categorias.categoria_id` e `solicitacoes_orcamento.categoria_id`. Planejar migração Prisma com índices e medir antes/depois.
- Avisos de índices sem uso têm pouco valor estatístico em banco de testes; não remover automaticamente.
- Railway: serviço de aplicação e Redis estavam online na consulta; existe PostgreSQL no Railway offline, mas outro PostgreSQL Supabase está ativo. Confirmar se a instância Railway é legado antes de qualquer ação.
- Verificar atualizações de dependências e executar auditoria de vulnerabilidades com repositório acessível por ferramentas de build.

## Checklist para aprovação e deploy
- [x] Revisão estática das áreas críticas de API, sessão e autorização.
- [x] Testes automatizados de CI passaram.
- [ ] Testar fluxo de login, renovação, logout e recuperação de senha no navegador real.
- [x] Testar sessões simultâneas de dois dispositivos e refresh concorrente em integração HTTP isolada.
- [ ] Testar sessões simultâneas em navegadores/abas reais; uma renovação concorrente do mesmo token será recusada e pode exigir novo login.
- [ ] Confirmar que o Redis da produção suporta GETDEL (Redis 6.2+) e monitorar disponibilidade devido à consulta por requisição autenticada.
- [ ] Planejar comunicação de novo login após deploy.
- [ ] Verificar configuração de produção do Cloudinary e de segurança do Vercel.
- [ ] Fazer revisão humana do PR e implantar em janela controlada.

**Importante:** este documento não certifica ausência de vulnerabilidades e não representa pentest externo.
