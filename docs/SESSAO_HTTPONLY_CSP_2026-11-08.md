# Sessões HttpOnly e CSP por nonce — Lartop (8/11/2026)

## Problema anterior
O refresh token já era guardado em cookie HttpOnly com rotação Redis, mas o access JWT era persistido no `localStorage` e enviado por JavaScript no header Bearer. Uma injeção de script de mesma origem poderia extrair esse JWT por até quinze minutos e usá-lo fora do navegador. A CSP anterior não tinha `script-src`, portanto não bloqueava scripts inline não autorizados.

## Arquitetura implementada (PR #15)
1. O navegador envia login/cadastro/refresh/logout em `/api/auth/*` para o Route Handler da **Vercel/Next.js**, não diretamente ao Railway.
2. O handler encaminha o pedido ao backend existente, recebe o JSON com accessToken e o cookie refresh, **retira o accessToken da resposta ao navegador** e o armazena como cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em HTTPS e prefixo `__Host-`.
3. Nas outras chamadas `/api/*`, `src/proxy.ts` lê o cookie no servidor, **descarta qualquer Authorization enviado pelo navegador** e cria o Bearer somente para o rewrite de API. Os cookies da sessão não são encaminhados à API fora de `/auth`; o backend continua exigindo e validando JWT, conta ativa e papel.
4. A interface remove a chave antiga `lartop_access_token` e só mantém dicas não sensíveis `lartop_sessao_ativa`, `lartop_tipo_usuario` e `lartop_nome_usuario`. Essas dicas não autorizam chamadas: as áreas protegidas consultam `/api/usuarios/mim`, cuja autenticação ocorre na API.
5. Atualizações e sessões antigas usam o cookie refresh já existente. Renovação e logout usam Web Locks em abas; falhas de rede/503 não apagam os cookies e exibem uma opção de nova tentativa.
6. A CSP usa nonce imprevisível de 128 bits a cada resposta de página, encaminhado ao Next por header de request, e restringe `script-src` a scripts com nonce e `strict-dynamic`. O HTML é renderizado dinamicamente; a CSP também restringe `img-src`, `font-src`, `worker-src`, `form-action`, `frame-ancestors`, `object-src`, `base-uri`.
7. Requisições mutáveis na origem do site exigem `Origin` exatamente igual à origem ou `Sec-Fetch-Site: same-origin`. Origem externa/same-site/none falha com HTTP 403 antes de chegar ao backend. SameSite é defesa adicional e não substitui essa verificação.
8. Nenhum token, senha ou cookie é registrado em logs adicionados pela migração.

## Escopo e limitações
- O Railway continua emitindo JWT em JSON **para o servidor Next.js**, preservando compatibilidade com a API antiga durante o deploy. O BFF não o devolve ao JavaScript.
- A API Railway continua pública e aceita JWT obtido por clientes API externos. Isto não significa autenticação anônima: exige assinatura válida, expiração e autorização no backend.
- Um XSS com execução de código no site ainda pode realizar ações *durante a sessão do usuário* com cookies, apesar de não conseguir ler os JWTs. CSP+HttpOnly reduzem impacto, não eliminam a necessidade de sanitização, validação e auditoria contínua.
- A CSP mantém `style-src 'unsafe-inline'` para compatibilidade com o React/Tailwind; isto **não** habilita scripts inline.
- O acesso de um usuário pode precisar de novo login se o cookie de renovação já tiver expirado ou sido invalidado antes da atualização.
- O mock Chromium end-to-end local valida o gateway/CSRF, mas não equivale a validar Android físico e instalações PWA antigas em produção.
- Pode haver sobrecarga de renderização pela CSP nonce. Monitorar latência e custo antes de escalar.

## Aceite exigido antes de produção
- [ ] Build/typecheck Next.js 16.4.1 e auditoria de dependências sem falhas altas.
- [ ] Browser Chromium desktop e mobile: registro/login, logout, perfis por papel, busca, pedidos, fotos e push simulado.
- [ ] Teste **sem interceptação de fetch**, com mock Railway local, prova cookie HttpOnly, JWT ausente no localStorage e nas respostas JSON, Authorization forjado ignorado, CSRF 403, renovação e logout.
- [ ] Testar visualmente CSP sem bloqueio de hidratação e links externos.
- [ ] Após autorização de merge e deploy, validar login existente, cadastro novo, refresh após expiração, logout, upload de foto de até 5 MB, solicitações, painel admin, Push PWA bloqueado; verificar logs do Railway e Vercel.
- [ ] Não incluir o PR #12 (diagnóstico Push) neste conjunto sem testes separados.

## Rollout e rollback
- A mudança afeta apenas Next.js/Vercel; não requer migração Supabase nem alteração dos segredos da API.
- Ao publicar, o aplicativo antigo no cache/PWA pode coexistir brevemente. Como a nova rota BFF retira o campo `accessToken`, a versão antiga do JavaScript que tentar efetuar novo login/refresh poderá falhar até recarregar. **Atualizar a página e encerrar/reabrir o PWA** resolve ao obter o novo bundle. Manter monitoramento e não apagar dados do usuário.
- Se houver falha significativa, reverter apenas a versão Vercel para a última implantação aprovada. O Railway e o banco permanecem sem mudanças; avaliar novas sessões/refresh ao reverter.
