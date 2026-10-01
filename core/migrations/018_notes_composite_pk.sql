-- 018_notes_composite_pk.sql

BEGIN;

-- Remove the old primary key constraint (the name is usually notes_pkey)
ALTER TABLE notes DROP CONSTRAINT notes_pkey;

-- Add the new composite primary key (user_id, id)
ALTER TABLE notes ADD PRIMARY KEY (user_id, id);

COMMIT;
