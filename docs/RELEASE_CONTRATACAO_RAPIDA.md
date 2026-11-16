# LARTOP — publicação controlada da contratação rápida (PR #56)

**Status: BLOQUEADO ATÉ BACKUP VALIDADO.** Este documento prepara a operação; não executa migração nem deploy.

## Constatações em 16/11/2026

- A API de produção da LARTOP está no Railway, vinculada à branch `main`, com domínio `lartop-production.up.railway.app`.
- Os registros DNS de saída da API apontam ao pooler `aws-0-us-east-2.pooler.supabase.com`; portanto, o PostgreSQL offline exibido em outro serviço Railway **não deve ser considerado o banco de destino**.
- O projeto Supabase identificado contém dados de usuários, solicitações, avaliações e notificações e usa PostgreSQL 17. O banco precisa ser identificado também na variável **DATABASE_URL** / **DIRECT_DATABASE_URL** do backend antes da escrita (os conectores não expõem esses valores).
- O banco Supabase consultado não tem tabela `public._prisma_migrations`; há histórico de migrações Supabase. Portanto, **não** executar `prisma migrate deploy` contra ele sem baselining específico.
- O Railway faz build em `apps/api` e inicia `node dist/server.js`; não há migração automática confiável antes do deploy.
- CI da PR #56 passou com Postgres/Redis descartáveis e Chromium emulado. CI verde não é teste do banco de produção.
- A Vercel está conectada ao mesmo repositório e gera previews para branches; o merge em `main` pode acionar publicação automaticamente.

## 1. Backup — sem contratação de serviço adicional

1. Em máquina confiável, instalar `pg_dump` e `pg_restore` versão **17+** e usar somente as variáveis PostgreSQL de conexão direta do projeto Supabase correto. Não colar senhas, URLs completas nem backups na PR, no ChatGPT ou em logs.
2. Configurar localmente `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, autenticação por `PGPASSWORD` ou `PGPASSFILE` e `PGSSLMODE=require`. Conferir o host com os dados no painel. Atenção: o script bloqueia host que não termine em `.supabase.com`.
3. Executar `bash scripts/backup-lartop-supabase.sh`. O arquivo fica em `$HOME/lartop-backups` com permissão restrita; nada vai para GitHub.
4. **Restaurar o arquivo em um Postgres 17 LOCAL e descartável** (não no Supabase nem no Railway), usando `pg_restore --no-owner --no-acl --exit-on-error -d <banco-local> <arquivo.dump>`. Confirmar tabelas, relacionamentos e contagens aproximadas. A listagem do `pg_restore --list` sozinha **não** comprova que é recuperável.
5. Guardar arquivo, hash SHA-256, data/hora e resultado da restauração em local seguro. Se não conseguir backup/restauração confiáveis, **parar aqui**. O banco usa recursos gratuitos e backups gerenciados não foram verificados.

## 2. Migração aditiva (somente depois do backup)

O SQL a ser revisado está em:
`apps/api/prisma/migrations/20261116210000_add_solicitacoes_rapidas/migration.sql`.

Ele:
- remove `NOT NULL` somente de `cliente_id`, `cep`, `endereco`, `tamanho_m2` em `public.solicitacoes_orcamento`;
- adiciona quatro campos opcionais para nome, WhatsApp, hash de acesso e expiração;
- **não apaga** linhas, contas, avaliações, notificações ou dados antigos.

Aplicar esse SQL **uma única vez**, de forma versionada pelo mecanismo de migração Supabase / revisão SQL no banco confirmado. NÃO rodar o histórico completo de migrações Prisma no Supabase que já possui tabelas existentes.

Verificar via `information_schema.columns` que os campos existem com tipos e nulabilidade corretos; validar contagens anteriores e posteriores (nunca fazer `UPDATE` em pedidos reais neste passo).

## 3. Publicação coordenada

Somente depois da migração conferida:

1. Congelar o commit exato aprovado da PR #56 e confirmar CI aprovado e Vercel preview **READY**.
2. Confirmar que produção no Railway e Vercel continuam apontando para `main`, sem mudanças concorrentes.
3. Mesclar a PR #56 **apenas depois** da migração. O push em `main` deve disparar deploy da API Railway e do frontend Vercel. Observar status e logs.
4. Confirmar `/health` da API; perfis antigos; login de cliente e profissional; notificação push; portfólio; solicitações antigas.
5. Criar **uma solicitação controlada** em perfil de teste: salvar pedido → um único aviso → lead no painel → link privado → WhatsApp com texto preenchido. Não confundir abrir WhatsApp com mensagem enviada.
6. Testar token inválido e expirado e monitorar falhas 5xx do backend, além de erros de funções no frontend. Não registrar dados de clientes em logs.

## 4. Contenção e reversão

- A alteração do schema é aditiva: **não desfazer removendo colunas ou restaurando todo banco** por padrão; isso destruiria novos pedidos e criaria perda de dados.
- Se o frontend falhar, voltar à implantação anterior na Vercel e observar; se a API falhar, usar rollback do Railway com cautela.
- **Atenção:** o código antigo pode não tratar corretamente pedidos novos com `cliente_id = NULL`. Depois do primeiro pedido sem conta, um rollback completo do backend precisa ser testado (ou a criação de pedidos anônimos desabilitada) antes da reversão.
- Se surgir erro de consistência, interromper novas solicitações e corrigir a API mantendo a estrutura já migrada; preservar os registros.
- Evitar desligar/despublicar serviços, apagar volumes ou restaurar backup sobre usuários ativos sem plano de recuperação de dados gerados após o backup.

## 5. Pendências externas

- Comprovação do **backup realmente criado e restaurado**.
- Confirmação da URL de DB runtime e migration (conector Railway redige valores).
- Teste com celular físico e push no aparelho bloqueado.
- Confirmação de que nenhum recurso pago foi ativado.
- Autorização de publicação já recebida para o fluxo, mas o gate técnico de backup ainda é obrigatório.
