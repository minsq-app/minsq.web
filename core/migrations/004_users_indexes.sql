-- Migration 004: Adicionar índices de performance para a tabela users

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_banido ON users(banido);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
