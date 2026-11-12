-- PROPOSAL ONLY. Apply only after explicit private storage approval.
-- No public policy, signed URL, object contents, or modification to another bucket.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='opt-matrices-private') THEN
  RAISE EXCEPTION 'MATRIX_BUCKET_ALREADY_EXISTS_REVIEW_REQUIRED';
 END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('opt-matrices-private','opt-matrices-private',false,4194304,ARRAY['image/png']);
COMMIT;
