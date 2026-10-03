-- ==========================================
-- SCHEMA SQL PARA MINSQ (SUPABASE POSTGRES)
-- Crie esta estrutura no Editor SQL do Supabase
-- ==========================================

-- Habilitar UUIDs se necessário
create extension if not exists "uuid-ossp";



-- 2. TABELA DE USUÁRIOS
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) unique not null,
    nome varchar(255) not null,
    senha varchar(255),
    nascimento date,
    verification_code varchar(50),
    confirmado boolean default false not null,
    role varchar(50) not null default 'user', -- user, admin
    streak integer not null default 0,

    avatar_url varchar(512),
    bio text,
    tema varchar(50) default 'dark',
    code_attempts integer default 0,
    code_resends integer default 0,
    code_last_sent_at timestamp with time zone,

    handle varchar(50) unique,
    social1 varchar(255),
    social2 varchar(255),
    profile_page_bg varchar(50) default 'default',
    profile_page_bg_img text,
    profile_kout varchar(50) default 'none',
    profile_font varchar(50) default 'dmsans',
    profile_bg varchar(512),
    profile_bg_opacity integer default 30,
    profile_page_bg_opacity integer default 18,
    avatar_border varchar(50) default 'none',
    profile_theme varchar(50) default 'default',
    avatar_type varchar(50) default 'initial',
    avatar varchar(512),
    account_number serial,
    customization_json jsonb default '{}'::jsonb,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
    ativo boolean default true not null
);

-- 4. TABELA DE TAREFAS
create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    titulo varchar(255) not null,
    descricao text,
    categoria varchar(100) not null, -- work, health, study, finance, etc.
    data date not null default current_date,
    concluida boolean default false not null,
    prioridade varchar(50) default 'media' not null, -- baixa, media, alta
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. TABELA DE METAS (REMOVIDA — funcionalidade migrada para mindmaps + goal_categories)
-- A tabela goals não é mais usada. Os planos de ação são gerenciados pela tabela mindmaps.


-- 6. TABELA DE FINANÇAS
create table if not exists finances (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    tipo varchar(50) not null, -- receita, despesa
    valor numeric(10, 2) not null,
    categoria varchar(100) not null,
    descricao text,
    data date not null default current_date,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. SESSÕES DE ESTUDO
create table if not exists study_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    titulo varchar(255) not null,
    duracao_min integer not null,
    categoria varchar(100) not null,
    data date not null default current_date,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. LOGS DE SAÚDE
create table if not exists health_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    tipo varchar(50) not null, -- treino, dieta, sono
    dados_json jsonb default '{}'::jsonb not null,
    data date not null default current_date,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. SESSÕES DE FOCO
create table if not exists focus_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    duracao_min integer not null,
    tipo varchar(50) default 'pomodoro' not null,
    data date not null default current_date,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. HISTÓRICO DE STREAKS
create table if not exists streaks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    streak_atual integer default 0 not null,
    streak_maximo integer default 0 not null,
    ultimo_checkin date,
    historico_json jsonb default '[]'::jsonb
);

-- 18. TICKETS DE SUPORTE
create table if not exists support_tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade,
    nome varchar(255),
    email_contato varchar(255) not null,
    assunto varchar(255) not null,
    mensagem text not null,
    status varchar(50) default 'aberto' not null, -- aberto, respondido, fechado
    lido boolean default false not null,
    admin_resposta text,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 21. ROTINA BASE
create table if not exists routines (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    hora varchar(10) not null,
    titulo varchar(255) not null,
    dia_semana smallint,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- TABELAS DA ABA METAS
-- ==========================================

-- 22. PLANOS DE AÇÃO — Cards de metas simples com modal de texto
create table if not exists plans_action (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references users(id) on delete cascade not null,
    plan_id     varchar(100) not null,               -- ID único gerado no frontend (ex: "cat_abc123")
    name        varchar(255) not null,               -- Nome do plano (ex: "Comprar casa", "Viajar")
    "desc"      text,                                -- Descrição curta do plano
    desc_align  varchar(20) default 'center',        -- Alinhamento da descrição: 'left' | 'center'
    photo_url   text,                                -- URL da foto de capa do card (Storage Supabase)
    criado_em   timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, plan_id)
);

-- 23. MAPA DE AÇÃO (MINDMAP) — Editor de mapa mental interativo com nós
create table if not exists mindmaps (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references users(id) on delete cascade not null,
    map_id      varchar(100) not null,               -- ID único gerado no frontend (ex: "map_abc123")
    title       varchar(255) not null,               -- Nome do mapa (ex: "Mudar de carreira")
    layout      varchar(50) default 'horizontal' not null, -- Direção do mapa: 'horizontal' | 'vertical'
    pan         jsonb default '{"x": 0, "y": 0}'::jsonb not null, -- Posição do canvas (pan x/y)
    scale       numeric(5, 2) default 1.00 not null, -- Nível de zoom do canvas
    nodes       jsonb default '[]'::jsonb not null,  -- Array de nós do mapa
    photo       text,                                -- URL da foto de capa do card
    criado_em   timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, map_id)
);

-- 24. CONTROLE DE VÍCIOS (ADDICTIONS) — Tracker de streak para controle de vícios
-- Cada entrada representa um vício que o usuário está monitorando.
-- O timer é calculado no frontend com base em started_at (início do período sem o vício).
create table if not exists addictions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid references users(id) on delete cascade not null,
    addiction_id  varchar(100) not null,             -- ID único gerado no frontend (ex: "add_abc123")
    nome          varchar(255) not null,             -- Nome do vício (ex: "Cigarro", "Redes sociais")
    desc_text     text,                              -- Descrição ou motivação do controle
    started_at    timestamp with time zone default timezone('utc'::text, now()) not null, -- Início do streak (resetado quando o usuário recai)
    criado_em     timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, addiction_id)
);

-- 25. TABELA DE CONTAS RECORRENTES (RECURRING BILLS)
create table if not exists recurring_bills (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    bill_id varchar(100) not null,
    descricao varchar(255) not null,
    valor numeric(10, 2) not null,
    dia integer not null,
    modo varchar(50) not null,
    fonte varchar(100),
    parcelas integer,
    parcelas_pagas integer default 0 not null,
    infinito boolean default false not null,
    mes_inicio varchar(20) not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, bill_id)
);

-- 26. TABELA DE CONFIGURAÇÕES FINANCEIRAS (FINANCE SETTINGS)
create table if not exists finance_settings (
    user_id uuid primary key references users(id) on delete cascade,
    inv_toggle_on boolean default false not null,
    inv_pct_mes numeric(5, 2) default 0.00 not null,
    inv_meta_aporte numeric(10, 2) default 0.00 not null,
    art_mode varchar(100) default 'padrao' not null,
    renda_fixa_cfg jsonb default null,
    art_presets jsonb default '[]'::jsonb not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 27. TABELA DE CONFIGURAÇÕES DE SAÚDE (HEALTH SETTINGS)
create table if not exists health_settings (
    user_id uuid primary key references users(id) on delete cascade,
    workout_weeks jsonb default '[]'::jsonb not null,
    diet_config jsonb default '{"days": [], "refeicoesPorDia": 3}'::jsonb not null,
    water_goal numeric(3, 1) default 2.0 not null,
    weight_goal numeric(4, 1) default null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 28. TABELA DE CONFIGURAÇÕES DE ESTUDOS (STUDY SETTINGS)
create table if not exists study_settings (
    user_id uuid primary key references users(id) on delete cascade,
    daily_goal_min integer default 120 not null,
    lifetime_stats jsonb default '{"totalMin": 0, "totalSessions": 0, "bestDayMin": 0, "activeDays": []}'::jsonb not null,
    pomodoros_today integer default 0 not null,
    pomodoro_date varchar(20) default '' not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 29. TABELA DE MATÉRIAS (STUDY TRACKS)
create table if not exists study_tracks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    track_id varchar(100) not null,
    name varchar(255) not null,
    icon text,
    description varchar(255),
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, track_id)
);

-- 30. TABELA DE ANOTAÇÕES DE ESTUDO (STUDY NOTES)
create table if not exists study_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    note_id varchar(100) not null,
    subject varchar(255),
    content text not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
    editado_em timestamp with time zone,
    unique(user_id, note_id)
);

-- 31. TABELA DE PLANOS DE ESTUDO (STUDY PLANS)
create table if not exists study_plans (
    user_id uuid references users(id) on delete cascade not null,
    track_id varchar(100) not null,
    modules jsonb default '[]'::jsonb not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key(user_id, track_id)
);

-- 32. TABELA DE PASTAS DE FOCO/FITNESS
create table if not exists foco_folders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    name varchar(255) not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, name)
);

-- 33. TABELA DE ROTINAS DE FOCO/FITNESS
create table if not exists foco_routines (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    name varchar(255) not null,
    duration_min integer default 0 not null,
    folder_id uuid references foco_folders(id) on delete set null,
    exercises jsonb default '[]'::jsonb not null,
    criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 34. TABELA DE CARDIO DE FOCO/FITNESS



-- 34. TABELA DE NOTAS
create table if not exists notes (
    id varchar(100) primary key,
    user_id uuid references users(id) on delete cascade not null,
    title varchar(255) default '' not null,
    body text default '' not null,
    tags jsonb default '[]'::jsonb not null,
    pinned boolean default false not null,
    deleted boolean default false not null,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Adicionar novas colunas de customização do perfil se não existirem
alter table users add column if not exists profile_bg_opacity integer default 30;
alter table users add column if not exists profile_page_bg_opacity integer default 18;


-- Tabela de sessões para controle stateful de Refresh Tokens
create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    refresh_token_hash varchar(255) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone not null,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone default timezone('utc'::text, now()) not null,
    ip_address varchar(45),
    user_agent text
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_refresh_token_hash on sessions(refresh_token_hash);
create index if not exists idx_sessions_expires_at on sessions(expires_at);
create index if not exists idx_sessions_revoked_at on sessions(revoked_at);


-- ==========================================
-- MIGRATION: migration_v2.sql
-- ==========================================

-- =======================================================
-- SQL MIGRATION V2 FOR MINSQ (SUPABASE POSTGRES)
-- Execute este script no SQL Editor do Supabase para atualizar a infraestrutura
-- =======================================================

-- 1. ADICIONAR COLUNAS DE CONTROLE DE SEGURANÇA E BAN NA TABELA DE USUÁRIOS
ALTER TABLE users ADD COLUMN IF NOT EXISTS banido BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspeito BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadowban BOOLEAN DEFAULT false NOT NULL;

-- 2. CRIAR TABELA PARA RELATÓRIOS DE BUGS (BUG TRACKER)
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'aberto' NOT NULL, -- aberto, investigando, resolvido
    gravidade VARCHAR(50) DEFAULT 'medio' NOT NULL, -- baixo, medio, alto, critico
    device_info JSONB, -- user-agent, route, screen resolution, etc.
    logs TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CRIAR TABELA DE CONFIGURAÇÃO DE SISTEMA (MODO MANUTENÇÃO)
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL
);

-- Inserir flag padrão para modo manutenção (desativado por padrão)
INSERT INTO system_config (key, value) 
VALUES ('maintenance_mode', 'false'::jsonb) 
ON CONFLICT (key) DO NOTHING;


-- ==========================================
-- MIGRATION: migration_profile.sql
-- ==========================================

-- =======================================================
-- MIGRATION FOR PROFILE AND CUSTOMIZATION COLUMNS ON USERS
-- Execute no Editor SQL do Supabase
-- =======================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social1 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS social2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_page_bg VARCHAR(50) DEFAULT 'default';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_page_bg_img TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_kout VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_font VARCHAR(50) DEFAULT 'dmsans';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bg VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_border VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_theme VARCHAR(50) DEFAULT 'default';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(50) DEFAULT 'initial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(512);

-- Adicionar número de conta autoincrementado (SERIAL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='account_number'
    ) THEN
        ALTER TABLE users ADD COLUMN account_number SERIAL;
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customization_json JSONB DEFAULT '{}'::jsonb;



-- ==========================================
-- MIGRATION: migration_metas_restore.sql
-- ==========================================

-- =======================================================
-- SQL MIGRATION FOR RESTORING METAS SCHEMA ALIGNMENT
-- Execute este script no SQL Editor do Supabase para corrigir a estrutura das tabelas
-- =======================================================

-- 1. Criar tabela plans_action (Planos de Ação)
CREATE TABLE IF NOT EXISTS plans_action (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    plan_id     VARCHAR(100) NOT NULL,               -- ID único do frontend (ex: "cat_123")
    name        VARCHAR(255) NOT NULL,               -- Nome do plano
    "desc"      TEXT,                                -- Descrição curta (texto do modal)
    desc_align  VARCHAR(20) DEFAULT 'center',        -- Alinhamento: 'left' | 'center'
    photo_url   TEXT,                                -- Capa do card
    criado_em   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, plan_id)
);

-- 2. Criar tabela mindmaps (Mapa de Ação / Mind Map Canvas)
CREATE TABLE IF NOT EXISTS mindmaps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    map_id      VARCHAR(100) NOT NULL,               -- ID único do frontend (ex: "map_123")
    title       VARCHAR(255) NOT NULL,               -- Título do mapa mental
    layout      VARCHAR(50) DEFAULT 'horizontal' NOT NULL, -- horizontal | vertical
    pan         JSONB DEFAULT '{"x": 0, "y": 0}'::JSONB NOT NULL, -- canvas pan
    scale       NUMERIC(5, 2) DEFAULT 1.00 NOT NULL, -- canvas zoom scale
    nodes       JSONB DEFAULT '[]'::JSONB NOT NULL,  -- nós do mapa mental
    photo       TEXT,                                -- URL do card
    criado_em   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, map_id)
);


-- ==========================================
-- MIGRATION: migration_admin_persistence.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS public.admin_security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT now(),
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL,
    ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_security_logs_timestamp ON public.admin_security_logs (timestamp DESC);

-- ==========================================
-- MIGRATION: migration_tasks_time.sql
-- ==========================================
-- Adicionar suporte a horários e durações nas tarefas diárias
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hora text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duracao text;
-- ==========================================
-- MIGRATION: migration_routines_dia_semana.sql
-- ==========================================
ALTER TABLE routines DROP COLUMN IF EXISTS descricao;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS dia_semana SMALLINT;

-- Tabela de logs de ações administrativas
CREATE TABLE admin_action_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    acao VARCHAR(255) NOT NULL,
    alvo VARCHAR(255),
    payload JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- MIGRATION: foco_custom_exercises
-- ==========================================
CREATE TABLE foco_custom_exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(46) NOT NULL,
  type VARCHAR(50) NOT NULL,
  muscles TEXT[] NOT NULL,
  photo_base64 TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE foco_custom_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus próprios exercícios" 
ON foco_custom_exercises FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários inserem apenas seus próprios exercícios" 
ON foco_custom_exercises FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários deletam apenas seus próprios exercícios" 
ON foco_custom_exercises FOR DELETE USING (auth.uid() = user_id);


-- ==========================================
-- MIGRATION: follows_and_counters.sql
-- ==========================================

-- Coluna de privacidade do perfil (fica desconectada da UI por enquanto)
ALTER TABLE users ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN NOT NULL DEFAULT true;

-- Contadores denormalizados
ALTER TABLE users ADD COLUMN IF NOT EXISTS seguidores_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seguindo_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      varchar(10) NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending','accepted')),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_followed_status ON follows(followed_id, status);
CREATE INDEX IF NOT EXISTS idx_follows_follower_status ON follows(follower_id, status);

CREATE OR REPLACE FUNCTION fn_follows_sync_counters() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' THEN
      UPDATE users SET seguindo_count = seguindo_count + 1 WHERE id = NEW.follower_id;
      UPDATE users SET seguidores_count = seguidores_count + 1 WHERE id = NEW.followed_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
      UPDATE users SET seguindo_count = seguindo_count + 1 WHERE id = NEW.follower_id;
      UPDATE users SET seguidores_count = seguidores_count + 1 WHERE id = NEW.followed_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN
      UPDATE users SET seguindo_count = GREATEST(seguindo_count - 1, 0) WHERE id = OLD.follower_id;
      UPDATE users SET seguidores_count = GREATEST(seguidores_count - 1, 0) WHERE id = OLD.followed_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_follows_sync_counters_ins ON follows;
CREATE TRIGGER trg_follows_sync_counters_ins AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION fn_follows_sync_counters();

DROP TRIGGER IF EXISTS trg_follows_sync_counters_upd ON follows;
CREATE TRIGGER trg_follows_sync_counters_upd AFTER UPDATE ON follows
  FOR EACH ROW EXECUTE FUNCTION fn_follows_sync_counters();

DROP TRIGGER IF EXISTS trg_follows_sync_counters_del ON follows;
CREATE TRIGGER trg_follows_sync_counters_del AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION fn_follows_sync_counters();

-- ============================================================================
-- 10. FEEDBACKS
-- ============================================================================
CREATE TABLE public.feedbacks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('bug', 'sugestao', 'elogio', 'outro')),
  mensagem text NOT NULL,
  estrelas integer CHECK (estrelas >= 1 AND estrelas <= 5),
  email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Segurança: apenas administradores (service_role) podem ler. Inserções podem ser feitas pelo backend via service_role.
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. DIRECT MESSAGES (SUPORTE)
-- ============================================================================
CREATE TABLE public.direct_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  mensagem text NOT NULL,
  email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Segurança: apenas administradores (service_role) podem ler as DMs. Inserções podem ser feitas pelo backend via service_role.

-- ============================================================================
-- 12. CONTROLE DE NOVOS DISPOSITIVOS / SUSPEITOS
-- ============================================================================

-- Adiciona a coluna de regiões/locais conhecidos para o usuário (para comparar com novos logins)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS known_locations JSONB DEFAULT '[]'::jsonb;

-- Tabela para registrar acessos revogados que o usuário marcou como "Não fui eu"
CREATE TABLE public.suspects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  ip_address varchar(45),
  user_agent text,
  location_data jsonb,
  reported_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  session_id uuid -- ID da sessão que foi revogada (se necessário rastrear)
);

CREATE INDEX IF NOT EXISTS idx_suspects_user_id ON public.suspects(user_id);
CREATE INDEX IF NOT EXISTS idx_suspects_ip ON public.suspects(ip_address);

-- Bloqueia acesso direto do Frontend (apenas Backend com Service Role pode acessar)
ALTER TABLE public.suspects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. ATUALIZAÇÕES DA TABELA USERS (Privacidade e Perfil Expandido)
-- ============================================================================
-- Adiciona colunas para os recursos de Privacidade Social
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS seguidores_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS seguindo_count INTEGER DEFAULT 0;

-- Adiciona colunas de localização e gênero
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS genero TEXT DEFAULT NULL;

-- Adiciona colunas para controle de segurança de senha
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pwd_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pwd_block_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pwd_changes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pwd_changes_month VARCHAR(7) DEFAULT NULL;

-- ============================================================================
-- 13. AUDITORIA DE USUÁRIOS SUSPEITOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_flags (
  -- ID único do registro de auditoria
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Vínculo com a tabela de usuários (Delete CASCADE apaga isso se o usuário for deletado)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Dados do usuário para visualização rápida no painel admin
  nome TEXT,
  email TEXT,
  handle TEXT, -- Esse é o '@'
  
  -- Nível de suspeita: 
  -- 0 = Normal / Limpo
  -- 1 = Básico (ex: mudou de nome várias vezes)
  -- 2 = Médio (em análise)
  -- 3 = Sugestão de Banimento (infração grave)
  nivel_suspeito INT DEFAULT 0 CHECK (nivel_suspeito IN (0, 1, 2, 3)),
  
  -- Status atual do usuário na plataforma
  status_ban VARCHAR(50) DEFAULT 'normal' CHECK (status_ban IN ('normal', 'temporario', 'permanente')),
  
  -- Informações extras de controle
  motivo TEXT, -- Opcional, para você ou o sistema escrever o motivo de ele estar no nível 2 ou 3
  penalidade_termina_em TIMESTAMP WITH TIME ZONE, -- Útil se o banimento for "temporario"
  
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index para o sistema achar rápido se um usuário está banido
CREATE INDEX IF NOT EXISTS idx_user_flags_userid ON user_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_flags_nivel ON user_flags(nivel_suspeito);

-- Adiciona controle de limite de códigos de recuperação de senha por dia
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS daily_recovery_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_recovery_date DATE DEFAULT NULL;

-- 1. Criar a nova tabela de cadastros pendentes
CREATE TABLE pendente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  verification_code TEXT NOT NULL,
  verification_code_expires_at TIMESTAMPTZ NOT NULL,
  code_attempts INTEGER DEFAULT 0,
  code_resends INTEGER DEFAULT 0,
  code_last_sent_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar o RLS (Row Level Security) na tabela
ALTER TABLE pendente ENABLE ROW LEVEL SECURITY;
-- Como nenhuma policy foi criada, qualquer requisição pública/anônima
-- será sumariamente rejeitada pelo banco. Apenas o servidor Node
-- tem autorização para ler/escrever nela.

-- 3. Limpar a coluna legada 'confirmado' da tabela users
-- Nota: Executar manualmente, pois não podemos garantir que a view não depende.
-- ALTER TABLE users DROP COLUMN IF EXISTS confirmado;



-- ==========================================
-- 001_sessions_grace_period.sql
-- ==========================================

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


-- ==========================================
-- 002_social_features.sql
-- ==========================================

-- Adiciona colunas para os recursos de Privacidade Social
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS seguidores_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS seguindo_count INTEGER DEFAULT 0;


-- ==========================================
-- 003_storage_tracking.sql
-- ==========================================

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


-- ==========================================
-- 004_users_indexes.sql
-- ==========================================

-- Migration 004: Adicionar índices de performance para a tabela users

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_banido ON users(banido);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);


-- ==========================================
-- 005_profile_limits.sql
-- ==========================================

-- Migration 005: Adiciona colunas para controle de edição de perfil

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS nome_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS nome_week VARCHAR(20) DEFAULT '',
ADD COLUMN IF NOT EXISTS handle_week VARCHAR(20) DEFAULT '',
ADD COLUMN IF NOT EXISTS bio_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bio_day VARCHAR(20) DEFAULT '';


-- ==========================================
-- 006_login_lockout.sql
-- ==========================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;


-- ==========================================
-- 007_verification_codes.sql
-- ==========================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP WITH TIME ZONE;


-- ==========================================
-- 008_onboarding.sql
-- ==========================================

-- Adiciona a coluna 'conheceu_por' para salvar a origem do usuário durante o onboarding
ALTER TABLE users ADD COLUMN IF NOT EXISTS conheceu_por VARCHAR(100);


-- ==========================================
-- 009_rotina_presets.sql
-- ==========================================

ALTER TABLE users ADD COLUMN rotina_preset SMALLINT DEFAULT 1;
ALTER TABLE routines ADD COLUMN preset SMALLINT DEFAULT 1;


-- ==========================================
-- 010_fix_increment_storage.sql
-- ==========================================

-- Fix for Achado #36: secure the increment_storage RPC
CREATE OR REPLACE FUNCTION increment_storage(user_id UUID, bytes_to_add BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent negative values
  IF bytes_to_add < 0 THEN
    RAISE EXCEPTION 'bytes_to_add must be positive';
  END IF;

  UPDATE users
  SET storage_bytes = storage_bytes + bytes_to_add
  WHERE id = user_id;
END;
$$;

-- Revoke public access, grant only to service_role
REVOKE ALL ON FUNCTION increment_storage(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_storage(UUID, BIGINT) TO service_role;


-- ==========================================
-- 011_remove_legacy_sha256.sql
-- ==========================================

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


-- ==========================================
-- 012_status_page_tables.sql
-- ==========================================

-- Migration 012: Tabelas para a página de Status (Incidentes, Manutenções e Avisos)

-- 1. Tabela de Manutenções Programadas
CREATE TABLE public.status_maintenances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    de VARCHAR(100) NOT NULL, -- ex: site, api, feed, etc.
    scheduled_date DATE NOT NULL, -- data com dia e mes
    time_window VARCHAR(100) NOT NULL, -- horario em formato livre ex: "02:00 – 04:00 (BRT)"
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Histórico de Incidentes
CREATE TABLE public.status_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    de VARCHAR(100) NOT NULL, -- ex: site, api, feed, etc.
    title VARCHAR(255) NOT NULL,
    incident_date DATE NOT NULL, -- data com dia mes e ano
    status VARCHAR(50) NOT NULL DEFAULT 'resolvendo', -- resolvido, resolvendo
    
    -- 6 colunas custom json para a hora e a descrição das atualizações
    update_1 JSONB,
    update_2 JSONB,
    update_3 JSONB,
    update_4 JSONB,
    update_5 JSONB,
    update_6 JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Notas e Avisos
CREATE TABLE public.status_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL DEFAULT 'nota', -- nota ou aviso
    name VARCHAR(255) NOT NULL,
    notice_date DATE NOT NULL, -- data, mes e ano
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Policies (RLS) - Permissões básicas
ALTER TABLE public.status_maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for status_maintenances" ON public.status_maintenances FOR SELECT USING (true);
CREATE POLICY "Public read access for status_incidents" ON public.status_incidents FOR SELECT USING (true);
CREATE POLICY "Public read access for status_notices" ON public.status_notices FOR SELECT USING (true);


-- ==========================================
-- 013_pre_hijack_fix.sql
-- ==========================================

ALTER TABLE pendente
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS nascimento DATE;


-- ==========================================
-- 014_code_attempts.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS code_attempts (
  ip_email TEXT PRIMARY KEY,
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS (Row Level Security) para segurança.
-- Como nenhuma política foi criada, por padrão TODAS as requisições do frontend (anon/auth) serão bloqueadas.
-- Apenas o backend (usando a service_role key) conseguirá ler e escrever nesta tabela, o que é o comportamento ideal.
ALTER TABLE code_attempts ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 015_atomic_code_attempts.sql
-- ==========================================

-- 015: contadores ATÔMICOS para tentativas de código.
--
-- Antes: o backend lia a tentativa, somava e escrevia (read-modify-write) com 3 retries e,
-- se perdesse a corrida nas 3, devolvia 1 (fail-open). Requisições concorrentes escapavam do limite.
-- Agora: uma única instrução SQL por tentativa (o Postgres trava a linha), sem retry no app.

-- 1) Tentativas por (ip|email) com lockout progressivo (30s, 1m, 2m, 5m, 15m).
--    Reseta para 1 quando o lockout já passou ou quando a última tentativa tem mais de 15 min.
CREATE OR REPLACE FUNCTION public.increment_code_attempt(p_key text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  INSERT INTO public.code_attempts AS c (ip_email, attempts, last_attempt_at)
  VALUES (p_key, 1, now())
  ON CONFLICT (ip_email) DO UPDATE
    SET attempts = CASE
          WHEN now() - c.last_attempt_at > interval '15 minutes' THEN 1
          WHEN c.attempts >= 5
               AND now() - c.last_attempt_at >
                   ((ARRAY[30, 60, 120, 300, 900])[LEAST(c.attempts - 5, 4) + 1] * interval '1 second')
            THEN 1
          ELSE c.attempts + 1
        END,
        last_attempt_at = now()
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts;
END;
$$;

-- 2) Teto GLOBAL por conta (independe de IP): conta quantos chutes errados o código atual já recebeu.
--    Quando passa do limite o backend invalida o código; a vítima só precisa pedir outro.
CREATE OR REPLACE FUNCTION public.bump_code_failures(p_table text, p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_table = 'pendente' THEN
    UPDATE public.pendente SET code_attempts = COALESCE(code_attempts, 0) + 1
    WHERE id = p_id RETURNING code_attempts INTO v_count;
  ELSIF p_table = 'users' THEN
    UPDATE public.users SET code_attempts = COALESCE(code_attempts, 0) + 1
    WHERE id = p_id RETURNING code_attempts INTO v_count;
  ELSE
    RAISE EXCEPTION 'tabela invalida';
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Funções no schema public ficam expostas em /rest/v1/rpc para o papel anon por padrão.
-- Só o backend (service_role) pode chamar estas duas.
REVOKE ALL ON FUNCTION public.increment_code_attempt(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_code_failures(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_code_attempt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_code_failures(text, uuid) TO service_role;

-- 3) Usuários criados pelo onboarding novo (sem senha) nasciam com confirmado=false.
--    Eles já provaram a posse do e-mail (código ou Google), então marca como confirmados.
--    Linhas legadas de /register (com senha) NÃO são tocadas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'confirmado') THEN
    UPDATE public.users SET confirmado = true WHERE confirmado = false AND senha IS NULL;
  END IF;
END $$;


-- ==========================================
-- 016_lock_public_api.sql
-- ==========================================

BEGIN;

-- 1) Tirar todo acesso de anon/authenticated às tabelas, sequências e funções
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 2) Garantir que o backend (service_role) continua com acesso total
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 3) Objetos criados no futuro também nascem fechados
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 4) Fixar o search_path da função SECURITY DEFINER (problema A3)
-- (Isso previne injeção de dependência e path hijacking dentro de funções restritas)
ALTER FUNCTION public.increment_storage(uuid, bigint) SET search_path = public;

-- 5) Limpeza de Policies: Remover policies USING (true) antigas (agora irrelevantes)
DROP POLICY IF EXISTS "Usuários podem ver perfis públicos"      ON public.users;
DROP POLICY IF EXISTS "Usuários só editam o próprio perfil"     ON public.users;
DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.users;
DROP POLICY IF EXISTS "Qualquer usuário logado pode ler conexões" ON public.follows;
DROP POLICY IF EXISTS "Qualquer usuário logado pode ler amizades" ON public.friendships;
DROP POLICY IF EXISTS "Usuários podem ver as academias"         ON public.gyms;
DROP POLICY IF EXISTS "Qualquer logado pode ver os planos"      ON public.plans;
DROP POLICY IF EXISTS "Qualquer um pode ler as configs"         ON public.system_config;

-- 6) Segurança extra: Garantir RLS como "negar por padrão" na camada anon
-- O backend (service_role) ignora RLS automaticamente.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pendente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

COMMIT;


-- ==========================================
-- 017_unique_lower_handle.sql
-- ==========================================

-- 017: Índice único case-insensitive para o @handle
-- Impede definitivamente que existam dois usuários com handles parecidos
-- ex: "@Victim" e "@victim". E acelera a busca (agora sem varredura em memória).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS users_lower_handle_idx ON public.users (lower(handle));

COMMIT;


-- ==========================================
-- 018_notes_composite_pk.sql
-- ==========================================

-- 018_notes_composite_pk.sql

BEGIN;

-- Remove the old primary key constraint (the name is usually notes_pkey)
ALTER TABLE notes DROP CONSTRAINT notes_pkey;

-- Add the new composite primary key (user_id, id)
ALTER TABLE notes ADD PRIMARY KEY (user_id, id);

COMMIT;


-- ==========================================
-- 019_storage_quota.sql
-- ==========================================

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_storage(user_id uuid, bytes_to_add bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET storage_bytes = GREATEST(0, storage_bytes + bytes_to_add) WHERE id = user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reserve_storage(p_user uuid, p_bytes bigint, p_limit bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET storage_bytes = storage_bytes + p_bytes
  WHERE id = p_user AND storage_bytes + p_bytes <= p_limit;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.increment_storage(uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_storage(uuid,bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_storage(uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_storage(uuid,bigint,bigint) TO service_role;

COMMIT;


-- ==========================================
-- 020_users_handle_norm_idx.sql
-- ==========================================

-- SELECT lower(ltrim(handle,'@')) AS h, count(*) FROM users
-- WHERE handle IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_norm_idx
ON public.users (lower(ltrim(handle, '@'))) WHERE handle IS NOT NULL;
