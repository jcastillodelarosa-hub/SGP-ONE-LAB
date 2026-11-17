const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Audited means reviewed, not necessarily without shortages.
export function receptionAuditProgress(areas){
 if(!Array.isArray(areas)||!areas.length)return null;
 if(areas.some(a=>!a||typeof a.id!=='string'||!a.id.trim())||new Set(areas.map(a=>a.id)).size!==areas.length)return null;
 const sections=areas.map(a=>({id:a.id,label:a.id==='ZOCALERO'&&['Zocalero (top y bottom)','Zocalero'].includes(a.nombre)?'Zócalos':String(a.nombre||a.id),audited:!!a.revision}));
 return {sections,completed:sections.filter(a=>a.audited).length,total:sections.length};
}
export function receptionAuditProgressMarkup(areas){
 const p=receptionAuditProgress(areas);
 if(!p)return '<div class="pick-audit-progress unavailable">Avance por sección no disponible · abre Auditar</div>';
 return '<div class="pick-audit-progress" aria-label="Auditoría por sección"><strong>Auditoría '+p.completed+'/'+p.total+'</strong>'+p.sections.map(a=>'<span class="pick-audit-progress-section '+(a.audited?'audited':'pending')+'">'+escape(a.label)+': '+(a.audited?'Auditado':'Pendiente')+'</span>').join('')+'</div>';
}
