from pathlib import Path
import re,json,hashlib
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).parent
s=(ROOT/'tests/lp01-incorporar/pglite.mjs').read_text().split(' const command=')[0]
pattern=re.compile(r" await sql\(`(.*?)`\);| await sql\(await read\('([^']+)'\)\);| for\(const f of \[(.*?)\]\)await sql\(await read\('([^']+)'\+f\+'\.sql'\)\);",re.S)
parts=[]
for m in pattern.finditer(s):
 if m.group(1) is not None:
  sql=m.group(1).replace('${identity}','public.sgp_lp_operacion_consultar(text,text,text,date,integer)')
  assert '${' not in sql
  sql=sql.rstrip(' \t')  # Remove trailing template indentation, not SQL body whitespace.
  parts.append(sql)
 elif m.group(2):parts.append((ROOT/m.group(2)).read_text())
 else:
  for name in re.findall(r"'([^']+)'",m.group(3)):parts.append((ROOT/(m.group(4)+name+'.sql')).read_text())
assert len(parts)==29,len(parts)
parts += ["""ALTER TABLE public.sgp_linea_plan_asignaciones ALTER COLUMN id SET DEFAULT gen_random_uuid(),ALTER COLUMN estado SET DEFAULT 'PROGRAMADA',ADD COLUMN actualizado_en timestamptz DEFAULT now();
CREATE TABLE public.sgp_linea_plan_ejecuciones(asignacion_id uuid,cantidad integer);
INSERT INTO public.sgp_producciones SELECT key,'QA concurrency',id_linea,sistema,reserva_al,cantidad,activa,estado_produccion,anio,semana_base,semana_actual,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export FROM public.sgp_producciones CROSS JOIN (VALUES('QA-A|PANELES_2'),('QA-B|PANELES_2')) keys(key) WHERE key_produccion='OTHER|PANELES_2';
"""]
for name in ['sgp_validar_sesion_rol','sgp_linea_plan_programar','sgp_linea_plan_mover']:parts.append((HERE/f'production-readonly/{name}.sql').read_text())
parts += ["REVOKE ALL ON FUNCTION public.sgp_linea_plan_programar(text,text,date,integer,integer,integer),public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.sgp_linea_plan_programar(text,text,date,integer,integer,integer),public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer) TO anon;"]
fixture='-- SYNTHETIC ONLY. Derived from passing PGlite setup and real captured bodies.\n-- Use only in the ephemeral no-network database controlled by the harness.\n'+'\n;\n'.join(parts)+'\n;\n'
(HERE/'fixture.sql').write_text(fixture)
(HERE/'fixture-manifest.json').write_text(json.dumps({'fixture_sha256':hashlib.sha256(fixture.encode()).hexdigest(),'source':'Existing PGlite setup + captured real session/permission/command/planner functions. All user/production rows synthetic.','parts':len(parts)},indent=2)+'\n')
print('Built',len(parts),'isolated SQL sections')
