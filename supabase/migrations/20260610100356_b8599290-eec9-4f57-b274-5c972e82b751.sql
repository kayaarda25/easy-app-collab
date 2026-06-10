
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS video_url text;

CREATE POLICY "Users can upload recommendation media to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recommendation-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read recommendation media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recommendation-media');

CREATE POLICY "Users can delete own recommendation media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'recommendation-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
