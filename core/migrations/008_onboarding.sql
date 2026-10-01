-- Adiciona a coluna 'conheceu_por' para salvar a origem do usuário durante o onboarding
ALTER TABLE users ADD COLUMN IF NOT EXISTS conheceu_por VARCHAR(100);
