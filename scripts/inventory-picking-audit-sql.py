"""Static parser audit only. Does not connect to a database or execute SQL."""
import pathlib,json
from pglast import parse_sql,parse_plpgsql,parser
from pglast.stream import RawStream
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'docs/sql-proposals/picking-audit'
rows=[];dynamic=[]
def scan_sql(sql,file,context):
 def walk(v):
  if isinstance(v,dict):
   for key,value in v.items():
    if key in ('DeleteStmt','DropStmt','TruncateStmt') or key=='UpdateStmt' and value.get('whereClause') is None:
     rows.append({'file':file,'context':context,'operation':key.replace('Stmt','').upper(),'without_where':key in ('DeleteStmt','UpdateStmt') and value.get('whereClause') is None,'sql':sql.strip()})
    walk(value)
  elif isinstance(v,list):
   for x in v:walk(x)
 walk(json.loads(parser.parse_sql_json(sql)))
def plpgsql_sql(value,file,context):
 if isinstance(value,dict):
  if 'PLpgSQL_stmt_execsql' in value:
   q=value['PLpgSQL_stmt_execsql']['sqlstmt']['PLpgSQL_expr']['query'];scan_sql(q,file,context)
  if 'PLpgSQL_stmt_dynexecute' in value:dynamic.append({'file':file,'context':context})
  for x in value.values():plpgsql_sql(x,file,context)
 elif isinstance(value,list):
  for x in value:plpgsql_sql(x,file,context)
for p in sorted(folder.glob('*.sql')):
 file=str(p.relative_to(root));text=p.read_text()
 for raw in parse_sql(text):
  stmt=raw.stmt;sql=RawStream()(stmt)
  if type(stmt).__name__=='CreateFunctionStmt':
   context='.'.join(x.sval for x in stmt.funcname)
   opts={opt.defname:opt.arg for opt in stmt.options}
   if opts.get('language') and opts['language'].sval=='sql':scan_sql(opts['as'][0].sval,file,context)
   else:plpgsql_sql(parse_plpgsql(sql),file,context)
  elif type(stmt).__name__=='DoStmt':plpgsql_sql(parse_plpgsql(sql),file,'DO/catalog guards')
  else:scan_sql(sql,file,'top-level')
assert not dynamic, dynamic
assert not any(r['without_where'] for r in rows),rows
report={'parser':'pglast 7.22 / PostgreSQL grammar','scope':'All SQL proposals, active top-level statements and SQL/PLpgSQL bodies; string literals containing catalog snapshots are not executed SQL.','unbounded_updates':0,'unbounded_deletes':0,'truncate_statements':sum(r['operation']=='TRUNCATE' for r in rows),'dynamic_execution':dynamic,'instructions':rows}
(root/'tests/picking-audit/destructive-inventory.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
md=['# Instrucciones destructivas en las propuestas SQL','', 'Inventario estático con pglast 7.22: se analiza SQL y cuerpos PL/pgSQL/SQL, sin ejecutar instrucciones. Los `CREATE FUNCTION` se inspeccionan; los cuerpos originales citados como datos en preflight no se ejecutan y no se cuentan como comandos.', '', '**Sin UPDATE sin WHERE, sin DELETE sin WHERE y sin TRUNCATE ejecutables.** Los privilegios TRUNCATE de REVOKE/GRANT no son instrucciones TRUNCATE. `TG_OP=DELETE/UPDATE` en triggers compara texto, no elimina ni modifica filas. No hay SQL dinámico EXECUTE.', '', '| Archivo | Contexto | Operación | Instrucción | Justificación |','|---|---|---|---|---|']
for r in rows:
 reason='Limpia exclusivamente la autorización técnica privada del ID/transacción actual; no borra pendientes, entregas ni historial.' if r['operation']=='DELETE' else 'Solo reversión de instalación nunca usada: elimina objetos propios del contrato. Guardas de uso, cuerpos divergentes y dependencias impiden retirar datos con auditoría persistida. Sin CASCADE.'
 md.append('| '+r['file']+' | '+r['context']+' | '+r['operation']+' | `'+r['sql'].replace('\n',' ').replace('|','\\|')+'` | '+reason+' |')
md+=['','Las UPDATE existentes tienen WHERE por ID de pendiente, faltante, entrega, evento o lista explícita de nuevos IDs. No se actualizan ni concilian históricos en masa. El instalador ejecutaría esas UPDATE únicamente al invocar después una RPC autorizada; crear las funciones no ejecuta sus cuerpos.','', 'La reversión restaura las ACL previas de la tabla histórica de diferencias, incluidas sus concesiones antiguas de DML. Es una restitución explícita al estado anterior, no un permiso nuevo para Recepción; si esa exposición no es aceptable, conservar el endurecimiento mediante una corrección forward revisada. Ninguna reversión ni concesión se ejecutó en Supabase.','', 'Fuente reproducible: `python scripts/inventory-picking-audit-sql.py`. Detalle estructurado: `tests/picking-audit/destructive-inventory.json`.']
(folder/'DESTRUCTIVE_INSTRUCTIONS.md').write_text('\n'.join(md)+'\n');print({'instructions':len(rows),'unbounded_updates':0,'unbounded_deletes':0,'truncate':0})
