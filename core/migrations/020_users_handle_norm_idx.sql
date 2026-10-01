-- SELECT lower(ltrim(handle,'@')) AS h, count(*) FROM users
-- WHERE handle IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_norm_idx
ON public.users (lower(ltrim(handle, '@'))) WHERE handle IS NOT NULL;
