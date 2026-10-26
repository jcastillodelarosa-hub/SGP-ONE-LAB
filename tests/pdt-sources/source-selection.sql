-- Synthetic fixture only, running in a new networkless QA database.
ALTER TABLE public.sgp_aluminio_pendientes ADD COLUMN contrato_pdt text DEFAULT 'LEGACY';
ALTER TABLE public.sgp_producciones ADD COLUMN id text, ADD COLUMN id_linea text;
INSERT INTO public.sgp_producciones(key_produccion,produccion,sistema,id,id_linea) VALUES
 ('QA|FRAMES_2','QA ORDER','ES-EL400','QA','FRAMES_2'),
 ('QA|PANELES_2','QA ORDER','ES-EL400','QA','PANELES_2'),
 ('OTHER|PANELES_2','QA ORDER','ES-EL400','OTHER','PANELES_2'),
 ('QA|OTHER','QA ORDER','ES-EL400','QA','OTHER'),
 ('QA|NO_RESERVATION','QA ORDER','ES-EL400','QA','PANELES_2');
INSERT INTO public.qa_reservas VALUES('QA|FRAMES_2','QA-RES','DS'),('QA|PANELES_2','QA-RES','DS');
INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente,nc)
 VALUES('00000000-0000-0000-0000-000000000099','QA|FRAMES_2','QA ORDER','REF',9,'QA-RES','DS','QA-NC');
INSERT INTO public.sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad)
 SELECT 'fixture:'||n,'fixture-load',n,'QA|PANELES_2','QA ORDER','REF','ES-EL400','SI','PANEL',CASE WHEN n%2=0 THEN 'E17' ELSE 'E17-1' END,109.9375,'DS',CASE WHEN n<=2 THEN 13 ELSE 8 END FROM generate_series(1,4) n;
-- Negative candidates cannot enter just because their production name matches.
INSERT INTO public.sgp_aluminio SELECT 'bad-id',id_carga,90,'OTHER|PANELES_2',produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-system',id_carga,91,key_produccion,produccion,codigo_sap,'FOREIGN',activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-finish',id_carga,92,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,'WHITE',cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-ref',id_carga,93,key_produccion,produccion,'OTHER',sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-type',id_carga,94,key_produccion,produccion,codigo_sap,sistema,activo,'FRAME',fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-active',id_carga,95,key_produccion,produccion,codigo_sap,sistema,'NO',tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-reserve',id_carga,96,'QA|NO_RESERVATION',produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
INSERT INTO public.sgp_aluminio SELECT 'bad-line',id_carga,97,'QA|OTHER',produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';

INSERT INTO public.sgp_aluminio SELECT 'bad-name',id_carga,98,key_produccion,'FOREIGN ORDER',codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM public.sgp_aluminio WHERE id_pieza='fixture:1';
