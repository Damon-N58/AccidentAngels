-- ==============================================================
-- Supabase Storage: bucket creation + RLS policies
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ==============================================================

-- 1. Compliance documents bucket (private — only admins and the
--    uploading driver can read; driver can insert/update their own)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-docs',
  'compliance-docs',
  false,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Contracts bucket (public — accessible via signed or public URLs
--    so parents can view signed contracts without authentication)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  true,
  20971520, -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------
-- RLS policies for compliance-docs
-- --------------------------------------------------------------

-- Allow service-role / admin full access
CREATE POLICY "service_role_all" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id IN ('compliance-docs', 'contracts'))
  WITH CHECK (bucket_id IN ('compliance-docs', 'contracts'));

-- Authenticated users can insert into compliance-docs
CREATE POLICY "authenticated_insert_compliance" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'compliance-docs');

-- Authenticated users can read their own compliance docs
-- The folder structure should be: compliance-docs/{userId}/{fileName}
CREATE POLICY "authenticated_read_own_compliance" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'compliance-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------------
-- RLS policies for contracts (public bucket)
-- --------------------------------------------------------------

-- Anyone can read contracts (bucket is public)
CREATE POLICY "public_read_contracts" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'contracts');

-- Authenticated users can insert contracts
CREATE POLICY "authenticated_insert_contracts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contracts');
