-- TEST HARNESS ONLY. Disposable PG17, not a migration/RPC or production adapter.
CREATE SCHEMA qa_2a;
REVOKE ALL ON SCHEMA qa_2a FROM PUBLIC;
CREATE TABLE qa_2a.sources(production text PRIMARY KEY,assembled integer NOT NULL,packed integer NOT NULL,revision integer NOT NULL DEFAULT 0,CHECK(assembled>=packed AND packed>=0));
CREATE TABLE qa_2a.requests(id uuid PRIMARY KEY,production text NOT NULL,signature jsonb NOT NULL,response jsonb NOT NULL);
CREATE FUNCTION qa_2a.consume(p_id uuid,p_key text,p_quantity integer,p_revision integer,p_shift integer) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE s qa_2a.sources%rowtype;r qa_2a.requests%rowtype;signature jsonb;response jsonb;
BEGIN
 signature:=jsonb_build_array('consume',p_key,p_quantity,p_revision,p_shift);
 -- Every turn of this production shares the SAME aggregate lock.
 SELECT * INTO STRICT s FROM qa_2a.sources WHERE production=p_key FOR UPDATE;
 SELECT * INTO r FROM qa_2a.requests WHERE id=p_id;
 IF FOUND THEN
 IF r.signature IS DISTINCT FROM signature THEN RAISE EXCEPTION 'IDEMPOTENCY_REUSED';END IF;
 RETURN r.response||jsonb_build_object('duplicate',true);
 END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_shift NOT IN (1,2) OR p_shift IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST';END IF;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF p_quantity>s.assembled-s.packed THEN RAISE EXCEPTION 'INSUFFICIENT_ELIGIBLE_UNITS';END IF;
 UPDATE qa_2a.sources SET packed=packed+p_quantity,revision=revision+1 WHERE production=p_key;
 response:=jsonb_build_object('available',s.assembled-s.packed-p_quantity,'revision',s.revision+1,'duplicate',false);
 INSERT INTO qa_2a.requests VALUES(p_id,p_key,signature,response);
 RETURN response;
END $$;
CREATE FUNCTION qa_2a.correct_assembly(p_key text,p_total integer,p_revision integer) RETURNS void
LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE s qa_2a.sources%rowtype;
BEGIN
 SELECT * INTO STRICT s FROM qa_2a.sources WHERE production=p_key FOR UPDATE;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT';END IF;
 IF p_total IS NULL OR p_total<s.packed THEN RAISE EXCEPTION 'CORRECTION_LEAVES_PACKING_UNBACKED';END IF;
 IF p_total>s.assembled THEN RAISE EXCEPTION 'NOT_DOWNWARD';END IF;
 UPDATE qa_2a.sources SET assembled=p_total,revision=revision+1 WHERE production=p_key;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA qa_2a FROM PUBLIC;
