-- Migration 003: Adicionar rastreamento de armazenamento por usuário

ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_bytes BIGINT NOT NULL DEFAULT 0;

-- Função RPC para incremento atômico de armazenamento
CREATE OR REPLACE FUNCTION increment_storage(user_id UUID, bytes_to_add BIGINT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users
  SET storage_bytes = storage_bytes + bytes_to_add
  WHERE id = user_id;
END;
$$;
