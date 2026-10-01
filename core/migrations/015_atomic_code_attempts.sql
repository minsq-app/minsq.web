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
