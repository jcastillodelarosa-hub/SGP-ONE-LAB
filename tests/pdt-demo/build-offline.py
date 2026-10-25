"""Bundle a single, network-free HTML demo. No third-party bundler or service."""
import hashlib,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[2]
folder=ROOT/'tests/pdt-demo'
parts=["function demoUuid(){if(crypto.randomUUID)return crypto['randomUUID']();return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^(crypto.getRandomValues(new Uint8Array(1))[0]&15)>>(Number(c)/4)).toString(16));}"]
for filename in ['src/domain/aluminum-pending-balances.js','src/services/aluminum-pending-v2.js','src/modules/pdt-v2-controller.js']:
 text=(ROOT/filename).read_text()
 text=re.sub(r'^import .*;\n','',text,flags=re.M)
 text=re.sub(r'\bexport (?=(?:async )?function)','',text)
 parts.append(text)
parts.append((folder/'offline-model.js').read_text())
text=(folder/'demo.js').read_text()
text=re.sub(r'^import .*;\n','',text,flags=re.M)
start=text.index('const client={async rpc(');end=text.index('async function call(',start)
text=text[:start]+'''const simulation=createOfflineModel();
const client={async rpc(name,args){
 const result=await simulation.rpc(name,args);
 if(!result.error&&!name.includes('listar')&&!['sgp_pdt_capacidades_v2','sgp_pdt_fuentes_v2','sgp_pdt_picking_v2'].includes(name)){
  const item=document.createElement('li');item.textContent='SIMULADA · '+role()+' · '+name+' · '+JSON.stringify(result.data);$('#history').prepend(item);
 }
 return result;
}};
'''+text[end:]
text=text.replace("state=await (await fetch('/api/demo-state')).json();","state=simulation.snapshot();")
text=text.replace('QA conectado.','Simulación local lista.').replace('guardado en QA.','simulado en memoria.').replace("document.addEventListener('keydown'","$('#reset-demo').onclick=()=>location.reload();\ndocument.addEventListener('keydown'")
parts.append(text)
html=(folder/'index.html').read_text()
html=html.replace('<title>SGP · Demostración PDT v2</title>','<title>SGP · PDT v2 · Simulación sin instalación</title>')
html=html.replace('<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/demo.css">','<style>'+ (ROOT/'styles.css').read_text()+'\n'+(folder/'demo.css').read_text()+'</style>')
html=html.replace('<meta name="viewport"','<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">\n<meta name="viewport"')
html=html.replace('SGP ONE · ENTORNO AISLADO','SGP ONE · SIMULACIÓN VISUAL SIN CONEXIÓN')
html=html.replace('Prueba PDT v2 con datos ficticios y operaciones reales en PostgreSQL QA.','Prueba la interfaz con datos ficticios. Todas las operaciones de este archivo son simuladas.')
html=html.replace('Solo demostración local. Sin conexión a Supabase productivo. Las cantidades y los cambios se guardan únicamente en esta base QA.','<strong>SIMULACIÓN VISUAL:</strong> sin Supabase, PostgreSQL, RPC ni servidor. Los cambios existen solo en memoria y se pierden al recargar. No valida permisos reales ni equivale a una prueba productiva. <button id="reset-demo" type="button">Reiniciar ejemplo</button>')
html=html.replace('Operaciones realizadas en QA','Operaciones simuladas (no ejecutadas en backend)').replace('Conectando con QA…','Preparando simulación local…')
html=html.replace('<script type="module" src="/demo.js"></script>','<script>\n'+ '\n'.join(parts).replace('crypto.randomUUID()','demoUuid()').replace('</script','<\\/script')+'\n</script>')
html='\n'.join(line.rstrip() for line in html.splitlines())+'\n'
output=folder/'PDT_V2_DEMO_AUTOCONTENIDA.html';output.write_text(html)
print(output.name,hashlib.sha256(output.read_bytes()).hexdigest(),len(output.read_bytes()),'bytes; no external dependencies')
