-- Adiciona colunas para os recursos de Privacidade Social
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS seguidores_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS seguindo_count INTEGER DEFAULT 0;
