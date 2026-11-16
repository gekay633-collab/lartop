-- Apenas acrescenta o novo tipo; não remove dados nem altera notificações existentes.
ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'NOVA_AVALIACAO';
