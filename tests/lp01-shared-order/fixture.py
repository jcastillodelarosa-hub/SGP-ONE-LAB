from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'));import atomic as f
def setup():
 x=f.Fixture();db=x.db
 for name in ['01_definition_REVIEW.sql','02_glass_nc_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-order-details'/name).read_text())
 db.sql('CREATE TABLE public.sgp_nc_vidrio(consecutivo text PRIMARY KEY,estado_nc text,activo boolean NOT NULL,fecha_actualizacion timestamptz NOT NULL,orden text,orden_sap text,linea_afectada text);INSERT INTO public.sgp_nc_vidrio VALUES(\'NC-123\',\'FINALIZADA\',true,now(),\'Nombre distinto\',\'OVE distinto\',\'Texto no canónico\'),(\'NC-124\',\'ABIERTA\',false,now(),NULL,NULL,NULL)')
 db.sql('UPDATE sgp_lp_order_details.config SET writes=true;UPDATE sgp_lp_afectaciones.config SET writes=true;GRANT EXECUTE ON FUNCTION public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text),public.sgp_lp_glass_nc_read_v1(text,text,text) TO anon')
 c=x.command('CREATE',3,user='COORDINADOR',cause='NC_V')
 report=json.loads(db.sql("SET ROLE anon;SELECT public.sgp_lp_glass_nc_report_v1('COORDINADOR','QA|PANELES_2','ENSAMBLE','2026-11-01',1,"+f.lit(json.dumps(c))+"::jsonb,'NC-123')"))['reportId']
 return x,report
