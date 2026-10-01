-- 017: Índice único case-insensitive para o @handle
-- Impede definitivamente que existam dois usuários com handles parecidos
-- ex: "@Victim" e "@victim". E acelera a busca (agora sem varredura em memória).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS users_lower_handle_idx ON public.users (lower(handle));

COMMIT;
