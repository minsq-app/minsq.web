-- ============================================================
-- Minsq — Migration: Grace Period columns for sessions table
-- Run this in the Supabase SQL Editor before deploying the
-- new auth.controller.ts (Fix 2: refresh token grace period).
-- ============================================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_rotated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_token_hash  TEXT,
  ADD COLUMN IF NOT EXISTS last_new_access_token TEXT;

-- Índice opcional para performance (leitura por sessão já é feita por PK,
-- mas o índice ajuda se você quiser queries de auditoria por last_rotated_at)
CREATE INDEX IF NOT EXISTS idx_sessions_last_rotated_at
  ON sessions (last_rotated_at)
  WHERE last_rotated_at IS NOT NULL;

-- ============================================================
-- Coluna          | Tipo        | Descrição
-- ----------------+-------------+-----------------------------
-- last_rotated_at | TIMESTAMPTZ | Quando o refresh token foi
--                 |             | rotacionado pela última vez.
--                 |             | Usado para calcular o grace
--                 |             | period (< 10s = corrida OK)
-- previous_token  | TEXT        | Hash do token anterior,
-- _hash           |             | para auditoria de reuso.
-- last_new_access | TEXT        | Access token emitido na
-- _token          |             | última rotação bem-sucedida.
--                 |             | Devolvido durante grace period
--                 |             | em vez de revogar a sessão.
-- ============================================================
