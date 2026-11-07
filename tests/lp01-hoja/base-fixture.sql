-- Synthetic fixture schema and unchanged root helper from main75b05b8 SQL01. No production connection.
CREATE SCHEMA sgp_lp_operacion;
REVOKE ALL ON SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_lp_operacion.config(id boolean PRIMARY KEY DEFAULT true CHECK(id),escrituras boolean NOT NULL DEFAULT false,formato_bi_aprobado boolean NOT NULL DEFAULT false,adaptador_bi text NOT NULL DEFAULT 'LP-PBI-XLSX-1' CHECK(adaptador_bi IN('LP-PBI-XLSX-1','CSV-QA')));
INSERT INTO sgp_lp_operacion.config VALUES(true,false,false,'LP-PBI-XLSX-1');
-- Sin permisos implícitos por rol: administración configura ámbitos después de aprobación.
CREATE TABLE sgp_lp_operacion.permisos(usuario text NOT NULL,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),PRIMARY KEY(usuario,etapa,key));
CREATE TABLE sgp_lp_operacion.turnos(linea text NOT NULL,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),fecha date NOT NULL,turno int NOT NULL CHECK(turno IN(1,2)),estado text NOT NULL DEFAULT 'ABIERTO' CHECK(estado IN('ABIERTO','CERRADO','EN_REVISION')),revision bigint NOT NULL DEFAULT 0,capacidad bigint CHECK(capacidad>=0),PRIMARY KEY(etapa,linea,fecha,turno));
CREATE TABLE sgp_lp_operacion.ordenes(linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),parte uuid NOT NULL REFERENCES public.sgp_linea_plan_asignaciones(id),sale bigint CHECK(sale>=0),ejecutado bigint NOT NULL DEFAULT 0 CHECK(ejecutado>=0),prioridad int,origen_fecha date,origen_turno int,revision bigint NOT NULL DEFAULT 0,afectaciones jsonb NOT NULL DEFAULT '{}',consolidado bigint CHECK(consolidado>=0),validado boolean NOT NULL DEFAULT false,observacion text NOT NULL DEFAULT '',antiguedad_fecha date,antiguedad_turno int,contexto_origen jsonb NOT NULL DEFAULT '{}',apertura_id uuid,sale_fuente text NOT NULL DEFAULT 'PENDIENTE',sale_estado text NOT NULL DEFAULT 'POR_VALIDAR',PRIMARY KEY(etapa,linea,fecha,turno,key,parte),FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.turnos);
-- Presupuesto local conservador: el Export no se descuenta dos veces.
CREATE TABLE sgp_lp_operacion.presupuestos(key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),firma jsonb NOT NULL,base bigint NOT NULL CHECK(base>=0),PRIMARY KEY(key,etapa));
CREATE TABLE sgp_lp_operacion.auditoria(id uuid PRIMARY KEY,usuario text NOT NULL,operacion text NOT NULL,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,key text,parte uuid,payload jsonb NOT NULL,antes jsonb,respuesta jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE sgp_lp_operacion.archivos(id uuid PRIMARY KEY,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,nombre text NOT NULL,sha256 text NOT NULL,contenido text NOT NULL,contenido_binario bytea,adaptador text NOT NULL DEFAULT 'CSV-QA' CHECK(adaptador IN('CSV-QA','LP-PBI-XLSX-1')),evidencia jsonb NOT NULL DEFAULT '{}',filas jsonb NOT NULL,usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(etapa,linea,fecha,turno,sha256));
CREATE TABLE sgp_lp_operacion.cierres(id uuid PRIMARY KEY,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,version bigint NOT NULL,archivo uuid REFERENCES sgp_lp_operacion.archivos,tipo text NOT NULL DEFAULT 'CON_ACTIVIDAD' CHECK(tipo IN('CON_ACTIVIDAD','SIN_ACTIVIDAD')),CHECK((tipo='SIN_ACTIVIDAD' AND archivo IS NULL) OR(tipo='CON_ACTIVIDAD' AND archivo IS NOT NULL)),snapshot jsonb NOT NULL,usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(etapa,linea,fecha,turno,version));
CREATE TABLE sgp_lp_operacion.notificaciones(id uuid PRIMARY KEY,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,key text NOT NULL,parte uuid NOT NULL,anterior bigint,nuevo bigint NOT NULL,motivo text NOT NULL,usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
-- Liberaciones: solamente puente servidor con evidencia de ventanas consolidada.
-- No hay RPC que acepte del navegador pruebas PDT o cantidades liberadas.
CREATE TABLE sgp_lp_operacion.liberaciones(id uuid PRIMARY KEY,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),ventanas bigint NOT NULL CHECK(ventanas>0),evidencia jsonb NOT NULL CHECK(evidencia<>'{}'),consolidado boolean NOT NULL DEFAULT false,consumido_por uuid UNIQUE);
CREATE INDEX ordenes_por_parte ON sgp_lp_operacion.ordenes(key,etapa,parte,fecha DESC,turno DESC);
CREATE INDEX historial_por_turno ON sgp_lp_operacion.auditoria(etapa,linea,fecha,turno,creado_en);
CREATE INDEX notificaciones_por_turno ON sgp_lp_operacion.notificaciones(etapa,linea,fecha,turno,creado_en);
CREATE FUNCTION sgp_lp_operacion.raiz(asignacion uuid,k text) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actual uuid:=asignacion;siguiente uuid;seen uuid[]:='{}'; BEGIN LOOP
 IF actual=ANY(seen) OR cardinality(seen)>128 THEN RAISE EXCEPTION 'ORIGEN_PROGRAMACION_CICLICO'; END IF;
 seen:=array_append(seen,actual);
 SELECT origen_id INTO siguiente FROM public.sgp_linea_plan_asignaciones WHERE id=actual AND key_produccion=k;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORIGEN_PROGRAMACION_AJENO'; END IF;
 IF siguiente IS NULL THEN RETURN actual; END IF;actual:=siguiente;
 END LOOP; END $$;