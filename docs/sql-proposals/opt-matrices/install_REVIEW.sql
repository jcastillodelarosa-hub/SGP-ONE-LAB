-- PROPOSAL ONLY. Requires explicit production application and private asset upload approval.
-- Does not change existing OPT data, role lists, sessions or storage permissions.
BEGIN;
CREATE SCHEMA sgp_opt_matrices;
REVOKE ALL ON SCHEMA sgp_opt_matrices FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_opt_matrices.config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO sgp_opt_matrices.config DEFAULT VALUES;
CREATE TABLE sgp_opt_matrices.documents (
 sha256 text PRIMARY KEY CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 source_locator text NOT NULL CHECK(length(source_locator) BETWEEN 1 AND 1000),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
 pages integer NOT NULL CHECK(pages BETWEEN 1 AND 10000),
 imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sgp_opt_matrices.entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sistema text NOT NULL CHECK(length(sistema) BETWEEN 1 AND 100 AND sistema=btrim(sistema)),
 referencia text NOT NULL CHECK(length(referencia) BETWEEN 1 AND 100 AND referencia=btrim(referencia)),
 revision text NOT NULL CHECK(length(revision) BETWEEN 1 AND 100 AND revision=btrim(revision)),
 source_sha256 text NOT NULL REFERENCES sgp_opt_matrices.documents(sha256),
 source_page integer NOT NULL CHECK(source_page BETWEEN 1 AND 10000),
 image_sha256 text NOT NULL CHECK(image_sha256 ~ '^[a-f0-9]{64}$'),
 image_bytes integer NOT NULL CHECK(image_bytes BETWEEN 25 AND 4194304),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','RETIRED')),
 review_evidence text,
 reviewed_by text,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'APPROVED' OR (review_evidence IS NOT NULL AND reviewed_by IS NOT NULL AND length(btrim(review_evidence))>0 AND length(btrim(reviewed_by))>0 AND reviewed_at IS NOT NULL)),
 UNIQUE(sistema,referencia,source_sha256,source_page,image_sha256)
);
CREATE INDEX matrix_exact_lookup ON sgp_opt_matrices.entries(sistema,referencia) WHERE status<>'RETIRED';
CREATE FUNCTION sgp_opt_matrices.check_page() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.source_page>(SELECT pages FROM sgp_opt_matrices.documents WHERE sha256=NEW.source_sha256) THEN RAISE EXCEPTION 'MATRIX_PAGE_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER matrix_page BEFORE INSERT OR UPDATE ON sgp_opt_matrices.entries FOR EACH ROW EXECUTE FUNCTION sgp_opt_matrices.check_page();
ALTER TABLE sgp_opt_matrices.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_opt_matrices.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_opt_matrices.entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_opt_matrices FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_opt_matrices FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sgp_opt_matriz_resolver_v1(p_token text,p_sistema text,p_referencia text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer; m sgp_opt_matrices.entries; state text; result jsonb;
BEGIN
 -- Existing feature/role/access checks remain authoritative and are not duplicated or expanded.
 PERFORM sgp_opt_shared.actor(p_token,false);
 IF NOT coalesce((SELECT enabled FROM sgp_opt_matrices.config WHERE singleton),false) THEN RAISE EXCEPTION 'MATRIX_NO_HABILITADO'; END IF;
 IF p_sistema IS NULL OR p_referencia IS NULL OR length(p_sistema) NOT BETWEEN 1 AND 100 OR length(p_referencia) NOT BETWEEN 1 AND 100 OR p_sistema<>btrim(p_sistema) OR p_referencia<>btrim(p_referencia) OR p_sistema ~ '[[:cntrl:]]' OR p_referencia ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'MATRIX_QUERY_INVALID'; END IF;
 -- Exact pair only. Pending conflicting candidates also block a silent choice.
 SELECT count(*) INTO n FROM sgp_opt_matrices.entries WHERE sistema=p_sistema AND referencia=p_referencia AND status<>'RETIRED';
 IF n=0 THEN state:='unavailable';
 ELSIF n>1 THEN state:='ambiguous';
 ELSE
  SELECT * INTO STRICT m FROM sgp_opt_matrices.entries WHERE sistema=p_sistema AND referencia=p_referencia AND status<>'RETIRED';
  IF m.status<>'APPROVED' THEN state:='unavailable'; ELSE state:='available'; END IF;
 END IF;
 IF state='available' THEN
  result:=jsonb_build_object('id',m.id,'revision',m.revision,'page',m.source_page,'sourceSha256',m.source_sha256,'imageSha256',m.image_sha256,'byteLength',m.image_bytes,'mimeType','image/png','bucket','opt-matrices-private','objectPath','images/'||m.image_sha256||'.png');
 END IF;
 RETURN jsonb_build_object('contract','OPT-MATRIX-1','status',state,'sistema',p_sistema,'referencia',p_referencia,'matrix',result);
END $$;
REVOKE ALL ON FUNCTION public.sgp_opt_matriz_resolver_v1(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_opt_matriz_resolver_v1(text,text,text) TO service_role;
COMMIT;
