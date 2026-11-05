-- REVIEW ONLY: non-destructive containment of this increment only.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
UPDATE sgp_lp_order_details.config SET writes=false WHERE id;
REVOKE EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb),public.sgp_lp_glass_nc_read_v1(text,text,text),public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text) FROM anon;
COMMIT;
-- History, notes, references, existing flags and permissions remain unchanged.
