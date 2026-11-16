#!/usr/bin/env bash
# Backup lógico da LARTOP em banco Supabase.
# Nunca envia dados para GitHub, Railway, Vercel ou serviços de terceiros.
set -Eeuo pipefail
umask 077

for comando in pg_dump pg_restore sha256sum; do
  command -v "$comando" >/dev/null || { printf 'Falta instalar %s.\n' "$comando" >&2; exit 1; }
done

if [[ -z "${PGHOST:-}" || -z "${PGUSER:-}" || -z "${PGDATABASE:-}" ]]; then
  echo "Defina PGHOST, PGUSER, PGDATABASE, PGPORT e PGPASSWORD/PASSFILE em ambiente local." >&2
  exit 1
fi
if [[ "$PGHOST" != *.supabase.com ]]; then
  echo "Destino inesperado: somente bancos Supabase explícitos são aceitos." >&2
  exit 1
fi

# PostgreSQL 17: requer pg_dump 17 ou mais recente.
versao="$(pg_dump --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
if [[ ! "$versao" =~ ^[0-9]+$ ]] || (( versao < 17 )); then
  echo "pg_dump 17+ obrigatório para o banco PostgreSQL 17." >&2
  exit 1
fi

destino="${LARTOP_BACKUP_DIR:-$HOME/lartop-backups}"
mkdir -p -- "$destino"
arquivo="$destino/lartop-public-$(date -u +%Y%m%dT%H%M%SZ).dump"
export PGSSLMODE="${PGSSLMODE:-require}"

# Backup dos dados e estrutura da aplicação no schema public.
# Não exportar senhas para logs ou linhas de comando.
pg_dump --schema=public --format=custom --no-owner --no-acl --file="$arquivo"
pg_restore --list "$arquivo" >/dev/null
printf 'Backup criado e índice legível: %s\n' "$arquivo"
sha256sum "$arquivo"
echo "ATENÇÃO: para garantir recuperação, restaurar em PostgreSQL 17 LOCAL isolado e comparar contagens."
