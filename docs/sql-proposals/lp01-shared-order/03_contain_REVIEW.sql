-- REVIEW ONLY. Non-destructive containment; no historical permissions changed.
BEGIN;
UPDATE sgp_lp_shared_order.config SET writes=false WHERE id;
REVOKE EXECUTE ON FUNCTION public.sgp_lp_shared_order_read_v1(text,text,text),public.sgp_lp_shared_order_command_v1(text,text,text,jsonb),public.sgp_lp_shared_nc_lookup_v1(text,text,text,text) FROM anon;
COMMIT;
