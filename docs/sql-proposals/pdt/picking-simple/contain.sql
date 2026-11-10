-- Safe containment, even after real use. Retains ledger, history, balances and closure guards.
BEGIN;
REVOKE ALL ON FUNCTION public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
-- Restore EXECUTE only after reviewing the incident and authorization.
