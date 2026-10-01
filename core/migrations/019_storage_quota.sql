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
