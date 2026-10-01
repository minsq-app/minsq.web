-- Migration 011: Eliminar hash SHA-256 legado (Achado #8)
-- =============================================================
-- PASSO 1: Revogar imediatamente todas as sessões de usuários
--           que ainda têm hash SHA-256 (não-Argon2id) ativo.
--           Após isso, nenhuma sessão "legada" pode mais chegar
--           em verifyCurrentPassword / disableMe / deleteMe.
UPDATE sessions
SET revoked_at = now()
WHERE revoked_at IS NULL
  AND user_id IN (
    SELECT id FROM users
    WHERE senha IS NOT NULL AND senha NOT LIKE '$argon2id$%'
  );

-- PASSO 2: Apagar o hash fraco. login() trata senha IS NULL
--           igual a hash não-Argon2 → FORCE_PASSWORD_RESET.
--           resetPassword não lê senha antes de sobrescrever.
UPDATE users
SET senha = NULL
WHERE senha IS NOT NULL AND senha NOT LIKE '$argon2id$%';

-- PASSO 4 (opcional, recomendado): constraint que impede
--           qualquer código futuro de gravar hash fraco.
ALTER TABLE users
ADD CONSTRAINT senha_argon2_or_null
  CHECK (senha IS NULL OR senha LIKE '$argon2id$%');
