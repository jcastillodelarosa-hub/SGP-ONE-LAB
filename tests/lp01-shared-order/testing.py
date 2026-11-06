"""Synthetic-only helpers for existing controller acceptance; no production connections."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
RPCS={'sgp_lp_shared_order_read_v1','sgp_lp_shared_order_command_v1','sgp_lp_shared_nc_lookup_v1','sgp_lp_order_details_read_v1','sgp_lp_order_note_save_v1'}
def install(db):
 for name in ['01_definition_REVIEW.sql','02_glass_nc_REVIEW.sql']:db.sql((ROOT/'docs/sql-proposals/lp01-order-details'/name).read_text())
 db.sql('CREATE TABLE public.sgp_nc_vidrio(consecutivo text PRIMARY KEY,estado_nc text,activo boolean NOT NULL,fecha_actualizacion timestamptz NOT NULL,orden text,linea_afectada text);CREATE TABLE public.sgp_accesorios(id_accesorio text PRIMARY KEY,key_produccion text,codigo_sap text,descripcion text,cantidad numeric,unidad text)')
 db.sql((ROOT/'docs/sql-proposals/lp01-shared-order/01_definition_REVIEW.sql').read_text())
 db.sql((ROOT/'docs/sql-proposals/lp01-shared-order/02_activate_REVIEW.sql').read_text())
 db.sql('GRANT EXECUTE ON FUNCTION public.sgp_lp_order_details_read_v1(text,text,text),public.sgp_lp_order_note_save_v1(text,text,text,jsonb) TO anon;UPDATE sgp_lp_order_details.config SET writes=true')
def rpc(db,name,args):
 assert name in RPCS
 def lit(v):return "'"+str(v).replace("'","''")+"'"
 parts=[]
 for k,v in args.items():
  assert k in ['p_token','p_key','p_stage','p_cmd','p_reference']
  parts.append(k+'=>'+(lit(json.dumps(v))+'::jsonb' if isinstance(v,dict) else lit(v)))
 return json.loads(db.sql('SET ROLE anon;SELECT public.'+name+'('+','.join(parts)+')'))
