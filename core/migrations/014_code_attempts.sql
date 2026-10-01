CREATE TABLE IF NOT EXISTS code_attempts (
  ip_email TEXT PRIMARY KEY,
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS (Row Level Security) para segurança.
-- Como nenhuma política foi criada, por padrão TODAS as requisições do frontend (anon/auth) serão bloqueadas.
-- Apenas o backend (usando a service_role key) conseguirá ler e escrever nesta tabela, o que é o comportamento ideal.
ALTER TABLE code_attempts ENABLE ROW LEVEL SECURITY;
