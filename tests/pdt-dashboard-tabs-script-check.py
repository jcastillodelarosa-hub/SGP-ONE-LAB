"""Compile and execute the browser setup string after Python decoding, without a browser."""
import ast,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
tree=ast.parse((ROOT/'tests/pdt-dashboard-tabs-browser.py').read_text())
setup=next(node.value for node in ast.walk(tree) if isinstance(node,ast.Constant) and isinstance(node.value,str) and node.value.startswith('async ({source,base})'))
names=next(ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='names' for target in node.targets))
lines=(ROOT/'app.js').read_text().splitlines()
source='\n'.join(next(line for line in lines if line.startswith('function '+name+'(') or line.startswith('async function '+name+'(')) for name in names)
script='''globalThis.window={};globalThis.document={querySelectorAll:()=>[],querySelector:()=>null};
await ('''+setup+''')('''+json.dumps({'source':source,'base':ROOT.as_uri()})+''');
for(const name of ['render','bind','load','fail','rows','visible'])if(typeof window[name]!=='function')throw Error('Missing setup binding: '+name);
window.rows([]);window.render();
console.log('PASS: Python AST decoding, real module imports, JavaScript eval and initial dashboard bindings');
'''
subprocess.run(['node','--input-type=module'],input=script,text=True,check=True,cwd=ROOT)
