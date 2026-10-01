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
