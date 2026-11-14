"""Local lock-load experiment; private payloads remain outside source control.
Usage: script OWNED_CONTAINER SNAPSHOT PAYLOAD_A PAYLOAD_B
Uses real candidate SQL/geometry receiver, production cardinalities, synthetic filler.
No production writes or hosted resources. Caller must remove owned container.
"""
import concurrent.futures,json,re,runpy,subprocess,sys,time,queue,threading
from pathlib import Path
root=Path(__file__).resolve().parents[1]
setup=runpy.run_path(str(root/'scripts/profile-opt-retail-sql-local.py'),init_globals={'PROFILE_PREPARE_ONLY':True})
container=setup['container'];cases=setup['prepared'];db=cases[0]['db'];call=cases[0]['call']
def command(q):
 return ['docker','exec','-i',container,'psql','-X','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'],q

def query(q):
 cmd,body=command(q);r=subprocess.run(cmd,input=body,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Local fixture query failed: '+r.stderr[-200:])
 return r.stdout.strip()

def start(q):
 cmd,body=command(q);p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);p.stdin.write(body);p.stdin.close();return p

def finish(p):
 p.wait(timeout=30);out=p.stdout.read();err=p.stderr.read();m=re.findall(r'Time: ([0-9.]+) ms',out)
 return {'ok':p.returncode==0,'sqlMs':float(m[-1]) if m else None,'busy':'OPT_CONTEXTO_OCUPADO' in err,'lockTimeout':'lock timeout' in err}
# Same relevant indexes as observed; fixture omits unrelated columns/triggers/RLS.
query('CREATE INDEX profile_load_id ON public.sgp_producciones(id);CREATE UNIQUE INDEX profile_load_detail ON public.sgp_mecanizado_programacion_detalle(id_programacion,key_produccion);')
related=query('SELECT id_programacion FROM public.sgp_mecanizado_programacion LIMIT 1;')
base={'productions':1386,'programs':178,'details':448,'profiles':236}
class Session:
 def __init__(self,name):
  cmd,_=command('');self.p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1);self.lines=queue.Queue()
  def drain():
   for line in self.p.stdout:self.lines.put(line)
  threading.Thread(target=drain,daemon=True).start()
  self.send("SET application_name='"+name+"';\\timing on")
  self.read()
 def send(self,q):self.p.stdin.write(q+'\n\\echo __END__\n');self.p.stdin.flush()
 def read(self):
  lines=[]
  while True:
   line=self.lines.get(timeout=30)
   if line.strip()=='__END__':return ''.join(lines)
   lines.append(line)
 def run(self,q):self.send(q);return self.read()
 def close(self):self.p.stdin.write('\\q\n');self.p.stdin.flush();self.p.wait(timeout=5)
observer=Session('retail_load_observer');importer=Session('retail_load_import');writers=[Session('retail_load_dml') for _ in range(8)]
def stats(out):
 m=re.findall(r'Time: ([0-9.]+) ms',out)
 return {'ok':True,'sqlMs':float(m[-1]) if m else None}
results=[]
for factor in [1,10]:
 for table,col,target,statement in [
  ('sgp_producciones','key_produccion',base['productions']*factor,"INSERT INTO public.sgp_producciones SELECT 'LOAD-'||g,'LOAD-'||g,'FRAMES_2','LOAD-R-'||g,'LOAD-S',2099,1,'SI',false,'LOAD LABEL '||g FROM generate_series({start},{end}) g"),
  ('sgp_mecanizado_programacion','id_programacion',base['programs']*factor,"INSERT INTO public.sgp_mecanizado_programacion SELECT md5('LOAD-P-'||g)::uuid,'LOAD-R-'||g,'SIN INICIAR' FROM generate_series({start},{end}) g"),
  ('sgp_maestro_piezas','codigo_sap',base['profiles']*factor,"INSERT INTO public.sgp_maestro_piezas SELECT 'LOAD-REF-'||g,'PANEL','PANEL','SI' FROM generate_series({start},{end}) g")]:
  n=int(query('SELECT count(*) FROM public.'+table));query(statement.format(start=n+1,end=target)+';')
 n=int(query('SELECT count(*) FROM public.sgp_mecanizado_programacion_detalle'))
 query("INSERT INTO public.sgp_mecanizado_programacion_detalle SELECT md5('LOAD-P-'|| (100+(g%50)))::uuid,'LOAD-'|| (100+g),'LOAD-R-'||g,1 FROM generate_series("+str(n+1)+','+str(base['details']*factor)+") g;ANALYZE;")
 unrelated=query("SELECT id_programacion FROM public.sgp_mecanizado_programacion WHERE reserva LIKE 'LOAD-%' ORDER BY reserva LIMIT 8;").splitlines()
 for target in ['related','unrelated','burst_8']:
  # Three natural attempts: no delay inside import or artificial post-call hold.
  for trial in range(3):
   importer.send(call)
   seen=False
   for poll in range(1000):
    observed=observer.run("SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='retail_load_import' AND l.relation='public.sgp_mecanizado_programacion'::regclass AND l.mode='ShareLock' AND l.granted;").splitlines()
    if '1' in observed:seen=True;break
    if not importer.lines.empty():
     # Output receipt means statement finished; never add a synthetic lock hold.
     break
   keys=[related] if target=='related' else unrelated[:1] if target=='unrelated' else [related,*unrelated[:7]]
   for writer,key in zip(writers,keys):writer.send("UPDATE public.sgp_mecanizado_programacion SET estado=estado WHERE id_programacion='"+key+"';")
   observed=observer.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='retail_load_dml' AND wait_event_type='Lock';").splitlines()
   waiting=any(x.isdigit() and int(x)>0 for x in observed)
   ar=stats(importer.read());br=[stats(writer.read()) for writer in writers[:len(keys)]]
   assert ar['sqlMs'] is not None and all(b['sqlMs'] is not None for b in br)
   results.append({'scale':factor,'target':target,'trial':trial,'importShareObserved':seen,'dmlLockWaitObserved':waiting,'import':ar,'dml':br})
controls=[]
for _ in range(6):
 controls.append(stats(writers[0].run("UPDATE public.sgp_mecanizado_programacion SET estado=estado WHERE id_programacion='"+unrelated[0]+"';"))['sqlMs'])
for session in [observer,importer,*writers]:session.close()
# Negative direction: pre-existing unrelated DML. Barrier ONLY to establish ordering,
# excluded from timing claims. NOWAIT must reject atomically, no new receipt.
holder=start("SET application_name='retail_load_holder';BEGIN;UPDATE public.sgp_mecanizado_programacion SET estado=estado WHERE id_programacion='"+unrelated[0]+"';SELECT pg_sleep(1);ROLLBACK;\n")
for _ in range(100):
 if query("SELECT count(*) FROM pg_stat_activity WHERE application_name='retail_load_holder' AND wait_event='PgSleep';")=='1':break
before=query('SELECT count(*) FROM sgp_opt_shared.documents;')
busy=finish(start('\\timing on\n'+call+'\n'));finish(holder)
assert busy['busy'] and not busy['ok']
assert before==query('SELECT count(*) FROM sgp_opt_shared.documents;')
assert query('SELECT count(*) FROM sgp_opt_shared.cuts;')=='0'
print(json.dumps({'engine':'PostgreSQL17.11','productionWrites':0,'baseCardinalities':base,'scaleFactors':[1,10],'payloadPieces':255,'payloadPlans':59,'naturalImportNoInjectedDelay':True,'results':results,'preexistingUnrelatedWriter':busy,'uncontendedUnrelatedDmlSqlMs':controls,'limits':'Cardinality-matched synthetic context rows, private original payload A and observed geometry receiver. No production triggers/RLS, network or hardware equivalence. Three trials per target; 8-writer burst is chosen stress, not observed traffic. DML UPDATE same value holds real locks but excludes production RPC overhead. Persistent psql sessions avoid process-launch latency; polling can still miss short waits; observed=false is not proof of no blocking.'},indent=2))
