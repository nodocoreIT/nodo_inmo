ALTER TABLE nodo_inmo.properties
  ADD COLUMN IF NOT EXISTS localidad text,
  ADD COLUMN IF NOT EXISTS provincia text;
