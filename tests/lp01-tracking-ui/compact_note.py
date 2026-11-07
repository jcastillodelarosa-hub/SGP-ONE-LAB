"""PC/mobile acceptance through the real controller, renderer and note transport.

Uses the runner's synthetic contract store, not database/role verification.
"""
def check_compact_note(page,width,out):
 page.locator('[data-tracking-stage="ENSAMBLE"]').click()
 key='QA2|PANELES_2'
 cell=page.locator('[data-note-order-key="'+key+'"]')
 preview=cell.locator('[data-order-note-preview]')
 page.wait_for_function("document.querySelector('[data-note-order-key=\"QA2|PANELES_2\"] [data-order-note-preview]')?.textContent==='Observación compartida por el líder'")
 assert page.locator('[data-order-note-open]').count()==30
 assert page.locator('#lp-tracking-drawer').is_hidden()
 assert preview.inner_text()=='Observación compartida por el líder'
 assert page.locator('[data-note-order-key="QA1|PANELES_2"] [data-order-note-preview]').inner_text()=='Sin observación'
 cell.screenshot(path=str(out/f'compact-observation-{width}.png'))
 cell.locator('[data-order-note-open]').click()
 dialog=page.locator('.lp-order-note-dialog[open]')
 field=dialog.locator('[data-order-note]')
 page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 assert field.input_value()=='Observación compartida por el líder'
 assert page.locator('#lp-tracking-drawer').is_hidden()
 assert not page.locator('.lp-tracking-disclosure[open]').count()
 field.fill('Borrador cancelado');dialog.locator('[data-order-note-cancel]').click()
 assert not page.locator('.lp-order-note-dialog').count()
 assert page.evaluate('window.noteWrites.length')==0
 assert preview.inner_text()=='Observación compartida por el líder'
 assert cell.locator('[data-order-note-open]').evaluate('(el)=>document.activeElement===el')
 cell.locator('[data-order-note-open]').click();page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 assert field.input_value()=='Observación compartida por el líder'
 field.fill('Borrador conserva edición')
 page.evaluate('window.noteField=document.querySelector(".lp-order-note-dialog textarea");window.version++;void controller.load({quiet:true})')
 page.wait_for_function('window.inflight===0')
 assert page.evaluate('window.noteField===document.querySelector(".lp-order-note-dialog textarea")')
 assert field.input_value()=='Borrador conserva edición'
 assert dialog.evaluate('(el)=>el.matches(":modal")')
 assert field.evaluate('(el)=>document.activeElement===el')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # Refresh during a dirty edit keeps its original CAS revision and locks controls.
 page.evaluate("window.setNote('QA2|PANELES_2','Actualización compartida por líder','EMPAQUE');window.noteDelay=true")
 dialog.locator('[data-order-note-refresh]').click()
 assert field.is_disabled();assert dialog.locator('[data-order-note-cancel]').is_disabled()
 page.evaluate('window.releaseNote()')
 page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 assert field.input_value()=='Borrador conserva edición'
 assert dialog.locator('[data-order-note-current]').is_visible()
 dialog.locator('[data-order-note-save]').click()
 page.wait_for_function("document.querySelector('.lp-order-note-dialog [data-order-note-status]').textContent.includes('Otra persona')")
 assert page.evaluate("window.notes.get('QA2|PANELES_2').observation")=='Actualización compartida por líder'
 dialog.locator('[data-order-note-refresh]').click()
 page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 dialog.locator('[data-order-note-discard]').click();field.fill('Guardado desde compacta')
 dialog.locator('[data-order-note-save]').click()
 page.wait_for_function("document.querySelector('.lp-order-note-dialog [data-order-note-status]').textContent.includes('guardada') && !document.querySelector('.lp-order-note-dialog [data-order-note-refresh]').disabled")
 assert preview.inner_text()=='Guardado desde compacta'
 assert page.evaluate("window.notes.get('QA2|PANELES_2').observation")=='Guardado desde compacta'
 dialog.screenshot(path=str(out/f'compact-observation-editor-{width}.png'))
 # Pending outcome cannot be cancelled/edited; retry keeps the same UUID.
 field.fill('Respuesta incierta');page.evaluate('window.noteLost=true')
 dialog.locator('[data-order-note-save]').click()
 page.wait_for_function("document.querySelector('.lp-order-note-dialog [data-order-note-status]').textContent.includes('sin confirmar')")
 assert field.is_disabled();assert dialog.locator('[data-order-note-cancel]').is_disabled()
 page.keyboard.press('Escape');assert dialog.is_visible()
 dialog.locator('[data-order-note-save]').click()
 page.wait_for_function("document.querySelector('.lp-order-note-dialog [data-order-note-status]').textContent.includes('guardada') && !document.querySelector('.lp-order-note-dialog [data-order-note-refresh]').disabled")
 assert page.evaluate('window.noteWrites.at(-1).id===window.noteWrites.at(-2).id')
 dialog.locator('[data-order-note-cancel]').click()
 # The existing detail editor reads the same note and refreshes the compact preview.
 row=cell.locator('xpath=ancestor::tr');row.locator('[data-register-order]').click()
 detail=page.locator('#lp-tracking-drawer [data-order-note-section]')
 page.wait_for_function("!document.querySelector('#lp-tracking-drawer [data-order-note]').disabled")
 assert detail.locator('[data-order-note]').input_value()=='Respuesta incierta'
 detail.locator('[data-order-note]').fill('Guardado desde detalle')
 detail.locator('[data-order-note-save]').click()
 page.wait_for_function("document.querySelector('[data-note-order-key=\"QA2|PANELES_2\"] [data-order-note-preview]').textContent==='Guardado desde detalle'")
 page.locator('[data-tracking-close]').click()
 # Delayed lower revision cannot replace the acknowledged row preview.
 page.evaluate("import('/src/modules/lp01-order-note-rows.js').then(m=>m.paintOrderNoteRows(document.querySelector('[data-live-orders]'),'QA2|PANELES_2',{note:{revision:1,observation:'Lectura antigua'},capabilities:['READ','NOTE']}))")
 assert preview.inner_text()=='Guardado desde detalle'
 page.evaluate('window.noteWritable=false')
 cell.locator('[data-order-note-open]').click()
 page.wait_for_function("document.querySelector('.lp-order-note-dialog [data-order-note-status]').textContent.includes('Solo consulta')")
 assert field.is_disabled();assert dialog.locator('[data-order-note-save]').is_disabled()
 assert field.input_value()=='Guardado desde detalle'
 dialog.locator('[data-order-note-cancel]').click()
 # Missing service is distinct from an empty note, and never enables a write.
 page.evaluate('window.noteUnavailable=true;void controller.load()')
 page.wait_for_function("document.querySelector('[data-note-order-key=\"QA2|PANELES_2\"] [data-order-note-preview]')?.textContent==='Observación no disponible'")
 cell.locator('[data-order-note-open]').click()
 page.wait_for_function("document.querySelector('.lp-order-note-dialog [data-order-note-status]').textContent.includes('todavía no')")
 assert dialog.locator('[data-order-note-save]').is_disabled()
 dialog.locator('[data-order-note-cancel]').click()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')

 # If a refreshed authorization scope removes the order, no orphan modal may block the page.
 page.evaluate('window.noteUnavailable=false;window.noteWritable=true;void controller.load()')
 page.wait_for_function("document.querySelector('[data-note-order-key=\"QA2|PANELES_2\"] [data-order-note-preview]')?.textContent==='Guardado desde detalle'")
 cell.locator('[data-order-note-open]').click()
 page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 field.fill('Borrador antes de retiro de fila')
 page.evaluate("window.originalPayload=window.payload;window.payload=args=>{const p=window.originalPayload(args);return {...p,productions:p.productions.filter(r=>r.key!=='QA2|PANELES_2')};};void controller.load({quiet:true})")
 page.wait_for_function('window.inflight===0')
 assert not page.locator('.lp-order-note-dialog').count()
 assert page.evaluate('document.querySelectorAll("dialog:modal").length===0')
 page.locator('[data-columns-reset]').click()
 page.evaluate('window.payload=window.originalPayload;void controller.load()')
 page.wait_for_function("document.querySelector('[data-note-order-key=\"QA2|PANELES_2\"] [data-order-note-preview]')?.textContent==='Guardado desde detalle'")
 cell.locator('[data-order-note-open]').click()
 page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 field.fill('Borrador de contexto anterior')
 page.evaluate("document.querySelector('[data-tracking-stage=EMPAQUE]').click()")
 page.wait_for_function("document.querySelector('[data-tracking-stage=EMPAQUE]').getAttribute('aria-pressed')==='true' && window.inflight===0")
 assert not page.locator('.lp-order-note-dialog').count()
 assert page.evaluate('document.querySelectorAll("dialog:modal").length===0')
 cell.locator('[data-order-note-open]').click()
 page.wait_for_function("!document.querySelector('.lp-order-note-dialog textarea').disabled")
 assert field.input_value()=='Guardado desde detalle'
 page.evaluate("window.token='changed-scope';document.dispatchEvent(new CustomEvent('sgp:lp-role',{detail:'COORDINADOR'}))")
 assert not page.locator('.lp-order-note-dialog').count()
 assert page.evaluate('document.querySelectorAll("dialog:modal").length===0')
