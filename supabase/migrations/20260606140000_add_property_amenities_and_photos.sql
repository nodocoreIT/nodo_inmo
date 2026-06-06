ALTER TABLE nodo_inmo.properties
  ADD COLUMN bathrooms integer,
  ADD COLUMN has_pool boolean NOT NULL DEFAULT false,
  ADD COLUMN pets_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN has_garage boolean NOT NULL DEFAULT false,
  ADD COLUMN has_garden boolean NOT NULL DEFAULT false,
  ADD COLUMN has_laundry boolean NOT NULL DEFAULT false,
  ADD COLUMN has_bbq boolean NOT NULL DEFAULT false,
  ADD COLUMN has_elevator boolean NOT NULL DEFAULT false,
  ADD COLUMN has_parking boolean NOT NULL DEFAULT false;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "property_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM shared.org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "property_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM shared.org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "property_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM shared.org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "property_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM shared.org_members WHERE user_id = auth.uid()
  ));
