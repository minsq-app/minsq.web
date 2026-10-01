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
