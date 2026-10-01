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
