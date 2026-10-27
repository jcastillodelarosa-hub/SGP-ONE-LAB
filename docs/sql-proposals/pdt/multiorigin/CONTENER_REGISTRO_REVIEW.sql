-- Authorized incident response ONLY. No row deletion or closure/reader downgrade.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
-- Existing PDT v2 readers, processing, NC links and closure stay available.
NOTIFY pgrst,'reload schema';
COMMIT;
