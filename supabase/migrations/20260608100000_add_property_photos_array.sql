alter table nodo_inmo.properties
  add column if not exists photos text[] not null default '{}';

-- Backfill: si ya tiene main_photo, incluirla en el array
update nodo_inmo.properties
set photos = array[main_photo]
where main_photo is not null and array_length(photos, 1) is null;
