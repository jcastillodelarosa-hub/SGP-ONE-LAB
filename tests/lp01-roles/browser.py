"""Real Config UI + captured admin RPC SQL + individual close SQL10. No productive requests."""
from pathlib import Path
import importlib.util,json,http.server,threading
from playwright.sync_api import sync_playwright
sp=importlib.util.spec_from_file_location('role_fixture',Path(__file__).with_name('postgres.py'));fixture=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixture)
Database,setup,ROOT,lit=fixture.Database,fixture.setup,fixture.ROOT,fixture.lit
HERE=Path(__file__).parent
class Files(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def rpc(db,name,a):
 if name in ['sgp_sesion_actual','sgp_admin_usuarios_listar','sgp_admin_rol_accesos_listar','sgp_mis_accesos']:
  q='SELECT '+('to_jsonb(x)' if name=='sgp_sesion_actual' else "coalesce(jsonb_agg(to_jsonb(x)),'[]')")+' FROM public.'+name+'('+lit(a['p_token'])+') x'
 elif name=='sgp_admin_usuario_guardar':
  q='SELECT public.'+name+'('+','.join([lit(a['p_token']),lit(a['p_id_usuario']) if a.get('p_id_usuario') else 'NULL',lit(a['p_usuario']),lit(a['p_nombre']),lit(a['p_rol']),lit(a['p_password']),'true' if a['p_activo'] else 'false','ARRAY['+','.join(lit(x) for x in a['p_accesos'])+']::text[]'])+')'
 elif name=='sgp_admin_rol_accesos_guardar':q='SELECT public.'+name+'('+lit(a['p_token'])+','+lit(a['p_rol'])+',ARRAY['+','.join(lit(x) for x in a['p_accesos'])+']::text[])'
 else:return db.rpc(name,a)
 raw=db.sql('SET ROLE anon;'+q)
 if name=='sgp_admin_usuario_guardar':return raw
 return json.loads(raw) if raw else None
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   db=Database()
   try:
    setup(db)
    def intercept(route):
     try:answer=rpc(db,route.request.url.split('/rpc/')[-1],json.loads(route.request.post_data or '{}'));route.fulfill(status=200,content_type='application/json',body=json.dumps(answer))
     except Exception as e:route.fulfill(status=400,content_type='application/json',body=json.dumps({'code':'QA_SQL','message':str(e)}))
    def page_for(token):
     page=browser.new_page(viewport={'width':width,'height':900});page.add_init_script("sessionStorage.setItem('sgp_one_session',"+json.dumps(token)+")")
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.route('**/rest/v1/rpc/*',intercept)
     page.goto(origin+'/');page.wait_for_function("document.querySelector('#authStatus').textContent.includes(' · ')");return page
    page=page_for('QAADMIN');dialogs=[]
    page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))

    if page.locator('#mobileMenuToggle').is_visible():page.locator('#mobileMenuToggle').click()
    page.locator('.nav [data-view="configuracion"]').click();page.locator('[data-config-tab="usuarios"]').click();page.locator('#newUserBtn').click();page.locator('#userRole').select_option('SUPERVISOR ENSAMBLE');assert page.locator('#userAccessGrid input[value="ensamble.operacion-ensamble"]').is_checked();page.locator('#userCancel').click();page.locator('[data-config-tab="roles"]').click();page.wait_for_selector('#roleAccessManager[aria-busy="false"]')
    block=page.locator('#roleAccessManager details').filter(has=page.locator('summary',has_text='SUPERVISOR ENSAMBLE'))
    block.locator(':scope > summary').click();assert 'cierre individual' in block.inner_text()
    # Native roles save revokes operations for already issued supervisor sessions.
    block.locator('details.access-module').filter(has=page.locator('summary',has_text='Ensamble')).locator(':scope > summary').click()
    check=block.locator('input[value="ensamble.operacion-ensamble"]');check.uncheck();block.locator('[data-save-role]').click()
    page.wait_for_function("[...document.querySelectorAll('#roleAccessManager .role-block > summary')].some(x=>x.textContent.includes('SUPERVISOR ENSAMBLE 0 accesos'))")
    try:db.snapshot(token='se');raise AssertionError('Role edit not enforced')
    except RuntimeError as e:assert 'AMBITO' in str(e)
    block=page.locator('#roleAccessManager details').filter(has=page.locator('summary',has_text='SUPERVISOR ENSAMBLE'));block.locator(':scope > summary').click();block.locator('details.access-module').filter(has=page.locator('summary',has_text='Ensamble')).locator(':scope > summary').click();block.locator('input[value="ensamble.operacion-ensamble"]').check();block.locator('[data-save-role]').click();page.wait_for_function("[...document.querySelectorAll('#roleAccessManager .role-block > summary')].some(x=>x.textContent.includes('SUPERVISOR ENSAMBLE 1 accesos'))")
    page.locator('[data-config-tab="usuarios"]').click();page.locator('#newUserBtn').click()
    page.locator('#userName').fill('qa-browser');page.locator('#userFullName').fill('QA browser');page.locator('#userPassword').fill('qa-password');page.locator('#userRole').select_option('SUPERVISOR ENSAMBLE')
    assert page.locator('#userAccessGrid input[value="ensamble.operacion-ensamble"]').is_checked()
    assert not page.locator('#userAccessGrid input[value="ensamble.operacion-empaque"]').is_checked()
    page.locator('#userSave').click();page.wait_for_selector('#userModal',state='hidden')
    assert db.sql("SELECT rol FROM public.sgp_usuarios WHERE usuario='qa-browser'")=='SUPERVISOR ENSAMBLE'
    row=page.locator('#userAdminBody tr').filter(has_text='qa-browser');row.locator('[data-user-edit]').click();page.locator('#userRole').select_option('SUPERVISOR EMPAQUE');page.locator('#userSave').click();page.wait_for_selector('#userModal',state='hidden')
    assert db.sql("SELECT rol FROM public.sgp_usuarios WHERE usuario='qa-browser'")=='SUPERVISOR EMPAQUE'
    page.screenshot(path=str(HERE/f'evidence/users-{width}.png'));page.close()
    # First manual bootstrap on a genuinely empty T2; no assignments/open orders in that date/shift.
    db.execute(db.cmd('ABRIR',date='2026-11-02',shift=2))
    page=page_for('se');confirmations=[]
    page.wait_for_function("document.querySelector('#productionPackingTab').hidden && document.querySelector('[data-op-stage]').value==='ENSAMBLE'")
    assert page.locator('#productionTrackingTab').evaluate('(e)=>e.hidden')
    assert page.locator('#productionPlannerTab').evaluate('(e)=>e.hidden')
    assert page.locator('#productionLocationsTab').evaluate('(e)=>e.hidden')
    page.evaluate("document.querySelector('#productionPackingTab').click()")
    assert page.locator('[data-op-stage]').input_value()=='ENSAMBLE'
    def confirm(d):
     confirmations.append(d.message)
     if len(confirmations)==1:d.dismiss()
     else:d.accept()
    page.on('dialog',confirm)
    page.evaluate("document.querySelector('[data-view-panel=ensamble]').hidden=false;document.querySelector('[data-op-date]').value='2026-11-02';document.querySelector('[data-op-shift]').value='2'")
    page.locator('#productionAssemblyTab').click();page.wait_for_selector('[data-empty-close]',state='attached');page.locator('[data-turn-operation]').click();page.wait_for_selector('[data-empty-close]')
    page.locator('[data-empty-confirm]').check();page.locator('[data-close-note]').fill('QA cierre individual T2 sin actividad')
    page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-save-status]')?.textContent.includes('cancelado')||document.querySelector('[data-close-status]')?.textContent.includes('cancelado')")
    assert db.sql("SELECT count(*) FROM sgp_lp_operacion.cierres")=='0'
    page.locator('[data-close-empty]').click();page.wait_for_function("document.querySelector('[data-op-status]').textContent.includes('Guardado confirmado')")
    assert 'T2' in confirmations[-1] and '2026-11-02' in confirmations[-1]
    assert db.sql("SELECT rol_efectivo FROM sgp_lp_operacion.auditoria WHERE usuario='se' AND operacion='CERRAR'")=='SUPERVISOR ENSAMBLE'
    assert db.snapshot(date='2026-11-02',shift=2,token='se')['turn']['estado']=='CERRADO'
    page.locator('[data-back]').click();page.wait_for_function("document.querySelector('#productionAssemblyTab').getAttribute('aria-selected')==='true'")
    assert not page.locator('#productionTrackingTab').is_visible()
    page.screenshot(path=str(HERE/f'evidence/individual-{width}.png'));page.close()
    page=page_for('sp');page.wait_for_function("document.querySelector('#productionAssemblyTab').hidden && document.querySelector('[data-op-stage]').value==='EMPAQUE'")
    page.evaluate("document.querySelector('[data-view-panel=ensamble]').hidden=false;document.querySelector('#productionAssemblyTab').click()")
    assert page.locator('[data-op-stage]').input_value()=='EMPAQUE'
    page.screenshot(path=str(HERE/f'evidence/packing-{width}.png'));page.close()
    page=page_for('ll');page.evaluate("document.querySelector('[data-view-panel=ensamble]').hidden=false")
    for tab,stage in [('productionAssemblyTab','ENSAMBLE'),('productionPackingTab','EMPAQUE')]:
     assert not page.locator('#'+tab).evaluate('(e)=>e.hidden')
     page.locator('#'+tab).click();assert page.locator('[data-op-stage]').input_value()==stage
    page.close()
    results.append({'width':width,'direct_users_without_prior_roles_visit':'PASS','native_role_edit_revocation':'PASS','native_user_create_edit_and_defaults':'PASS','individual_T2_confirmation_cancel_and_close':'PASS','server_role_audit':'PASS','supervisor_single_stage_navigation':'PASS','leader_both_stages_navigation':'PASS','transport':'real local SDK; REST routed to actual captured admin/session and LP SQL; unrelated sources unavailable'})
   finally:db.close()
  browser.close()
finally:server.shutdown()
(HERE/'evidence/browser.json').write_text(json.dumps({'status':'PASS','results':results,'limits':['Only synthetic accounts/catalog/production. No productive network or privileged identity','Ancillary source requests unavailable; no certification of their behavior','Individual empty close exercised here; normal closure, both stages/turns and quantities covered by real SQL tests; existing XLSX evidence reused']},indent=2)+'\n');print(json.dumps(results,indent=2))
