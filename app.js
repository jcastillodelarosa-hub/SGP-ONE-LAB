import { trackingRows } from "./src/data/mock-data.js";
import { createMecanizadoModule } from "./src/modules/mecanizado.js";
import { readProgrammingWorkbook, summarizeProgramming } from "./src/domain/production-importer.js";
import { importProductions } from "./src/services/production-import-repository.js";
import { readAluminumTrackingWorkbook, summarizeAluminumTracking } from "./src/domain/aluminum-tracking-importer.js";
import { readAluminumPiecesWorkbook, summarizeAluminumPieces, classifyAluminumPieces, relateAluminumPieces, prepareAluminumPiecePayload } from "./src/domain/aluminum-pieces-importer.js";
import { classifyPieceCodes } from "./src/services/piece-master-repository.js";
import { readAccessoriesWorkbook, relateAccessories, prepareAccessoryPayload } from "./src/domain/accessories-importer.js";
import { readGlassWorkbook, relateGlass, prepareGlassPayload } from "./src/domain/glass-importer.js";
import { readGlassLocationWorkbook, filterGlassLocationRows } from "./src/domain/glass-location-importer.js?v=62";
import { getSupabaseClient } from "./src/services/supabase-client.js";
import { readNcAluminumWorkbook } from "./src/domain/nc-aluminum-importer.js?v=73";
import { readNcGlassWorkbook } from "./src/domain/nc-glass-importer.js?v=84";

const mecanizado = createMecanizadoModule(trackingRows);
let validatedProductions = [];
let validatedAccessories = null;
let validatedGlass = null;
let validatedPieces = null;
let targetWeek = null;
let dailyExportPreview = null;
let dailyExportRows = [];
let glassLocationPreview = null;
let glassLocationRows = [];
let ncAlRows=[]; let ncAlPreview=null; let ncAlNewRows=[];
let queriedProductions = [];
let assemblyRows = [];
let queriedSystemSummary = [];
let detailSort = { key: null, dir: 1 };
let currentPieceRows=[];let currentPieceView='summary';let pieceDetailColumns=['perfil','descripcion','marca','fabricacion','longitud','cantidad'];
let detailColumnFilters = {};
let detailHidden=new Set(JSON.parse(localStorage.getItem('sgp_program_hidden_cols')||'[]'));
let detailColumns = [
 {key:'prioridad',label:'Prioridad'}, {key:'reserva_al',label:'Reserva'}, {key:'id_linea',label:'Línea'}, {key:'id',label:'ID'}, {key:'produccion',label:'Producción'}, {key:'tipo',label:'Tipo'}, {key:'sistema',label:'Sistema'}, {key:'acabado',label:'Acabado'}, {key:'proyecto',label:'Proyecto'}, {key:'cantidad',label:'Cantidad'}, {key:'muntin',label:'Muntin'}, {key:'porc_vidrio',label:'% Vidrio'}, {key:'tipo_vidrio',label:'Tipo vidrio'}, {key:'medidas',label:'Tamaños'}, {key:'cliente',label:'Cliente'}, {key:'mercado',label:'Mercado'}, {key:'estado_produccion',label:'Estado'}, {key:'grupo_vidrio',label:'Grupo vidrio'}, {key:'orden_oves',label:'OVES'}
];

const els = {
  nav: document.querySelectorAll("[data-view]"),
  views: document.querySelectorAll(".view"),
  search: document.querySelector("#search"),
  state: document.querySelector("#stateFilter"),
  line: document.querySelector("#lineFilter"),
  tbody: document.querySelector("#trackingBody"),
  total: document.querySelector("#mTotal"),
  delivered: document.querySelector("#mDelivered"),
  warehouse: document.querySelector("#mWarehouse"),
  supply: document.querySelector("#mSupply"),
  simulate: document.querySelector("#simulateButton"),
  demoMessage: document.querySelector("#demoMessage"),
  files: document.querySelector("#programmingFiles"),
  validate: document.querySelector("#validateProgramming"),
  targetWeek: document.querySelector("#targetWeek"),
  commit: document.querySelector("#commitProgramming"),
  previewLoad: document.querySelector("#previewWeeklyLoad"),
  previewStatus: document.querySelector("#previewWeeklyStatus"),
  authStatus: document.querySelector("#authStatus"),
  authUser: document.querySelector("#authUser"),
  authPassword: document.querySelector("#authPassword"),
  authLogin: document.querySelector("#authLogin"),
  authLogout: document.querySelector("#authLogout"),
  importStatus: document.querySelector("#importStatus"),
  iTotal: document.querySelector("#iTotal"),
  iKeys: document.querySelector("#iKeys"),
  iErrors: document.querySelector("#iErrors"),
  importBody: document.querySelector("#importSummaryBody"),
  assemblySheetTab:document.querySelector("#assemblySheetTab"),assemblyLocationReportTab:document.querySelector("#assemblyLocationReportTab"),assemblySheetPanel:document.querySelector("#assemblySheetPanel"),assemblyLocationReportPanel:document.querySelector("#assemblyLocationReportPanel"),glassDetailModal:document.querySelector("#glassDetailModal"),glassDetailTitle:document.querySelector("#glassDetailTitle"),glassDetailMeta:document.querySelector("#glassDetailMeta"),glassDetailSummary:document.querySelector("#glassDetailSummary"),glassDetailBody:document.querySelector("#glassDetailBody"),closeGlassDetail:document.querySelector("#closeGlassDetail"),lrPrepared:document.querySelector("#lrPrepared"),lrNovelty:document.querySelector("#lrNovelty"),lrTransfer:document.querySelector("#lrTransfer"),lrOther:document.querySelector("#lrOther"),lrRacks:document.querySelector("#lrRacks"),lrMixed:document.querySelector("#lrMixed"),locationReportStatus:document.querySelector("#locationReportStatus"),locationByReservation:document.querySelector("#locationByReservation"),locationMixedRacks:document.querySelector("#locationMixedRacks"),assemblyWeek: document.querySelector("#assemblyWeek"), assemblyLine: document.querySelector("#assemblyLine"), assemblyState: document.querySelector("#assemblyState"), assemblySearch: document.querySelector("#assemblySearch"), loadAssembly: document.querySelector("#loadAssembly"), assemblyStatus: document.querySelector("#assemblyStatus"), assemblyBody: document.querySelector("#assemblyBody"), asTotal: document.querySelector("#asTotal"), asBalance: document.querySelector("#asBalance"), asOpen: document.querySelector("#asOpen"), asClosed: document.querySelector("#asClosed"), asAssembled: document.querySelector("#asAssembled"),
  dailyExportLine: document.querySelector("#dailyExportLine"),
  dailyExportFile: document.querySelector("#dailyExportFile"),
  previewDailyExport: document.querySelector("#previewDailyExport"),
  applyDailyExport: document.querySelector("#applyDailyExport"),
  dailyExportStatus: document.querySelector("#dailyExportStatus"),
  dailyExportMetrics: document.querySelector("#dailyExportMetrics"),
  dailyExportWeeks: document.querySelector("#dailyExportWeeks"),
  glassLocationFile: document.querySelector("#glassLocationFile"),
  previewGlassLocation: document.querySelector("#previewGlassLocation"),
  applyGlassLocation: document.querySelector("#applyGlassLocation"),
  glassLocationStatus: document.querySelector("#glassLocationStatus"),
  glassLocationMetrics: document.querySelector("#glassLocationMetrics"),
  glassLocationSummary: document.querySelector("#glassLocationSummary"),
  aluminumFile: document.querySelector("#aluminumTrackingFile"),
  validateAluminum: document.querySelector("#validateAluminum"),
  aluminumStatus: document.querySelector("#aluminumStatus"),
  aTotal: document.querySelector("#aTotal"),
  aReservations: document.querySelector("#aReservations"),
  aSupply: document.querySelector("#aSupply"),
  aWarehouse: document.querySelector("#aWarehouse"),
  aDelivered: document.querySelector("#aDelivered"),
  aErrors: document.querySelector("#aErrors"),
  applyAluminumTracking: document.querySelector("#applyAluminumTracking"),
  piecesFile: document.querySelector("#aluminumPiecesFile"),
  validatePieces: document.querySelector("#validatePieces"),
  piecesStatus: document.querySelector("#piecesStatus"),
  pTotal: document.querySelector("#pTotal"),
  pOrders: document.querySelector("#pOrders"),
  pCodes: document.querySelector("#pCodes"),
  pUnclassified: document.querySelector("#pUnclassified"),
  pRelated: document.querySelector("#pRelated"),
  pNoMatch: document.querySelector("#pNoMatch"),
  pErrors: document.querySelector("#pErrors"),
  piecesNoMatchWrap: document.querySelector("#piecesNoMatchWrap"),
  piecesNoMatchBody: document.querySelector("#piecesNoMatchBody"),
  accessoriesFile: document.querySelector("#accessoriesFile"), validateAccessories: document.querySelector("#validateAccessories"), accessoriesStatus: document.querySelector("#accessoriesStatus"), xTotal: document.querySelector("#xTotal"), xRelated: document.querySelector("#xRelated"), xNoMatch: document.querySelector("#xNoMatch"), xErrors: document.querySelector("#xErrors"), accessoriesNoMatchWrap: document.querySelector("#accessoriesNoMatchWrap"), accessoriesNoMatchBody: document.querySelector("#accessoriesNoMatchBody"),
  glassFile: document.querySelector("#glassFile"), validateGlass: document.querySelector("#validateGlass"), glassStatus: document.querySelector("#glassStatus"), gTotal: document.querySelector("#gTotal"), gRelated: document.querySelector("#gRelated"), gNoMatch: document.querySelector("#gNoMatch"), gSkipped: document.querySelector("#gSkipped"), gErrors: document.querySelector("#gErrors"), glassNoMatchWrap: document.querySelector("#glassNoMatchWrap"), glassNoMatchBody: document.querySelector("#glassNoMatchBody"),
  queryYear: document.querySelector("#queryYear"), queryWeek: document.querySelector("#queryWeek"), queryLine: document.querySelector("#queryLine"), querySearch: document.querySelector("#querySearch"), queryProgramming: document.querySelector("#queryProgramming"), queryStatus: document.querySelector("#queryStatus"), queryBody: document.querySelector("#queryProgrammingBody"), qWeek: document.querySelector("#qWeek"), qTotal: document.querySelector("#qTotal"), qUnits: document.querySelector("#qUnits"), qVisible: document.querySelector("#qVisible"), systemSummaryBody: document.querySelector("#systemSummaryBody"), typeSummaryBody: document.querySelector("#typeSummaryBody"), reservationSummaryBody: document.querySelector("#reservationSummaryBody"), systemSummaryFoot: document.querySelector("#systemSummaryFoot"), typeSummaryFoot: document.querySelector("#typeSummaryFoot"), reservationSummaryFoot: document.querySelector("#reservationSummaryFoot"), queryHead: document.querySelector("#queryProgrammingHead"), pieceModal: document.querySelector("#pieceModal"), pieceModalTitle: document.querySelector("#pieceModalTitle"), pieceModalMeta: document.querySelector("#pieceModalMeta"), pieceProfileBody: document.querySelector("#pieceProfileBody"), pieceProfileHead: document.querySelector("#pieceProfileHead"), pieceProfileFoot: document.querySelector("#pieceProfileFoot"), pieceDetailedOptions: document.querySelector("#pieceDetailedOptions"), closePieceModal: document.querySelector("#closePieceModal"), typeSummaryBody: document.querySelector("#typeSummaryBody"), reservationSummaryBody: document.querySelector("#reservationSummaryBody")
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function renderPiecesNoMatches(relation) {
  if (!els.piecesNoMatchWrap || !els.piecesNoMatchBody) return;
  const rows = relation?.noMatchRows || [];
  els.piecesNoMatchWrap.hidden = rows.length === 0;
  els.piecesNoMatchBody.innerHTML = rows.length
    ? rows.map(row => `<tr><td>${escapeHtml(row.produccion || "—")}</td><td>${escapeHtml(row.sistema || "—")}</td><td>${escapeHtml(row.order_co || "—")}</td><td>${escapeHtml(row.filas)}</td><td>${escapeHtml(row.codigos_sap)}</td><td>${escapeHtml(row.motivo)}</td></tr>`).join("")
    : '<tr><td colspan="6" class="empty">Sin diferencias informativas</td></tr>';
}

function renderAccessoryNoMatches(relation) {
  if (!els.accessoriesNoMatchWrap || !els.accessoriesNoMatchBody) return;
  const rows = relation?.noMatchRows || [];
  els.accessoriesNoMatchWrap.hidden = rows.length === 0;
  els.accessoriesNoMatchBody.innerHTML = rows.length
    ? rows.map(row => `<tr><td>${escapeHtml(row.produccion)}</td><td>${escapeHtml(row.sistema)}</td><td>${escapeHtml(row.filas)}</td><td>${escapeHtml(row.codigo_sap || "—")}</td><td>Producción + Sistema no existe en la programación validada</td></tr>`).join("")
    : '<tr><td colspan="5" class="empty">Sin grupos pendientes</td></tr>';
}

function renderGlassNoMatches(relation) {
  if (!els.glassNoMatchWrap || !els.glassNoMatchBody) return;
  const rows = relation?.noMatchRows || [];
  els.glassNoMatchWrap.hidden = rows.length === 0;
  els.glassNoMatchBody.innerHTML = rows.length
    ? rows.map(row => `<tr><td>${escapeHtml(row.id_export)}</td><td>${escapeHtml(row.produccion || "—")}</td><td>${escapeHtml(row.sistema || "—")}</td><td>${escapeHtml(row.filas)}</td><td>${escapeHtml(row.motivo)}</td></tr>`).join("")
    : '<tr><td colspan="5" class="empty">Sin IDs pendientes</td></tr>';
}

function invalidateWeeklySource(source) {
  if (source === "programming") {
    validatedProductions = [];
    targetWeek = null;
    validatedPieces = null;
    validatedAccessories = null;
    validatedGlass = null;
    els.pRelated.textContent = "—"; els.pNoMatch.textContent = "—";
    els.xRelated.textContent = "—"; els.xNoMatch.textContent = "—";
    els.gRelated.textContent = "—"; els.gNoMatch.textContent = "—";
    renderPiecesNoMatches({noMatchRows:[]});
    renderAccessoryNoMatches({noMatchRows:[]});
    renderGlassNoMatches({noMatchRows:[]});
  } else if (source === "pieces") validatedPieces = null;
  else if (source === "accessories") validatedAccessories = null;
  else if (source === "glass") validatedGlass = null;
  refreshWeeklyPackageGate();
}

function weeklyPackageStatus() {
  const blockers = [];
  if (!targetWeek) blockers.push("Semana a cargar");
  if (!validatedProductions.length) blockers.push("Programación");
  if (!validatedPieces) blockers.push("Listado de piezas");
  if (!validatedAccessories) blockers.push("Accesorios");
  if (!validatedGlass) blockers.push("Vidrio");
  if (validatedPieces?.errors?.length) blockers.push("Errores en piezas");
  if (validatedPieces?.unclassified) blockers.push("SAP sin clasificar");
  if (validatedPieces?.conflicts) blockers.push("Conflictos en piezas");
  if (validatedAccessories?.errors?.length) blockers.push("Errores en accesorios");
  if (validatedAccessories?.conflicts) blockers.push("Conflictos en accesorios");
  if (validatedGlass?.errors?.length) blockers.push("Errores en vidrio");
  if (validatedGlass?.conflicts) blockers.push("Conflictos en vidrio");
  return { ready: blockers.length === 0, blockers };
}
function refreshWeeklyPackageGate() {
  const status = weeklyPackageStatus();
  const token = sessionStorage.getItem(APP_SESSION_KEY);
  els.commit.disabled = !(status.ready && token);
  els.commit.textContent = status.ready ? (token ? "Cargar semana" : "Inicia sesión para cargar") : "Carga final bloqueada";
  if (els.previewLoad) els.previewLoad.disabled = !status.ready;
  els.commit.title = status.ready
    ? "Las 4 fuentes están validadas. La carga requiere sesión autorizada y doble confirmación."
    : "Pendiente: " + status.blockers.join(", ");
  if (status.ready) {
    els.importStatus.textContent = `Paquete semanal listo para carga: Programación + Piezas + Accesorios + Vidrio validados. La escritura requiere confirmación explícita.`;
  }
  refreshWeeklyTabs();
}


const APP_SESSION_KEY = "sgp_one_session";
const APP_PERSIST_SESSION_KEY = "sgp_one_session_persist";
function getAppToken(){return sessionStorage.getItem(APP_SESSION_KEY)||localStorage.getItem(APP_PERSIST_SESSION_KEY)||""}
let sgpGeneralConfig={HORARIOS_TURNOS:{lunes_sabado:{turno1:{inicio:'07:00',fin:'19:00'},turno2:{inicio:'19:00',fin:'07:00'}},domingo:{turno1:{inicio:'07:00',fin:'18:00'},turno2:{inicio:'18:00',fin:'05:00'}}}};
async function loadGeneralConfig(){
 try{const c=await getSupabaseClient(),{data,error}=await c.rpc('sgp_configuracion_general_obtener',{p_token:getAppToken()});if(error)throw error;(data||[]).forEach(x=>sgpGeneralConfig[x.clave]=x.valor);const h=sgpGeneralConfig.HORARIOS_TURNOS||{};const w=h.lunes_sabado||{},s=h.domingo||{};[['#cfgWeekT1Start',w.turno1?.inicio],['#cfgWeekT1End',w.turno1?.fin],['#cfgWeekT2Start',w.turno2?.inicio],['#cfgWeekT2End',w.turno2?.fin],['#cfgSunT1Start',s.turno1?.inicio],['#cfgSunT1End',s.turno1?.fin],['#cfgSunT2Start',s.turno2?.inicio],['#cfgSunT2End',s.turno2?.fin]].forEach(([q,v])=>{const e=document.querySelector(q);if(e&&v)e.value=v})}catch(e){console.warn('Configuración general',e)}
}
function shiftScheduleForDate(date,turno){const d=new Date(date+'T12:00:00'),sun=d.getDay()===0,h=sgpGeneralConfig.HORARIOS_TURNOS||{},g=sun?h.domingo:h.lunes_sabado,t=String(turno||'').includes('2')?'turno2':'turno1';return g?.[t]||null}
function fmtShiftTime(v){if(!v)return'';let [h,m]=v.split(':').map(Number),ap=h>=12?'pm':'am',hh=h%12||12;return hh+(m?':'+String(m).padStart(2,'0'):'')+' '+ap}
function shiftLabelForDate(date,turno){const s=shiftScheduleForDate(date,turno);return s?fmtShiftTime(s.inicio)+' a '+fmtShiftTime(s.fin):''}

function saveAppToken(token){sessionStorage.setItem(APP_SESSION_KEY,token);localStorage.setItem(APP_PERSIST_SESSION_KEY,token)}
function clearAppToken(){sessionStorage.removeItem(APP_SESSION_KEY);localStorage.removeItem(APP_PERSIST_SESSION_KEY)}

async function refreshAuthStatus() {
  try {
    const token = getAppToken();
    if (!token) {
      els.authStatus.textContent = "Sin sesión";
      els.authUser.hidden = false; els.authPassword.hidden = false; els.authLogin.hidden = false; els.authLogout.hidden = true;
      await applyUserAccess(null);
      return null;
    }
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("sgp_sesion_actual", { p_token: token });
    if (error || !data?.valida) {
      clearAppToken();
      els.authStatus.textContent = "Sesión vencida";
      els.authUser.hidden = false; els.authPassword.hidden = false; els.authLogin.hidden = false; els.authLogout.hidden = true;
      return null;
    }
    els.authStatus.textContent = `${data.nombre} · ${data.rol}`;
    els.authUser.hidden = true; els.authPassword.hidden = true; els.authLogin.hidden = true; els.authLogout.hidden = false;
    await applyUserAccess(data);
    return data;
  } catch {
    els.authStatus.textContent = "Auth no disponible";
    return null;
  }
}
async function requestCredentialAccess() {
  const usuario = String(els.authUser.value || "").trim();
  const password = els.authPassword.value || "";
  if (!usuario || !password) { els.authStatus.textContent = "Ingresa usuario y contraseña."; return; }
  els.authLogin.disabled = true; els.authStatus.textContent = "Validando…";
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("sgp_login", { p_usuario: usuario, p_password: password });
    if (error) throw error;
    saveAppToken(data.token);
    els.authPassword.value = "";
    await refreshAuthStatus(); await loadGeneralConfig();
  } catch (error) {
    console.error("Error de inicio de sesión SGP:", error);
    els.authPassword.value = "";
    els.authStatus.textContent = error?.message ? "Error de acceso: " + error.message : "No se pudo validar el acceso.";
  } finally { els.authLogin.disabled = false; }
}
async function logout() {
  const token=getAppToken();
  try { if(token){ const client=await getSupabaseClient(); await client.rpc("sgp_logout",{p_token:token}); } } finally {
    clearAppToken(); await refreshAuthStatus();
  }
}



function closeMobileMenu(){document.body.classList.remove('mobile-menu-open');const t=document.querySelector('#mobileMenuToggle'),sh=document.querySelector('#mobileMenuShade');if(t)t.setAttribute('aria-expanded','false');if(sh)sh.hidden=true}
function toggleMobileMenu(){const open=!document.body.classList.contains('mobile-menu-open');document.body.classList.toggle('mobile-menu-open',open);const t=document.querySelector('#mobileMenuToggle'),sh=document.querySelector('#mobileMenuShade');if(t)t.setAttribute('aria-expanded',String(open));if(sh)sh.hidden=!open}
document.querySelector('#mobileMenuToggle')?.addEventListener('click',toggleMobileMenu);document.querySelector('#mobileMenuShade')?.addEventListener('click',closeMobileMenu);document.querySelectorAll('.nav [data-view]').forEach(b=>b.addEventListener('click',()=>{if(window.innerWidth<=760)closeMobileMenu()}));window.addEventListener('resize',()=>{if(window.innerWidth>760)closeMobileMenu()});
const SGP_ACCESS_TREE=[
 {key:'inicio',label:'Inicio'},
 {key:'mecanizado',label:'Módulo de Mecanizado',children:[['mecanizado.recepcion','Recepción'],['mecanizado.faltantes','Pendientes de material'],['mecanizado.programacion','Programación'],['mecanizado.produccion','Producción']]},
 {key:'programacion',label:'Programación semanal'},
 {key:'ensamble',label:'Ensamble'},
 {key:'nc-aluminio',label:'NC Aluminio'},
 {key:'nc-vidrio',label:'NC Vidrio'},
 {key:'seguimiento-aluminio',label:'Seguimiento de aluminio'},
 {key:'carga-semanal',label:'Carga semanal'},
 {key:'actualizacion',label:'Actualización diaria',children:[['actualizacion.export','Export diario'],['actualizacion.glass-location','Ubicación de vidrio'],['actualizacion.nc-al','NC Aluminio'],['actualizacion.nc-glass','NC Vidrio'],['actualizacion.al-track','Seguimiento de aluminio']]},
 {key:'configuracion',label:'Configuración'}
];
const SGP_WINDOWS=SGP_ACCESS_TREE.flatMap(x=>[[x.key,x.label],...(x.children||[])]);
function accessTreeHtml(selected=[],mode='user'){return SGP_ACCESS_TREE.map(x=>{const kids=x.children||[],on=selected.includes(x.key),kidOn=kids.filter(k=>selected.includes(k[0])).length;if(!kids.length)return '<label class="access-leaf"><input type="checkbox" value="'+x.key+'" '+(on?'checked':'')+'><span><b>'+x.label+'</b></span></label>';return '<details class="access-module"><summary><span class="access-module-title">'+x.label+'</span><small>'+kidOn+'/'+kids.length+' ventanas</small></summary><div class="access-module-body"><label class="access-all"><input type="checkbox" value="'+x.key+'" '+(on?'checked':'')+'><span><b>Acceso completo al módulo</b><small>Permite todas las ventanas actuales del módulo</small></span></label>'+kids.map(k=>'<label><input type="checkbox" value="'+k[0]+'" '+(selected.includes(k[0])?'checked':'')+'><span><b>'+k[1]+'</b><small>Ventana interna</small></span></label>').join('')+'</div></details>'}).join('')}
let currentAuth=null,userAdminRows=[],editingUserId=null,roleAccessRows=[];
async function applyUserAccess(auth){
 currentAuth=auth||null;const token=sessionStorage.getItem(APP_SESSION_KEY),buttons=[...document.querySelectorAll('.nav [data-view]')];
 if(!token){buttons.forEach(b=>b.hidden=false);return}
 if(String(auth?.rol||'').toUpperCase()==='ADMINISTRADOR'){buttons.forEach(b=>b.hidden=false);return}
 try{
   const c=await getSupabaseClient(),{data,error}=await c.rpc('sgp_mis_accesos',{p_token:token});
   if(error)throw error;
   const access=(data||[]).map(x=>x.ventana);
   buttons.forEach(b=>{const v=b.dataset.view;b.hidden=!(access.includes(v)||access.some(x=>x.startsWith(v+'.')))});
   document.querySelectorAll('[data-mach-tab]').forEach(b=>{const key='mecanizado.'+({recepcion:'recepcion',faltantes:'faltantes',programacion:'programacion',produccion:'produccion'}[b.dataset.machTab]||b.dataset.machTab);b.hidden=!(access.includes('mecanizado')||access.includes(key))});
   document.querySelectorAll('[data-daily-tab]').forEach(b=>{const key='actualizacion.'+b.dataset.dailyTab;b.hidden=!(access.includes('actualizacion')||access.includes(key))});
   const activeDaily=document.querySelector('[data-daily-tab].active');if(activeDaily?.hidden){document.querySelector('[data-daily-tab]:not([hidden])')?.click()}
   const active=document.querySelector('.nav [data-view].active');if(active?.hidden){const first=buttons.find(b=>!b.hidden);first?.click()}
 }catch(e){console.error('No se pudieron cargar permisos',e);buttons.forEach(b=>b.hidden=false)}
}
async function loadUserAdmin(){
 if(currentAuth?.rol!=='ADMINISTRADOR')return;const c=await getSupabaseClient(),{data,error}=await c.rpc('sgp_admin_usuarios_listar',{p_token:getAppToken()});if(error){alert(error.message);return}userAdminRows=data||[];
 const body=document.querySelector('#userAdminBody');if(body)body.innerHTML=userAdminRows.map(u=>'<tr><td><b>'+escapeHtml(u.usuario)+'</b></td><td>'+escapeHtml(u.nombre)+'</td><td><span class="role-chip">'+escapeHtml(u.rol)+'</span></td><td><span class="access-count">'+(u.accesos||[]).length+' ventanas</span></td><td><span class="user-state '+(u.activo?'on':'off')+'">'+(u.activo?'ACTIVO':'INACTIVO')+'</span></td><td><button class="user-edit" data-user-edit="'+u.id_usuario+'">Editar</button></td></tr>').join('');
 body?.querySelectorAll('[data-user-edit]').forEach(b=>b.onclick=()=>openUserModal(userAdminRows.find(x=>x.id_usuario===b.dataset.userEdit)))
}
function renderAccessGrid(selected=[]){const h=document.querySelector('#userAccessGrid');if(!h)return;h.innerHTML=accessTreeHtml(selected,'user')}
function roleDefaults(rol){return roleAccessRows.filter(x=>x.rol===rol&&x.permitido).map(x=>x.ventana)}
async function loadRoleAccess(){const c=await getSupabaseClient(),{data,error}=await c.rpc('sgp_admin_rol_accesos_listar',{p_token:getAppToken()});if(!error)roleAccessRows=data||[];renderRoleManager()}
function renderRoleManager(){const box=document.querySelector('#roleAccessManager');if(!box)return;const roles=[...document.querySelector('#userRole').options].map(o=>o.value);box.innerHTML=roles.map(r=>{const defs=roleDefaults(r);return '<details class="role-block"><summary>'+r+' <small>'+defs.length+' accesos por defecto</small></summary><div class="role-access-tree" data-role="'+r+'>'+accessTreeHtml(defs,'role')+'<button type="button" class="role-save" data-save-role="'+r+'">Guardar accesos del rol</button></div></details>'}).join('');box.querySelectorAll('[data-save-role]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const r=b.dataset.saveRole,root=b.closest('[data-role]');if(!root)return alert('No se pudo identificar el rol a guardar');const vals=[...root.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);const original=b.textContent;b.disabled=true;b.textContent='Guardando…';try{const c=await getSupabaseClient(),{error}=await c.rpc('sgp_admin_rol_accesos_guardar',{p_token:getAppToken(),p_rol:r,p_accesos:vals});if(error)throw error;await loadRoleAccess();const saved=[...roleAccessRows.filter(x=>x.rol===r&&x.permitido).map(x=>x.ventana)];if(saved.length!==vals.length||vals.some(v=>!saved.includes(v)))throw new Error('La verificación posterior no coincide con los accesos seleccionados');alert('Accesos de '+r+' guardados correctamente')}catch(err){console.error('Error guardando accesos del rol',err);alert('No fue posible guardar los accesos: '+(err?.message||err))}finally{b.disabled=false;b.textContent=original}})}
function openUserModal(u=null){editingUserId=u?.id_usuario||null;document.querySelector('#userModalTitle').textContent=u?'Editar usuario':'Nuevo usuario';document.querySelector('#userName').value=u?.usuario||'';document.querySelector('#userFullName').value=u?.nombre||'';const role=u?.rol||'RECEPCION';document.querySelector('#userRole').value=role;document.querySelector('#userPassword').value='';document.querySelector('#userActive').checked=u?.activo??true;renderAccessGrid(u?.accesos?.length?u.accesos:roleDefaults(role));document.querySelector('#resetPasswordBtn').hidden=!u;document.querySelector('#userModal').hidden=false}
function closeUserModal(){document.querySelector('#userModal').hidden=true;editingUserId=null}
async function saveUser(){
 const args={p_token:getAppToken(),p_id_usuario:editingUserId,p_usuario:document.querySelector('#userName').value,p_nombre:document.querySelector('#userFullName').value,p_rol:document.querySelector('#userRole').value,p_password:document.querySelector('#userPassword').value,p_activo:document.querySelector('#userActive').checked,p_accesos:[...document.querySelectorAll('#userAccessGrid input:checked')].map(x=>x.value)};
 const c=await getSupabaseClient(),{error}=await c.rpc('sgp_admin_usuario_guardar',args);if(error){alert(error.message);return}closeUserModal();await loadUserAdmin()
}
document.querySelectorAll('[data-config-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-config-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-config-panel]').forEach(p=>p.hidden=p.dataset.configPanel!==b.dataset.configTab);if(b.dataset.configTab==='usuarios')loadUserAdmin();if(b.dataset.configTab==='roles')loadRoleAccess()}));
document.querySelector('#newUserBtn')?.addEventListener('click',()=>openUserModal());document.querySelector('#userRole')?.addEventListener('change',e=>{if(!editingUserId||confirm('¿Aplicar los accesos por defecto del rol '+e.target.value+'?'))renderAccessGrid(roleDefaults(e.target.value))});document.querySelector('#resetPasswordBtn')?.addEventListener('click',async()=>{if(!editingUserId)return;const pw=prompt('Nueva contraseña temporal (mínimo 4 caracteres):');if(pw===null)return;const c=await getSupabaseClient(),{error}=await c.rpc('sgp_admin_password_restablecer',{p_token:getAppToken(),p_id_usuario:editingUserId,p_password:pw});if(error)return alert(error.message);alert('Contraseña restablecida correctamente')});document.querySelector('#userModalClose')?.addEventListener('click',closeUserModal);document.querySelector('#userCancel')?.addEventListener('click',closeUserModal);document.querySelector('#userSave')?.addEventListener('click',saveUser);
function currentFilters() { return { q: els.search?.value||"", estado: els.state?.value||"", linea: els.line?.value||"" }; }
function renderMecanizado() {
  if(!els.tbody||!els.total||!els.delivered||!els.warehouse||!els.supply)return;
  const rows = mecanizado.filterRows(currentFilters());
  els.total.textContent = rows.length;
  els.delivered.textContent = rows.filter(r => r.estado === "ALUMINIO_ENTREGADO").length;
  els.warehouse.textContent = rows.filter(r => r.estado === "PENDIENTE_BODEGA").length;
  els.supply.textContent = rows.filter(r => r.estado === "PENDIENTE_ABASTECIMIENTO").length;
  els.tbody.innerHTML = mecanizado.renderTable(rows);
}
function weeklyStepValid(name){
  if(name==="programming") return !!targetWeek && validatedProductions.length>0;
  if(name==="pieces") return !!validatedPieces && !validatedPieces.errors?.length && !validatedPieces.unclassified && !validatedPieces.conflicts;
  if(name==="accessories") return !!validatedAccessories && !validatedAccessories.errors?.length && !validatedAccessories.conflicts;
  if(name==="glass") return !!validatedGlass && !validatedGlass.errors?.length && !validatedGlass.conflicts;
  if(name==="final") return weeklyPackageStatus().ready;
  return false;
}
const weeklySteps=["programming","pieces","accessories","glass","final"];
function openWeeklyTab(name){
  const idx=weeklySteps.indexOf(name);
  const firstPending=weeklySteps.findIndex(step=>!weeklyStepValid(step));
  const maxUnlocked=firstPending<0?weeklySteps.length-1:firstPending;
  const unlocked=idx<=maxUnlocked || weeklyStepValid(name);
  if(!unlocked)return;
  document.querySelectorAll("[data-weekly-tab]").forEach(b=>b.classList.toggle("active",b.dataset.weeklyTab===name));
  document.querySelectorAll("[data-weekly-panel]").forEach(p=>{p.hidden=p.dataset.weeklyPanel!==name;p.classList.toggle("active",p.dataset.weeklyPanel===name);});
}
function refreshWeeklyTabs(autoAdvanceFrom){
  document.querySelectorAll("[data-weekly-tab]").forEach((b,i)=>{
    const name=b.dataset.weeklyTab, firstPending=weeklySteps.findIndex(step=>!weeklyStepValid(step)), maxUnlocked=firstPending<0?weeklySteps.length-1:firstPending, valid=weeklyStepValid(name), unlocked=i<=maxUnlocked||valid;
    b.disabled=!unlocked;b.classList.toggle("validated",valid);b.classList.toggle("locked",!unlocked);
    const badge=b.querySelector("span");if(badge)badge.textContent=valid?"✓":String(i+1);
  });
  document.querySelectorAll("[data-weekly-check]").forEach(x=>x.classList.toggle("ok",weeklyStepValid(x.dataset.weeklyCheck)));
  if(autoAdvanceFrom&&weeklyStepValid(autoAdvanceFrom)){const next=weeklySteps[weeklySteps.indexOf(autoAdvanceFrom)+1];if(next)openWeeklyTab(next);}
}

function openDailyTab(name){
  document.querySelectorAll("[data-weekly-tab]").forEach(b=>b.addEventListener("click",()=>openWeeklyTab(b.dataset.weeklyTab)));
document.querySelectorAll("[data-daily-tab]").forEach(b=>b.classList.toggle("active",b.dataset.dailyTab===name));
  document.querySelectorAll("[data-daily-panel]").forEach(p=>{p.hidden=p.dataset.dailyPanel!==name;p.classList.toggle("active",p.dataset.dailyPanel===name);});
}

function openView(viewName) {
  els.views.forEach(view => { view.hidden = view.dataset.viewPanel !== viewName; });
  els.nav.forEach(button => button.classList.toggle("active", button.dataset.view === viewName));
}
function refreshWeeklyRelations() {
  if (!validatedProductions.length) return;
  if (validatedAccessories) {
    const relation = relateAccessories(validatedAccessories.rows, validatedProductions);
    els.xRelated.textContent = relation.related;
    els.xNoMatch.textContent = relation.noMatch;
    renderAccessoryNoMatches(relation);
    els.accessoriesStatus.textContent = validatedAccessories.errors.length
      ? `Bloqueado: ${validatedAccessories.errors.length} error(es).`
      : `Correcto: ${validatedAccessories.rows.length} filas · ${relation.sourceGroups} grupos Producción + Sistema · ${relation.related} relacionados · ${relation.noMatch} sin relación · ${relation.conflicts} conflictos.`;
  }
  if (validatedGlass) {
    const relation = relateGlass(validatedGlass.rows, validatedProductions);
    els.gRelated.textContent = relation.related;
    els.gNoMatch.textContent = relation.noMatch;
    renderGlassNoMatches(relation);
    els.glassStatus.textContent = `Correcto: ${validatedGlass.rows.length} registros útiles · ${relation.sourceGroups} IDs únicos · ${relation.related} relacionados con PANELES_2 · ${relation.noMatch} sin relación informativa · ${relation.conflicts} conflictos.`;
  }
}

async function validateProgrammingFiles() {
  const files = [...(els.files.files || [])];
  const requestedWeek = Number(els.targetWeek.value);
  if (!Number.isInteger(requestedWeek) || requestedWeek < 1 || requestedWeek > 53) { validatedProductions=[]; targetWeek=null; els.importStatus.textContent="Indica una semana válida (1 a 53) antes de validar."; refreshWeeklyPackageGate(); return; }
  targetWeek = requestedWeek;
  if (!files.length) { els.importStatus.textContent = "Selecciona archivos XLSX."; return; }
  els.validate.disabled = true;
  els.commit.disabled = true;
  els.importStatus.textContent = "Validando…";
  const rows = [], errors = [];
  try {
    for (const file of files) {
      const result = await readProgrammingWorkbook(file);
      rows.push(...result.rows);
      errors.push(...result.errors);
    }
    const allKeys = new Set();
    for (const row of rows) {
      if (allKeys.has(row.key_produccion)) errors.push({ id: row.id, reason: "KEY duplicada entre archivos" });
      allKeys.add(row.key_produccion);
    }
    const weekMismatches = rows.filter(row => Number(row.semana_base) !== requestedWeek);
    if (weekMismatches.length) errors.push({ reason: `${weekMismatches.length} producción(es) no pertenecen a la semana ${requestedWeek}` });
    validatedProductions = errors.length ? [] : rows;
    const summary = summarizeProgramming(rows);
    els.iTotal.textContent = summary.total;
    els.iKeys.textContent = summary.uniqueKeys;
    els.iErrors.textContent = errors.length;
    const entries = Object.entries(summary.byWeekLine).sort();
    els.importBody.innerHTML = entries.length ? entries.map(([key, count]) => {
      const [week, line] = key.split("|");
      return `<tr><td>${week}</td><td>${line}</td><td>${count}</td></tr>`;
    }).join("") : '<tr><td colspan="3" class="empty">Sin registros válidos</td></tr>';
    els.commit.disabled = true;
    els.importStatus.textContent = errors.length ? `Validación bloqueada para semana ${requestedWeek}: ${errors.map(e=>e.reason).filter(Boolean).join(" · ")}` : `Validación correcta: semana ${requestedWeek} · ${rows.length} producciones listas.`;
  } catch (error) {
    validatedProductions = [];
    targetWeek = null;
    els.importStatus.textContent = "Error: " + error.message;
  } finally { els.validate.disabled = false; refreshWeeklyRelations(); refreshWeeklyPackageGate(); refreshWeeklyTabs("programming"); }
}
let aluminumTrackingRows=[],aluminumTrackingPreview=null;
async function validateAluminumFile() {
 const file=els.aluminumFile.files?.[0];if(!file){els.aluminumStatus.textContent="Selecciona el archivo de seguimiento.";return}
 els.validateAluminum.disabled=true;els.applyAluminumTracking.disabled=true;els.aluminumStatus.textContent="Validando…";
 try{const result=await readAluminumTrackingWorkbook(file);if(result.errors.length)throw new Error(result.errors.length+" error(es) en el archivo");aluminumTrackingRows=result.rows;const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_previsualizar_seguimiento_aluminio",{p_token:token,p_datos:aluminumTrackingRows});if(error)throw error;aluminumTrackingPreview={...data,file:file.name};els.aTotal.textContent=data.recibidos||0;const sum=summarizeAluminumTracking(aluminumTrackingRows);if(els.aSupply)els.aSupply.textContent=sum.states.PENDIENTE_ABASTECIMIENTO||0;if(els.aWarehouse)els.aWarehouse.textContent=sum.states.PENDIENTE_BODEGA||0;els.aDelivered.textContent=sum.states.ALUMINIO_ENTREGADO||0;els.aluminumStatus.textContent="Validación completada · "+(data.reservas||0)+" reservas · "+(data.producciones||0)+" producciones · "+(data.nuevas_relaciones||0)+" relaciones Reserva + ID nuevas · Semanas: "+Object.entries(data.por_semana||{}).map(([w,n])=>w+": "+n).join(" · ")+" · No se ha escrito información.";els.applyAluminumTracking.disabled=false}catch(error){els.aluminumStatus.textContent="Validación bloqueada: "+error.message}finally{els.validateAluminum.disabled=false}
}
async function applyAluminumTracking(){
 if(!aluminumTrackingPreview)return;els.applyAluminumTracking.disabled=true;els.aluminumStatus.textContent="Aplicando seguimiento…";
 try{const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_aplicar_seguimiento_aluminio",{p_token:token,p_nombre_archivo:aluminumTrackingPreview.file,p_datos:aluminumTrackingRows});if(error)throw error;els.aluminumStatus.textContent=`Seguimiento actualizado ✓ · ${data.nuevas_relaciones} relaciones Reserva + ID nuevas · ${data.relaciones_existentes} existentes · ${data.cambios} cambios de estado/semana`}catch(error){els.aluminumStatus.textContent="Aplicación rechazada ✕ "+error.message;els.applyAluminumTracking.disabled=false}
}

async function validatePiecesFile() {
  const file = els.piecesFile.files?.[0];
  if (!file) { els.piecesStatus.textContent = "Selecciona el listado de piezas."; return; }
  els.validatePieces.disabled = true;
  els.piecesStatus.textContent = "Validando estructura…";
  try {
    els.piecesStatus.textContent = "1/3 Leyendo archivo XLSX…";
    await new Promise(resolve => requestAnimationFrame(resolve));
    const result = await readAluminumPiecesWorkbook(file);
    const summary = summarizeAluminumPieces(result.rows);
    els.pTotal.textContent = summary.total;
    els.pOrders.textContent = summary.productionOrders;
    els.pCodes.textContent = summary.sapCodes;
    els.pErrors.textContent = result.errors.length;
    els.piecesStatus.textContent = `2/3 Estructura leída: ${summary.total} filas. Consultando ${summary.sapCodes} códigos SAP en el Maestro…`;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const requestedCodes = [...new Set(result.rows.map(row => row.codigo_sap))];
    const master = await Promise.race([
      classifyPieceCodes(requestedCodes),
      new Promise((_, reject) => setTimeout(() => reject(new Error("La consulta al Maestro superó 15 segundos.")), 15000))
    ]);
    els.piecesStatus.textContent = "3/3 Clasificando piezas…";
    await new Promise(resolve => requestAnimationFrame(resolve));
    const classification = classifyAluminumPieces(result.rows, master);
    els.pUnclassified.textContent = classification.unclassified.length;
    const pieceRelation = validatedProductions.length ? relateAluminumPieces(result.rows, validatedProductions) : null;
    els.pRelated.textContent = pieceRelation ? pieceRelation.related : "—";
    els.pNoMatch.textContent = pieceRelation ? pieceRelation.noMatch : "—";
    renderPiecesNoMatches(pieceRelation || { noMatchRows: [] });
    validatedPieces = { rows: classification.rows, errors: result.errors, unclassified: classification.unclassified.length, conflicts: pieceRelation?.conflicts || 0 };
    const lineText = Object.entries(summary.lines).map(([line,count]) => `${line}: ${count}`).join(" · ");
    els.piecesStatus.textContent = result.errors.length
      ? `Validación bloqueada: ${result.errors.length} error(es) de estructura.`
      : classification.unclassified.length
        ? `Terminado. ${lineText}. ${classification.unclassified.length} fila(s) con SAP no clasificado.`
        : `Terminado. ${summary.total} filas clasificadas · ${summary.sapCodes} códigos SAP · ${lineText} · 0 sin clasificar${pieceRelation ? ` · ${pieceRelation.sourceGroups} grupos Producción + Sistema · ${pieceRelation.related} relacionados · ${pieceRelation.noMatch} sin relación informativa · ${pieceRelation.conflicts} conflictos` : ""}.`;
  } catch (error) {
    validatedPieces = null;
    els.pUnclassified.textContent = "—";
    els.piecesStatus.textContent = "Error: " + error.message;
  } finally {
    els.validatePieces.disabled = false;
    refreshWeeklyPackageGate();
    refreshWeeklyTabs("pieces");
  }
}

async function validateAccessoriesFile() {
  const file=els.accessoriesFile.files?.[0];
  if(!file){els.accessoriesStatus.textContent="Selecciona el archivo de Accesorios.";return;}
  els.validateAccessories.disabled=true; els.accessoriesStatus.textContent="Validando…";
  try{
    const result=await readAccessoriesWorkbook(file);
    validatedAccessories=result;
    const relation=relateAccessories(result.rows,validatedProductions);
    els.xTotal.textContent=result.rows.length; els.xErrors.textContent=result.errors.length;
    els.xRelated.textContent=validatedProductions.length?relation.related:"—";
    els.xNoMatch.textContent=validatedProductions.length?relation.noMatch:"—";
    renderAccessoryNoMatches(validatedProductions.length ? relation : { noMatchRows: [] });
    validatedAccessories.conflicts = relation.conflicts;
    els.accessoriesStatus.textContent=result.errors.length?`Bloqueado: ${result.errors.length} error(es).`:validatedProductions.length?`Correcto: ${result.rows.length} filas · ${relation.sourceGroups} grupos Producción + Sistema · ${relation.related} relacionados · ${relation.noMatch} sin relación · ${relation.conflicts} conflictos.`:`Estructura correcta: ${result.rows.length} registros. Valida primero Programación para ejecutar el cruce Producción + Sistema.`;
  }catch(error){validatedAccessories=null;els.accessoriesStatus.textContent="Error: "+error.message;}finally{els.validateAccessories.disabled=false;refreshWeeklyPackageGate();refreshWeeklyTabs("accessories");}
}
async function validateGlassFile() {
  const file=els.glassFile.files?.[0];
  if(!file){els.glassStatus.textContent="Selecciona el archivo de Vidrio.";return;}
  els.validateGlass.disabled=true; els.glassStatus.textContent="Validando…";
  try{
    const result=await readGlassWorkbook(file);
    validatedGlass=result;
    const relation=relateGlass(result.rows,validatedProductions);
    els.gTotal.textContent=result.rows.length; els.gSkipped.textContent=result.skipped.length; els.gErrors.textContent=result.errors.length;
    els.gRelated.textContent=validatedProductions.length?relation.related:"—";
    els.gNoMatch.textContent=validatedProductions.length?relation.noMatch:"—";
    renderGlassNoMatches(validatedProductions.length ? relation : { noMatchRows: [] });
    validatedGlass.conflicts = relation.conflicts;
    els.glassStatus.textContent=validatedProductions.length?`Correcto: ${result.rows.length} registros útiles · ${relation.sourceGroups} IDs únicos · ${relation.related} relacionados con PANELES_2 · ${relation.noMatch} sin relación informativa · ${relation.conflicts} conflictos.`:`Estructura leída: ${result.rows.length} registros útiles. Valida primero Programación para ejecutar el cruce por ID.`;
  }catch(error){validatedGlass=null;els.glassStatus.textContent="Error: "+error.message;}finally{els.validateGlass.disabled=false;refreshWeeklyPackageGate();refreshWeeklyTabs("glass");}
}

async function previewWeeklyLoad() {
  const status = weeklyPackageStatus();
  if (!status.ready) { els.previewStatus.textContent = "El paquete debe estar completamente validado."; return; }
  els.previewLoad.disabled = true;
  els.previewStatus.textContent = "Consultando Supabase…";
  try {
    const client = await getSupabaseClient();
    const yearValues = [...new Set(validatedProductions.map(r => Number(r.anio)).filter(Number.isFinite))];
    const year = yearValues.length === 1 ? yearValues[0] : new Date().getFullYear();
    const { data, error } = await client.rpc("sgp_previsualizar_carga_semanal", { p_anio: year, p_semana: targetWeek });
    if (error) throw error;
    const existing = data?.existente || {};
    const piecesPayload = prepareAluminumPiecePayload(validatedPieces.rows, validatedProductions);
    const accessoriesPayload = prepareAccessoryPayload(validatedAccessories.rows, validatedProductions);
    const glassPayload = prepareGlassPayload(validatedGlass.rows, validatedProductions);
    els.previewStatus.textContent = "Previsualización correcta. Ejecutando validación server-side…";
    const { data: serverCheck, error: serverError } = await client.rpc("sgp_validar_paquete_semanal", {
      p_anio: year, p_semana: targetWeek, p_programacion: validatedProductions,
      p_piezas: piecesPayload, p_accesorios: accessoriesPayload, p_vidrio: glassPayload
    });
    if (serverError) throw serverError;
    const counts = serverCheck?.conteos || {};
    const errs = serverCheck?.errores || {};
    const serverOk = serverCheck?.valido === true;
    els.previewStatus.innerHTML =
      `<strong>${escapeHtml(data?.modo || "—")} · Semana ${escapeHtml(targetWeek)} / ${escapeHtml(year)}</strong><br>` +
      `Servidor: <strong>${serverOk ? "Validación servidor ✓" : "BLOQUEADO"}</strong> · ${counts.programacion ?? 0} producciones · ${counts.piezas ?? 0} piezas · ${counts.accesorios ?? 0} accesorios · ${counts.vidrio ?? 0} vidrio.<br>` +
      `Existente en Supabase: ${existing.producciones ?? 0} producciones · ${existing.piezas_aluminio ?? 0} piezas · ${existing.accesorios ?? 0} accesorios · ${existing.vidrio_relacionado ?? 0} vidrio · ${existing.lotes ?? 0} lotes.<br>` +
      (serverOk ? "" : `Errores servidor: ${escapeHtml(JSON.stringify(errs))}<br>`) +
      `Escritura realizada: <strong>NO</strong>.`;
  } catch (error) {
    els.previewStatus.textContent = "No fue posible previsualizar: " + error.message;
  } finally {
    els.previewLoad.disabled = !weeklyPackageStatus().ready;
  }
}

function hasMuntin(r) {
  return !["","NO","N","0","FALSE"].includes(String(r.muntin ?? "").trim().toUpperCase());
}
function filteredProgrammingRows() {
  const line=els.queryLine.value;
  const term=els.querySearch.value.trim().toLowerCase();
  return queriedProductions.filter(r=>(!line||r.id_linea===line)&&(!term||[r.id,r.reserva_al,r.produccion,r.sistema,r.proyecto,r.cliente,r.acabado].some(v=>String(v??"").toLowerCase().includes(term))));
}
function renderDetailHead(){
  if(!els.queryHead)return;
  const cols=detailColumns.filter(c=>!detailHidden.has(c.key));
  els.queryHead.innerHTML='<tr>'+cols.map(c=>`<th data-col-key="${c.key}"><button type="button" class="sheet-filter-btn" data-sheet-filter="${c.key}"><span>${escapeHtml(c.label)}${detailSort.key===c.key?(detailSort.dir>0?' ▲':' ▼'):''}</span><span>▾</span></button></th>`).join('')+'</tr>';
  bindSheetFilters(document.querySelector("#queryTable"),()=>filteredProgrammingRows(),detailColumns,detailColumnFilters,(k,dir)=>{detailSort={key:k,dir};renderQueriedProgramming()},()=>renderQueriedProgramming());
}
function detailValue(r,key){
  if(key==='muntin')return hasMuntin(r)?'SI':'NO';
  return r[key]??'';
}
function renderQueriedProgramming(){
  if(!els.queryBody)return;
  const baseRows=filteredProgrammingRows();
  const units=baseRows.reduce((n,r)=>n+Number(r.cantidad||0),0);
  els.qTotal.textContent=baseRows.length;els.qUnits.textContent=units;els.qVisible.textContent=baseRows.length;
  const systems=new Map(),types=new Map(),reservations=new Map();
  baseRows.forEach(r=>{
    const system=r.sistema||'SIN SISTEMA',reserva=String(r.reserva_al??'').trim()||'SIN RESERVA',acabado=r.acabado||'SIN ACABADO',qty=Number(r.cantidad||0),hm=hasMuntin(r);
    if(!systems.has(system))systems.set(system,{sistema:system,reservas:new Set(),producciones:0,unidades:0,prodMuntin:0,unidMuntin:0});
    const sg=systems.get(system);sg.reservas.add(reserva);sg.producciones++;sg.unidades+=qty;if(hm){sg.prodMuntin++;sg.unidMuntin+=qty}
    if(!types.has(system))types.set(system,{sistema:system,proyecto:0,retail:0});
    const tg=types.get(system),tipo=String(r.tipo||'').toUpperCase();if(tipo==='PROYECTO')tg.proyecto+=qty;if(tipo==='RETAIL')tg.retail+=qty;
    const rk=reserva+'|'+system+'|'+acabado;if(!reservations.has(rk))reservations.set(rk,{reserva,sistema:system,acabado,producciones:0,unidades:0,prodMuntin:0,unidMuntin:0});
    const rg=reservations.get(rk);rg.producciones++;rg.unidades+=qty;if(hm){rg.prodMuntin++;rg.unidMuntin+=qty}
  });
  const summary=[...systems.values()].sort((x,y)=>y.unidades-x.unidades);
  els.systemSummaryBody.innerHTML=summary.map(g=>`<tr class="${g.prodMuntin?'has-muntin-summary':''}"><td><strong>${escapeHtml(g.sistema)}</strong></td><td>${g.reservas.size}</td><td>${g.producciones}</td><td><strong>${g.unidades}</strong></td><td>${g.prodMuntin}</td><td>${g.unidMuntin}</td></tr>`).join('');
  els.systemSummaryFoot.innerHTML=`<tr><td>TOTAL</td><td>${new Set(baseRows.map(r=>String(r.reserva_al??'').trim()||'SIN RESERVA')).size}</td><td>${baseRows.length}</td><td>${units}</td><td>${baseRows.filter(hasMuntin).length}</td><td>${baseRows.filter(hasMuntin).reduce((n,r)=>n+Number(r.cantidad||0),0)}</td></tr>`;
  const typeRows=[...types.values()].sort((x,y)=>(y.proyecto+y.retail)-(x.proyecto+x.retail));
  els.typeSummaryBody.innerHTML=typeRows.map(g=>`<tr><td><strong>${escapeHtml(g.sistema)}</strong></td><td>${g.proyecto}</td><td>${g.retail}</td><td><strong>${g.proyecto+g.retail}</strong></td></tr>`).join('');
  const projectTotal=typeRows.reduce((n,g)=>n+g.proyecto,0),retailTotal=typeRows.reduce((n,g)=>n+g.retail,0);
  els.typeSummaryFoot.innerHTML=`<tr><td>TOTAL</td><td>${projectTotal}</td><td>${retailTotal}</td><td>${projectTotal+retailTotal}</td></tr>`;
  const rr=[...reservations.values()].sort((x,y)=>x.sistema.localeCompare(y.sistema)||x.reserva.localeCompare(y.reserva,undefined,{numeric:true})||x.acabado.localeCompare(y.acabado));
  els.reservationSummaryBody.innerHTML=rr.map(g=>`<tr class="${g.prodMuntin?'has-muntin-summary':''}"><td><strong>${escapeHtml(g.sistema)}</strong></td><td>${escapeHtml(g.reserva)}</td><td>${escapeHtml(g.acabado)}</td><td>${g.producciones}</td><td><strong>${g.unidades}</strong></td><td>${g.prodMuntin}</td><td>${g.unidMuntin}</td></tr>`).join('');
  els.reservationSummaryFoot.innerHTML=`<tr><td>TOTAL</td><td></td><td></td><td>${baseRows.length}</td><td>${units}</td><td>${baseRows.filter(hasMuntin).length}</td><td>${baseRows.filter(hasMuntin).reduce((n,r)=>n+Number(r.cantidad||0),0)}</td></tr>`;

  let rows=baseRows.filter(r=>detailColumns.filter(c=>!detailHidden.has(c.key)).every(c=>!detailColumnFilters[c.key]||String(detailValue(r,c.key)).toLowerCase().includes(detailColumnFilters[c.key].toLowerCase())));
  if(detailSort.key)rows=[...rows].sort((x,y)=>String(detailValue(x,detailSort.key)).localeCompare(String(detailValue(y,detailSort.key)),undefined,{numeric:true})*detailSort.dir);
  els.qVisible.textContent=rows.length;renderDetailHead();
  let prev=null,idx=-1;
  els.queryBody.innerHTML=rows.length?rows.map(r=>{const reserva=String(r.reserva_al??'').trim()||'SIN RESERVA';if(reserva!==prev){idx++;prev=reserva}const hm=hasMuntin(r);
    return `<tr class="${idx%2===0?'reservation-alt':''} ${hm?'has-muntin':''}">${detailColumns.filter(c=>!detailHidden.has(c.key)).map(c=>{let v=detailValue(r,c.key);if(c.key==='reserva_al')return `<td><button class="piece-link" data-piece-mode="reserva" data-piece-value="${escapeHtml(reserva)}">${escapeHtml(reserva)}</button></td>`;if(c.key==='produccion')return `<td><button class="piece-link" data-piece-mode="produccion" data-piece-value="${escapeHtml(r.produccion)}">${escapeHtml(r.produccion)}</button></td>`;if(c.key==='muntin')v=hm?'SÍ · '+(r.cantidad_muntin??r.cantidad??''):'—';return `<td>${escapeHtml(v||'—')}</td>`}).join('')}</tr>`;
  }).join(''):`<tr><td colspan="${detailColumns.filter(c=>!detailHidden.has(c.key)).length}" class="empty">No hay registros con los filtros seleccionados.</td></tr>`;
}
function basePieceDescription(s){
  return String(s||'').replace(/\s+[A-Z]$/i,'').trim();
}
function renderPieceModal(){
  const src=currentPieceRows;
  document.querySelectorAll('[data-piece-view]').forEach(b=>b.classList.toggle('active',b.dataset.pieceView===currentPieceView));
  els.pieceDetailedOptions.hidden=currentPieceView!=='detailed';
  if(currentPieceView==='summary'){
    const map=new Map();src.forEach(r=>{const k=r.codigo_sap;if(!map.has(k))map.set(k,{perfil:k,descripcion:basePieceDescription(r.descripcion),cantidad:0});map.get(k).cantidad+=Number(r.cantidad||0)});
    const rows=[...map.values()].sort((x,y)=>String(x.perfil).localeCompare(String(y.perfil),undefined,{numeric:true}));
    els.pieceProfileHead.innerHTML='<tr><th>Perfil</th><th>Descripción</th><th>Cantidad</th></tr>';
    els.pieceProfileBody.innerHTML=rows.map(x=>`<tr><td><strong>${escapeHtml(x.perfil)}</strong></td><td>${escapeHtml(x.descripcion)}</td><td><strong>${x.cantidad}</strong></td></tr>`).join('');
    els.pieceProfileFoot.innerHTML=`<tr><td>TOTAL</td><td></td><td>${rows.reduce((n,x)=>n+x.cantidad,0)}</td></tr>`;return;
  }
  if(currentPieceView==='expanded'){
    const map=new Map();src.forEach(r=>{const k=[r.codigo_sap,r.marca].join('|');if(!map.has(k))map.set(k,{perfil:r.codigo_sap,descripcion:basePieceDescription(r.descripcion),marca:r.marca||'—',cantidad:0});map.get(k).cantidad+=Number(r.cantidad||0)});
    const rows=[...map.values()].sort((x,y)=>String(x.perfil).localeCompare(String(y.perfil),undefined,{numeric:true})||String(x.marca).localeCompare(String(y.marca),undefined,{numeric:true}));
    els.pieceProfileHead.innerHTML='<tr><th>Perfil</th><th>Descripción</th><th>Marca</th><th>Cantidad</th></tr>';
    els.pieceProfileBody.innerHTML=rows.map(x=>`<tr><td><strong>${escapeHtml(x.perfil)}</strong></td><td>${escapeHtml(x.descripcion)}</td><td>${escapeHtml(x.marca)}</td><td><strong>${x.cantidad}</strong></td></tr>`).join('');
    els.pieceProfileFoot.innerHTML=`<tr><td>TOTAL</td><td></td><td></td><td>${rows.reduce((n,x)=>n+x.cantidad,0)}</td></tr>`;return;
  }
  const selected=[...els.pieceDetailedOptions.querySelectorAll('input:checked')].map(x=>x.value);
  const fixed=['perfil','descripcion'],cols=[...pieceDetailColumns].filter(c=>fixed.includes(c)||selected.includes(c)||c==='cantidad');
  const labels={perfil:'Perfil',descripcion:'Descripción',marca:'Marca',fabricacion:'Fabricación',longitud:'Longitud',cantidad:'Cantidad'};
  const map=new Map();src.forEach(r=>{const obj={perfil:r.codigo_sap,descripcion:basePieceDescription(r.descripcion),marca:r.marca||'—',fabricacion:r.fabricacion||'—',longitud:r.longitud||'—'};const k=cols.filter(c=>c!=='cantidad').map(c=>obj[c]).join('|');if(!map.has(k))map.set(k,{...obj,cantidad:0});map.get(k).cantidad+=Number(r.cantidad||0)});
  const rows=[...map.values()];
  els.pieceProfileHead.innerHTML='<tr>'+cols.map((c,i)=>`<th><span>${labels[c]}</span> <button type="button" data-piece-move="${c}:-1">←</button><button type="button" data-piece-move="${c}:1">→</button></th>`).join('')+'</tr>';
  els.pieceProfileBody.innerHTML=rows.map(x=>'<tr>'+cols.map(c=>`<td>${c==='perfil'?'<strong>'+escapeHtml(x[c])+'</strong>':escapeHtml(x[c])}</td>`).join('')+'</tr>').join('');
  els.pieceProfileFoot.innerHTML='<tr>'+cols.map((c,i)=>`<td>${i===0?'TOTAL':c==='cantidad'?rows.reduce((n,x)=>n+x.cantidad,0):''}</td>`).join('')+'</tr>';
}
async function openPieceModal(mode,value){
  const line=els.queryLine.value;if(!line){alert('Selecciona primero PANELES_2 o FRAMES_2.');return}
  const token=sessionStorage.getItem(APP_SESSION_KEY),year=Number(els.queryYear.value),week=Number(els.queryWeek.value),type=line==='PANELES_2'?'PANEL':'FRAME';
  els.pieceModal.hidden=false;els.pieceModalTitle.textContent=(mode==='reserva'?'Reserva ':'Producción ')+value;els.pieceModalMeta.textContent='Consultando piezas '+type+'…';
  try{const client=await getSupabaseClient();const {data,error}=await client.rpc('sgp_consultar_piezas_semana',{p_token:token,p_anio:year,p_semana:week});if(error)throw error;
    currentPieceRows=(data?.piezas||[]).filter(r=>String(r.tipo_pieza).toUpperCase()===type&&(mode==='reserva'?String(r.reserva)===String(value):String(r.produccion)===String(value)));
    const systems=[...new Set(currentPieceRows.map(r=>r.sistema).filter(Boolean))].join(', '),finishes=[...new Set(currentPieceRows.map(r=>r.acabado).filter(Boolean))].join(', ');
    els.pieceModalMeta.innerHTML=`<strong>Línea:</strong> ${escapeHtml(type)} &nbsp; <strong>Sistema:</strong> ${escapeHtml(systems||'—')} &nbsp; <strong>Acabado:</strong> ${escapeHtml(finishes||'—')}`;
    currentPieceView='summary';renderPieceModal();
  }catch(e){els.pieceModalMeta.textContent='No fue posible consultar piezas: '+e.message}
}
async function queryWeeklyProgramming() {
  const token=sessionStorage.getItem(APP_SESSION_KEY), year=Number(els.queryYear.value), week=Number(els.queryWeek.value);
  if (!token) { els.queryStatus.textContent="Inicia sesión para consultar la programación."; return; }
  els.queryProgramming.disabled=true; els.queryStatus.textContent=`Consultando semana ${week} / ${year}…`;
  try {
    const client=await getSupabaseClient();
    const {data,error}=await client.rpc("sgp_consultar_programacion_semana",{p_token:token,p_anio:year,p_semana:week});
    if(error) throw error;
    queriedProductions=data?.producciones || []; queriedSystemSummary=data?.resumen_sistemas || [];
    els.qWeek.textContent=`${week} / ${year}`;
    els.queryStatus.textContent=queriedProductions.length ? `Semana ${week} cargada desde Supabase ✓ · ${queriedProductions.length} producciones.` : `No hay programación almacenada para la semana ${week} / ${year}.`;
    renderQueriedProgramming();
  } catch(error) { queriedProductions=[]; els.queryStatus.textContent="No fue posible consultar: "+error.message; renderQueriedProgramming(); }
  finally { els.queryProgramming.disabled=false; }
}



const assemblyDefaultColumns=[["semana_actual","Sem."],["prioridad","Prioridad"],["id","ID"],["produccion","Producción"],["sistema","Sistema"],["cantidad","Cant."],["ensamblado","Ensamblado"],["saldo_ensamble","Saldo Ens."],["estado_produccion","Estado"],["porc_vidrio","% Vidrio"],["tipo_vidrio","Tipo vidrio"],["medidas","Tamaños"],["ubicacion_vidrio","Ubicación vidrio"],["reserva_al","Reserva"],["estado_reserva_al","Estado reserva"],["acabado","Acabado"],["orden_oves","OVES"]];
let assemblyHidden=new Set(JSON.parse(localStorage.getItem("sgp_assembly_hidden_cols")||"[]"));
function assemblyColumns(){const keys=new Set(assemblyDefaultColumns.map(c=>c[0])),extra=[];assemblyRows.forEach(r=>Object.keys(r||{}).forEach(k=>{if(!keys.has(k)){keys.add(k);extra.push([k,k.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase())])}}));return [...assemblyDefaultColumns,...extra]}
function renderAssemblyPicker(){const b=document.querySelector("#assemblyColumnPicker");if(!b)return;const cols=assemblyColumns();b.innerHTML='<div class="nc-column-picker-grid">'+cols.map(c=>'<label><input type="checkbox" data-acol="'+escapeHtml(c[0])+'" '+(assemblyHidden.has(c[0])?'':'checked')+'> '+escapeHtml(c[1])+'</label>').join("")+'</div>';b.querySelectorAll("[data-acol]").forEach(x=>x.onchange=()=>{x.checked?assemblyHidden.delete(x.dataset.acol):assemblyHidden.add(x.dataset.acol);localStorage.setItem("sgp_assembly_hidden_cols",JSON.stringify([...assemblyHidden]));renderAssembly()})}
document.querySelector("#assemblyChooseColumns")?.addEventListener("click",()=>{const b=document.querySelector("#assemblyColumnPicker");if(!b)return;b.hidden=!b.hidden;if(!b.hidden)renderAssemblyPicker()});
let assemblyColumnFilters={},assemblySort={key:null,dir:1};let assemblyColumnOrder=JSON.parse(localStorage.getItem('sgp_assembly_col_order')||'[]');
function renderAssembly(){if(!els.assemblyBody)return;const q=String(els.assemblySearch?.value||"").trim().toLowerCase(),state=els.assemblyState?.value||"";let rows=assemblyRows.filter(r=>(!state||r.estado_produccion===state)&&(!q||Object.values(r).some(v=>String(v??"").toLowerCase().includes(q))));rows=rows.filter(r=>Object.entries(assemblyColumnFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(String(r[k]??""))));if(assemblySort.key)rows=[...rows].sort((a,b)=>String(a[assemblySort.key]??"").localeCompare(String(b[assemblySort.key]??""),undefined,{numeric:true})*assemblySort.dir);const n=v=>Number(v??0),pct=v=>v==null?"—":(n(v)<=1?Math.round(n(v)*100):Math.round(n(v)))+"%";els.asTotal.textContent=rows.length;els.asBalance.textContent=rows.reduce((a,r)=>a+n(r.saldo_ensamble),0);els.asOpen.textContent=rows.filter(r=>r.estado_produccion==="ABIERTA").length;els.asClosed.textContent=rows.filter(r=>r.estado_produccion==="CERRADA").length;els.asAssembled.textContent=rows.filter(r=>r.estado_produccion==="ENSAMBLADA").length;let cols=assemblyColumns().filter(c=>!assemblyHidden.has(c[0]));if(assemblyColumnOrder.length){const pos=new Map(assemblyColumnOrder.map((k,i)=>[k,i]));cols=[...cols].sort((a,b)=>(pos.has(a[0])?pos.get(a[0]):9999)-(pos.has(b[0])?pos.get(b[0]):9999))}const head=document.querySelector("#assemblyHead");if(head){head.innerHTML="<tr>"+cols.map(c=>'<th data-col-key="'+escapeHtml(c[0])+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+escapeHtml(c[0])+'"><span>'+escapeHtml(c[1])+(assemblySort.key===c[0]?(assemblySort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join("")+"</tr>";bindSheetFilters(document.querySelector("#assemblyTable"),()=>assemblyRows,cols.map(c=>({key:c[0],label:c[1]})),assemblyColumnFilters,(k,dir)=>{assemblySort={key:k,dir};renderAssembly()},()=>renderAssembly())}els.assemblyBody.innerHTML=rows.length?rows.map(r=>"<tr>"+cols.map(c=>{let v=c[0]==="porc_vidrio"?pct(r[c[0]]):(c[0]==="semana_actual"?(r.semana_actual??r.semana_base):(r[c[0]]??"—"));if(c[0]==="ubicacion_vidrio"&&r.key_produccion&&v&&v!=="—")return '<td><button class="glass-location-link" data-glass-key="'+escapeHtml(r.key_produccion)+'" data-glass-id="'+escapeHtml(r.id||"")+'">'+escapeHtml(v)+"</button></td>";return "<td>"+escapeHtml(v)+"</td>"}).join("")+"</tr>").join(""):'<tr><td colspan="'+Math.max(cols.length,1)+'" class="empty">No hay órdenes con estos filtros.</td></tr>';els.assemblyBody.querySelectorAll("[data-glass-key]").forEach(b=>b.onclick=()=>openGlassDetail(b.dataset.glassKey,b.dataset.glassId));enableDraggableColumns(document.querySelector("#assemblyTable"))}
async function openGlassDetail(key,id){
 const token=sessionStorage.getItem(APP_SESSION_KEY);if(!token)return;
 els.glassDetailModal.hidden=false;els.glassDetailTitle.textContent="Orden "+id;els.glassDetailMeta.textContent="Consultando ubicación actual…";els.glassDetailSummary.innerHTML="";els.glassDetailBody.innerHTML="";
 try{const client=await getSupabaseClient();const {data,error}=await client.rpc("sgp_detalle_ubicacion_vidrio",{p_token:token,p_key_produccion:key});if(error)throw error;
  const pr=data.produccion||{};els.glassDetailTitle.innerHTML=`<span>Orden ${escapeHtml(id)}</span><span class="glass-production-title">${escapeHtml(pr.produccion||"—")}</span>`;els.glassDetailMeta.innerHTML=`<span><strong>Sistema:</strong> ${escapeHtml(pr.sistema||"—")}</span><span><strong>Cant. ventanas:</strong> ${pr.cantidad??"—"}</span><span><strong>Vidrios:</strong> ${data.unidades||0}</span><span><strong>Burros:</strong> ${data.burros||0}</span>`;
  els.glassDetailSummary.innerHTML=(data.resumen||[]).map(x=>`<span class="glass-summary ${String(x.categoria).toLowerCase()}"><strong>${x.unidades}</strong><small>${escapeHtml(x.categoria)} · ${x.burros} burros</small></span>`).join("");
  const groups=["PREPARADO","NOVEDAD","OTROS"];const icons={PREPARADO:"✓",NOVEDAD:"!",OTROS:"•"};
  els.glassDetailBody.innerHTML=groups.map(g=>{const rows=(data.detalle||[]).filter(x=>x.categoria===g);if(!rows.length)return"";return `<section class="glass-detail-group group-${g.toLowerCase()}"><h4><i>${icons[g]}</i> ${g}</h4>${rows.map(x=>`<div class="glass-detail-row"><div><strong>(${x.unidades}) ${escapeHtml(x.posicion||"Sin ubicación")}</strong><span>${escapeHtml(x.estado||g)}</span></div><p>${escapeHtml(x.composiciones||"—")}</p></div>`).join("")}</section>`}).join("");
 }catch(e){els.glassDetailMeta.textContent="No se pudo consultar: "+e.message}
}
async function loadLocationReport(){
 const token=sessionStorage.getItem(APP_SESSION_KEY);if(!token){els.locationReportStatus.textContent="Inicia sesión para consultar.";return}
 els.locationReportStatus.textContent="Actualizando reporte de ubicaciones…";
 try{const client=await getSupabaseClient();const {data,error}=await client.rpc("sgp_reporte_ubicaciones_vidrio",{p_token:token});if(error)throw error;const m=data.metricas||{};
  els.lrPrepared.textContent=m.preparadas??0;els.lrNovelty.textContent=m.novedad??0;els.lrTransfer.textContent=m.traslado??0;els.lrOther.textContent=m.otros??0;els.lrRacks.textContent=m.burros??0;els.lrMixed.textContent=data.burros_mixtos??0;
  els.locationByReservation.innerHTML=(data.por_reserva||[]).map(r=>`<tr><td>${escapeHtml(r.reserva)}</td><td class="num"><strong>${r.burros}</strong></td><td class="num">${r.unidades}</td></tr>`).join("")||'<tr><td colspan="3" class="empty">Sin ubicaciones</td></tr>';
  const {data:racks,error:rackError}=await client.rpc("sgp_reporte_burros_estado",{p_token:token});if(rackError)throw rackError; els.locationMixedRacks.innerHTML=(racks||[]).map(r=>`<tr><td><strong>${escapeHtml(r.posicion)}</strong></td><td><span class="rack-status rack-${r.orden_estado}">${escapeHtml(r.estado)}</span></td><td>${escapeHtml(r.reservas)}</td><td class="num">${r.cantidad_reservas}</td><td class="num"><strong>${r.unidades}</strong></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Sin burros activos</td></tr>';
  els.locationReportStatus.textContent="Reporte actualizado ✓ datos de ubicación activos.";
 }catch(e){els.locationReportStatus.textContent="Consulta rechazada ✕ "+e.message}
}
function openAssemblyTab(tab){
 const report=tab==="report";els.assemblySheetPanel.hidden=report;els.assemblyLocationReportPanel.hidden=!report;els.assemblySheetTab.classList.toggle("active",!report);els.assemblyLocationReportTab.classList.toggle("active",report);if(report)loadLocationReport();
}

async function loadAssembly(){
 const token=sessionStorage.getItem(APP_SESSION_KEY);if(!token){els.assemblyStatus.textContent="Inicia sesión para consultar.";return}
 els.loadAssembly.disabled=true;els.assemblyStatus.textContent="Consultando estado actual…";
 try{const client=await getSupabaseClient();const week=els.assemblyWeek.value?Number(els.assemblyWeek.value):null;const {data,error}=await client.rpc("sgp_consultar_ensamble",{p_token:token,p_semana:week,p_linea:els.assemblyLine.value});if(error)throw error;assemblyRows=data.filas||[];renderAssembly();els.assemblyStatus.textContent=`Actualizado ✓ ${assemblyRows.length} órdenes · datos actuales de SGP.`;}
 catch(e){els.assemblyStatus.textContent="Consulta rechazada ✕ "+e.message}finally{els.loadAssembly.disabled=false}
}

function resetDailyExport(){
  dailyExportPreview=null;dailyExportRows=[];
  if(els.applyDailyExport)els.applyDailyExport.disabled=true;
  if(els.dailyExportMetrics)els.dailyExportMetrics.innerHTML='<span class="daily-metric-card metric-received"><i class="metric-icon icon-file"></i><span><small>Registros recibidos</small><strong>—</strong></span></span><span class="daily-metric-card metric-match"><i class="metric-icon icon-check">✓</i><span><small>Coinciden con SGP</small><strong>—</strong></span></span><span class="daily-metric-card metric-out"><i class="metric-icon icon-warning">!</i><span><small>Fuera de base</small><strong>—</strong></span></span><span class="daily-metric-card metric-absent"><i class="metric-icon icon-minus">−</i><span><small>Ausentes (sem. incluidas)</small><strong>—</strong></span></span>'; if(els.dailyExportWeeks)els.dailyExportWeeks.innerHTML='';
}
function renderDailyExportMetrics(p){
  const weeks=p.semanas||[]; const absent=weeks.reduce((n,w)=>n+(w.ausentes||0),0);
  els.dailyExportMetrics.innerHTML=`<span class="daily-metric-card metric-received"><i class="metric-icon icon-file"></i><span><small>Registros recibidos</small><strong>${p.recibidos}</strong></span></span><span class="daily-metric-card metric-match"><i class="metric-icon icon-check">✓</i><span><small>Coinciden con SGP</small><strong>${p.coinciden}</strong></span></span><span class="daily-metric-card metric-out"><i class="metric-icon icon-warning">!</i><span><small>Fuera de base</small><strong>${p.nuevos}</strong></span></span><span class="daily-metric-card metric-absent"><i class="metric-icon icon-minus">−</i><span><small>Ausentes (sem. incluidas)</small><strong>${absent}</strong></span></span>`;
  if(els.dailyExportWeeks)els.dailyExportWeeks.innerHTML='<table><thead><tr><th>Semana</th><th>Export<br><small>(Registros)</small></th><th>Base SGP<br><small>(Registros)</small></th><th>Coinciden</th><th>Fuera de base</th><th>Ausentes</th><th>Acción / estado</th></tr></thead><tbody>'+weeks.map(w=>{const cls=w.accion==='FUERA_BASE'?'week-out':w.accion==='NO_INCLUIDA_NO_TOCAR'?'week-safe':'week-update';const label=w.accion==='NO_INCLUIDA_NO_TOCAR'?'No incluida · no tocar':w.accion==='FUERA_BASE'?'Fuera de base':'Se actualizará';return `<tr class="${cls}"><td><strong>${w.semana}</strong></td><td class="cell-export">${w.registros_export}</td><td class="cell-base">${w.registros_base}</td><td class="cell-match">${w.coinciden}</td><td class="cell-out">${w.fuera_base}</td><td class="cell-absent">${w.ausentes}</td><td><span class="week-status">${label}</span></td></tr>`}).join('')+'</tbody></table>';
}
async function previewDailyExport(){
  const token=sessionStorage.getItem(APP_SESSION_KEY),file=els.dailyExportFile?.files?.[0],line=els.dailyExportLine?.value;
  resetDailyExport();
  if(!token){els.dailyExportStatus.textContent='Inicia sesión para validar el Export.';return}
  if(!file){els.dailyExportStatus.textContent='Selecciona el archivo Export XLSX.';return}
  els.previewDailyExport.disabled=true;els.dailyExportStatus.textContent='Leyendo y comparando Export…';
  try{
    const parsed=await readProgrammingWorkbook(file);
    if(parsed.errors.length)throw new Error(`El archivo tiene ${parsed.errors.length} registro(s) inválido(s).`);
    const other=parsed.rows.filter(r=>r.id_linea!==line);
    if(other.length)throw new Error(`Este archivo contiene ${other.length} registro(s) que no pertenecen a ${line}. Usa un Export exclusivo de la línea.`);
    dailyExportRows=parsed.rows;
    const client=await getSupabaseClient();
    const {data,error}=await client.rpc('sgp_previsualizar_export_diario',{p_token:token,p_linea:line,p_datos:dailyExportRows});
    if(error)throw error;
    dailyExportPreview={...data,fileName:file.name,line};
    renderDailyExportMetrics(data);
    els.dailyExportStatus.textContent=`Comparación lista ✓ ${data.recibidos} registros. Revisa los cambios antes de aplicar.`;
    els.applyDailyExport.disabled=false;
  }catch(e){els.dailyExportStatus.textContent='Validación rechazada ✕ '+e.message}
  finally{els.previewDailyExport.disabled=false}
}
async function applyDailyExport(){
  if(!dailyExportPreview||!dailyExportRows.length)return;
  const token=sessionStorage.getItem(APP_SESSION_KEY),p=dailyExportPreview;
  const msg=`APLICAR EXPORT DIARIO\n\nLínea: ${p.line}\nArchivo: ${p.fileName}\nRecibidos: ${p.recibidos}\nCoinciden: ${p.coinciden}\nFuera de base: ${p.nuevos}\nLa ausencia se aplica únicamente a semanas incluidas en el Export.\n\nLa programación base semanal no se elimina. ¿Aplicar actualización?`;
  if(!window.confirm(msg))return;
  els.applyDailyExport.disabled=true;els.dailyExportStatus.textContent='Aplicando actualización diaria…';
  try{
    const client=await getSupabaseClient();
    const {data,error}=await client.rpc('sgp_aplicar_export_diario',{p_token:token,p_linea:p.line,p_nombre_archivo:p.fileName,p_datos:dailyExportRows});
    if(error)throw error;
    els.dailyExportStatus.textContent=`Actualización aplicada ✓ ${data.actualizados} actualizados · ${data.nuevos} nuevos · ${data.ausentes} ya no aparecen.`;
    window.alert(`EXPORT ACTUALIZADO ✓\n\nLínea: ${p.line}\nActualizados: ${data.actualizados}\nFuera de base: ${data.fuera_base}\nAusentes en semanas incluidas: ${data.ausentes}`);
    const {data:chg,error:chgErr}=await client.rpc('sgp_resumen_eventos_actualizacion',{p_token:token,p_id_lote:data.id_carga_diaria,p_fuente:'EXPORT'});if(chgErr)throw chgErr;window.exportChangeData=chg||{};const cs=document.querySelector('#dailyExportChangeSummary');if(cs)cs.hidden=false;const eo=document.querySelector('#expOpenAssembly'),ea=document.querySelector('#expAssemblyDone'),ep=document.querySelector('#expPackingDone');if(eo)eo.textContent=(chg.ABIERTA_ENSAMBLE||[]).length;if(ea)ea.textContent=(chg.ENSAMBLADA_COMPLETA||[]).length;if(ep)ep.textContent=(chg.ORDEN_COMPLETADA||[]).length;
    dailyExportPreview=null;dailyExportRows=[];
  }catch(e){els.dailyExportStatus.textContent='Actualización rechazada ✕ '+e.message;els.applyDailyExport.disabled=false}
}


function resetGlassLocation(){
  glassLocationPreview=null; glassLocationRows=[];
  if(els.applyGlassLocation)els.applyGlassLocation.disabled=true;
  if(els.glassLocationMetrics)els.glassLocationMetrics.innerHTML='<span class="daily-metric-card metric-received"><i class="metric-icon icon-file"></i><span><small>Registros recibidos</small><strong>—</strong></span></span><span class="daily-metric-card metric-match"><i class="metric-icon icon-check">✓</i><span><small>Registros relacionados</small><strong>—</strong></span></span><span class="daily-metric-card metric-out"><i class="metric-icon icon-warning">!</i><span><small>Fuera de SGP</small><strong>—</strong></span></span><span class="daily-metric-card metric-absent"><i class="metric-icon icon-minus">−</i><span><small>OVES sin ubicación</small><strong>—</strong></span></span>';
  if(els.glassLocationSummary)els.glassLocationSummary.innerHTML='';
}
function renderGlassLocationPreview(parsed,filtered,server){
  const related=filtered.matched.length;
  els.glassLocationMetrics.innerHTML=`<span class="daily-metric-card metric-received"><i class="metric-icon icon-file"></i><span><small>Registros recibidos</small><strong>${parsed.received}</strong></span></span><span class="daily-metric-card metric-match"><i class="metric-icon icon-check">✓</i><span><small>Registros relacionados</small><strong>${related}</strong></span></span><span class="daily-metric-card metric-out"><i class="metric-icon icon-warning">!</i><span><small>Fuera de SGP</small><strong>${filtered.outside}</strong></span></span><span class="daily-metric-card metric-absent"><i class="metric-icon icon-minus">−</i><span><small>OVES sin ubicación</small><strong>${filtered.missingOves.length}</strong></span></span>`;
  const sample=filtered.missingOves.slice(0,12);
  els.glassLocationSummary.innerHTML=`<div class="glass-location-facts"><span><strong>${server.producciones_activas}</strong><small>Producciones consideradas</small></span><span><strong>${filtered.activeOves}</strong><small>OVES activas</small></span><span><strong>${filtered.foundOves}</strong><small>OVES encontradas</small></span><span><strong>${filtered.matchedProductions}</strong><small>Producciones con ubicación</small></span></div>${sample.length?`<div class="glass-location-missing"><strong>OVES activas sin registro en el reporte</strong><span>${sample.map(escapeHtml).join(" · ")}${filtered.missingOves.length>sample.length?" · …":""}</span></div>`:'<div class="glass-location-ok">Todas las OVES activas fueron encontradas en el reporte.</div>'}`;
}
async function previewGlassLocation(){
  const token=sessionStorage.getItem(APP_SESSION_KEY),file=els.glassLocationFile?.files?.[0];
  resetGlassLocation();
  if(!token){els.glassLocationStatus.textContent='Inicia sesión para validar el reporte.';return}
  if(!file){els.glassLocationStatus.textContent='Selecciona el Reporte Disponible XLSX.';return}
  els.previewGlassLocation.disabled=true; els.glassLocationStatus.textContent='Leyendo reporte y construyendo índice de OVES…';
  try{
    const [parsed,client]=await Promise.all([readGlassLocationWorkbook(file),getSupabaseClient()]);
    els.glassLocationStatus.textContent=`Reporte leído: ${parsed.received} filas. Consultando OVES activas…`;
    const {data:server,error}=await client.rpc('sgp_preparar_ubicacion_vidrio',{p_token:token});
    if(error)throw error;
    const filtered=filterGlassLocationRows(parsed.rows,server.relaciones||[]);
    glassLocationRows=filtered.matched;
    glassLocationPreview={fileName:file.name,received:parsed.received,validRows:parsed.validRows,invalid:parsed.invalid||0,filtered,server};
    renderGlassLocationPreview(parsed,filtered,server);
    els.glassLocationStatus.textContent=`Validación lista ✓ ${parsed.received} filas leídas · ${parsed.invalid||0} sin Orden · ${filtered.matched.length} relacionadas · solo esas filas se enviarán al servidor.`;
    els.applyGlassLocation.disabled=false;
  }catch(e){els.glassLocationStatus.textContent='Validación rechazada ✕ '+e.message}
  finally{els.previewGlassLocation.disabled=false}
}
async function applyGlassLocation(){
  const p=glassLocationPreview,token=sessionStorage.getItem(APP_SESSION_KEY);
  if(!p||!token)return;
  const msg=`APLICAR UBICACIÓN DE VIDRIO\n\nArchivo: ${p.fileName}\nRecibidos: ${p.received}\nSin Orden / inválidos: ${p.invalid||0}\nRegistros relacionados: ${p.filtered.matched.length}\nOVES activas: ${p.filtered.activeOves}\nOVES encontradas: ${p.filtered.foundOves}\nOVES sin ubicación: ${p.filtered.missingOves.length}\n\nEn esta etapa, hasta inicializar los saldos diarios, se consideran las OVES conocidas de PANELES_2. El criterio definitivo será Saldo Ensamble > 0. ¿Aplicar actualización?`;
  if(!window.confirm(msg))return;
  els.applyGlassLocation.disabled=true; els.glassLocationStatus.textContent=`Aplicando ${glassLocationRows.length} registros depurados…`;
  try{
    const client=await getSupabaseClient();
    const {data,error}=await client.rpc('sgp_aplicar_ubicacion_vidrio',{p_token:token,p_nombre_archivo:p.fileName,p_registros_recibidos:p.received,p_datos:glassLocationRows});
    if(error)throw error;
    els.glassLocationStatus.textContent=`Ubicación aplicada ✓ ${data.relacionados} relaciones · ${data.oves_encontradas}/${data.oves_activas} OVES encontradas · ${data.cambios} cambios registrados.`;
    window.alert(`UBICACIÓN DE VIDRIO ACTUALIZADA ✓\n\nOVES activas: ${data.oves_activas}\nOVES encontradas: ${data.oves_encontradas}\nOVES sin ubicación: ${data.oves_sin_ubicacion}\nCambios: ${data.cambios}`);
    glassLocationPreview=null; glassLocationRows=[];
  }catch(e){els.glassLocationStatus.textContent='Actualización rechazada ✕ '+e.message;els.applyGlassLocation.disabled=false}
}

async function commitProgramming() {
  const status = weeklyPackageStatus();
  if (!status.ready) { refreshWeeklyPackageGate(); return; }
  const user = await refreshAuthStatus();
  if (!user || !["ADMINISTRADOR","COORDINADOR"].includes(user.rol)) {
    els.importStatus.textContent = "CARGA RECHAZADA ✕ Se requiere rol ADMINISTRADOR o COORDINADOR."; refreshWeeklyPackageGate(); return;
  }
  const token = sessionStorage.getItem(APP_SESSION_KEY);
  const year = Number(validatedProductions[0]?.anio);
  const week = Number(targetWeek);
  const piecesPayload = prepareAluminumPiecePayload(validatedPieces.rows, validatedProductions);
  const accessoriesPayload = prepareAccessoryPayload(validatedAccessories.rows, validatedProductions);
  const glassPayload = prepareGlassPayload(validatedGlass.rows, validatedProductions);
  const total = validatedProductions.length + piecesPayload.length + accessoriesPayload.length + glassPayload.length;
  const client = await getSupabaseClient();

  els.importStatus.textContent = "Preflight: comprobando sesión, rol y estado de la semana…";
  const { data: preflight, error: preflightError } = await client.rpc("sgp_preflight_carga_semanal", { p_token: token, p_anio: year, p_semana: week });
  if (preflightError || !preflight?.ok) {
    const msg = preflightError?.message || "Preflight no válido";
    els.importStatus.textContent = "CARGA RECHAZADA ✕ " + msg; window.alert("CARGA RECHAZADA ✕\n\n" + msg); refreshWeeklyPackageGate(); return;
  }
  if (preflight.semana_ya_cargada) {
    const msg = `La semana ${week} / ${year} ya figura cargada en el servidor.`;
    els.importStatus.textContent = "CARGA RECHAZADA ✕ " + msg; window.alert(msg); return;
  }

  const summary = `CONFIRMAR CARGA REAL\n\nSemana: ${week} / ${year}\nUsuario: ${user.nombre} (${user.rol})\nProgramación: ${validatedProductions.length}\nPiezas: ${piecesPayload.length}\nAccesorios: ${accessoriesPayload.length}\nVidrio: ${glassPayload.length}\nTOTAL: ${total} registros\n\n¿CONFIRMAR LA CARGA DE LA SEMANA ${week}?\n\nAceptar = SÍ   ·   Cancelar = NO`;
  if (!window.confirm(summary)) {
    els.importStatus.textContent = `Carga de semana ${week} cancelada. No se realizó ninguna escritura.`;
    if (els.previewStatus) els.previewStatus.textContent = "Escritura realizada: NO · Usuario seleccionó NO.";
    return;
  }

  els.commit.disabled = true; els.commit.textContent = `Enviando ${total.toLocaleString("es-CO")} registros…`;
  els.importStatus.textContent = "SOLICITUD ENVIADA… No cierres esta pestaña. Esperando confirmación del servidor.";
  if (els.previewStatus) els.previewStatus.textContent = "Estado: solicitud de carga enviada; esperando respuesta transaccional.";
  await new Promise(resolve => setTimeout(resolve, 50));
  try {
    const { data, error } = await client.rpc("sgp_cargar_paquete_semanal", {
      p_token: token, p_anio: year, p_semana: week, p_programacion: validatedProductions,
      p_piezas: piecesPayload, p_accesorios: accessoriesPayload, p_vidrio: glassPayload
    });
    if (error) throw error;
    const inserted = data?.insertados?.total ?? total;
    els.importStatus.textContent = `CARGA COMPLETADA ✓ Semana ${week} · Lote ${data.id_lote_carga} · ${inserted} registros.`;
    els.commit.textContent = "Semana cargada ✓"; els.commit.disabled = true;
    if (els.previewStatus) els.previewStatus.textContent = `Escritura realizada: SÍ ✓ · Lote ${data.id_lote_carga} · Usuario ${data.usuario} · Total ${inserted}.`;
    window.alert(`CARGA COMPLETADA ✓\n\nSemana ${week} / ${year}\nLote: ${data.id_lote_carga}\nRegistros insertados: ${inserted}`);
  } catch (error) {
    const msg = [error?.message,error?.details,error?.hint].filter(Boolean).join(" · ") || String(error);
    els.importStatus.textContent = "CARGA RECHAZADA ✕ " + msg;
    if (els.previewStatus) els.previewStatus.textContent = "Escritura realizada: NO. Error: " + msg;
    window.alert("CARGA RECHAZADA ✕\n\nNo se confirmó ninguna escritura.\n\n" + msg);
    refreshWeeklyPackageGate();
  }
}
els.nav.forEach(button => button.addEventListener("click", () => {openView(button.dataset.view);if(button.dataset.view==='configuracion')loadUserAdmin()}));
window.addEventListener("error", event => {
  console.error("SGP ONE:", event.error || event.message);
});
window.addEventListener("unhandledrejection", event => {
  console.error("SGP ONE:", event.reason);
});
[els.search, els.state, els.line].filter(Boolean).forEach(el => el.addEventListener("input", renderMecanizado));
els.simulate?.addEventListener("click", () => { if(els.demoMessage) els.demoMessage.textContent = mecanizado.advanceDemoState(); renderMecanizado(); });
els.targetWeek.addEventListener("input", () => { invalidateWeeklySource("programming"); els.commit.textContent="Carga final bloqueada"; els.commit.disabled=true; els.importStatus.textContent="Semana modificada. Vuelve a validar Programación y las fuentes relacionadas."; });
els.files.addEventListener("change", () => { invalidateWeeklySource("programming"); els.importStatus.textContent="Archivos de Programación modificados. Vuelve a validar el paquete."; });
els.piecesFile.addEventListener("change", () => { invalidateWeeklySource("pieces"); els.piecesStatus.textContent="Archivo modificado. Vuelve a validar el listado de piezas."; });
els.accessoriesFile.addEventListener("change", () => { invalidateWeeklySource("accessories"); els.accessoriesStatus.textContent="Archivo modificado. Vuelve a validar Accesorios."; });
els.glassFile.addEventListener("change", () => { invalidateWeeklySource("glass"); els.glassStatus.textContent="Archivo modificado. Vuelve a validar Vidrio."; });
document.querySelectorAll("[data-daily-tab]").forEach(b=>b.addEventListener("click",()=>openDailyTab(b.dataset.dailyTab)));
els.dailyExportFile?.addEventListener("change",()=>{resetDailyExport();els.dailyExportStatus.textContent="Archivo modificado. Vuelve a validar y comparar.";});
els.dailyExportLine?.addEventListener("change",()=>{resetDailyExport();els.dailyExportStatus.textContent="Línea modificada. Selecciona y valida el Export correspondiente.";});
els.glassLocationFile?.addEventListener("change",()=>{resetGlassLocation();els.glassLocationStatus.textContent="Archivo modificado. Vuelve a validar y depurar.";});
els.previewGlassLocation?.addEventListener("click",previewGlassLocation);
els.applyGlassLocation?.addEventListener("click",applyGlassLocation);
els.loadAssembly?.addEventListener("click",loadAssembly);
els.assemblyBody?.addEventListener("click",e=>{const b=e.target.closest("[data-glass-key]");if(b)openGlassDetail(b.dataset.glassKey,b.dataset.glassId)});
els.closeGlassDetail?.addEventListener("click",()=>els.glassDetailModal.hidden=true);
els.glassDetailModal?.addEventListener("click",e=>{if(e.target===els.glassDetailModal)els.glassDetailModal.hidden=true});
els.assemblySheetTab?.addEventListener("click",()=>openAssemblyTab("sheet"));
els.assemblyLocationReportTab?.addEventListener("click",()=>openAssemblyTab("report"));
els.assemblyState?.addEventListener("change",renderAssembly);els.assemblySearch?.addEventListener("input",renderAssembly);
els.assemblyWeek?.addEventListener("change",loadAssembly);els.assemblyLine?.addEventListener("change",loadAssembly);
els.previewDailyExport?.addEventListener("click",previewDailyExport);
els.applyDailyExport?.addEventListener("click",applyDailyExport);
els.validate.addEventListener("click", validateProgrammingFiles);
els.validateAluminum.addEventListener("click", validateAluminumFile);
els.applyAluminumTracking?.addEventListener("click",applyAluminumTracking);
els.validatePieces.addEventListener("click", validatePiecesFile);
els.validateAccessories.addEventListener("click", validateAccessoriesFile);
els.validateGlass.addEventListener("click", validateGlassFile);
els.previewLoad.addEventListener("click", previewWeeklyLoad);
els.queryProgramming?.addEventListener("click", queryWeeklyProgramming);
els.queryLine?.addEventListener("change", renderQueriedProgramming);
els.querySearch?.addEventListener("input", renderQueriedProgramming);
els.queryBody?.addEventListener("click",e=>{const b=e.target.closest("[data-piece-mode]");if(b)openPieceModal(b.dataset.pieceMode,b.dataset.pieceValue)});
els.closePieceModal?.addEventListener("click",()=>els.pieceModal.hidden=true);
document.querySelectorAll('[data-piece-view]').forEach(b=>b.addEventListener('click',()=>{currentPieceView=b.dataset.pieceView;renderPieceModal()}));
els.pieceDetailedOptions?.addEventListener('change',renderPieceModal);
els.pieceProfileHead?.addEventListener('click',e=>{const b=e.target.closest('[data-piece-move]');if(!b)return;const [key,d]=b.dataset.pieceMove.split(':'),i=pieceDetailColumns.indexOf(key),j=i+Number(d);if(i>=0&&j>=0&&j<pieceDetailColumns.length){[pieceDetailColumns[i],pieceDetailColumns[j]]=[pieceDetailColumns[j],pieceDetailColumns[i]];renderPieceModal()}});

els.pieceModal?.addEventListener("click",e=>{if(e.target===els.pieceModal)els.pieceModal.hidden=true;const b=e.target.closest("[data-expand-profile]");if(b){const row=els.pieceProfileBody.querySelector(`[data-profile-marks="${b.dataset.expandProfile}"]`);if(row){row.hidden=!row.hidden;b.textContent=row.hidden?"Ampliar":"Ocultar"}}});
els.queryHead?.addEventListener("click",e=>{const sort=e.target.closest("[data-sort]"),move=e.target.closest("[data-move]");if(sort){const key=sort.dataset.sort;if(detailSort.key===key)detailSort.dir*=-1;else detailSort={key,dir:1};renderQueriedProgramming()}if(move){const [i,d]=move.dataset.move.split(":").map(Number),j=i+d;if(j>=0&&j<detailColumns.length){[detailColumns[i],detailColumns[j]]=[detailColumns[j],detailColumns[i]];renderQueriedProgramming()}}});
els.queryHead?.addEventListener("change",e=>{if(e.target.matches("[data-filter]")){detailColumnFilters[e.target.dataset.filter]=e.target.value;renderQueriedProgramming()}});

els.commit.addEventListener("click", commitProgramming);

els.authLogin.addEventListener("click", requestCredentialAccess);
els.authPassword?.addEventListener("keydown",e=>{if(e.key==="Enter")requestCredentialAccess()});
els.authLogout.addEventListener("click", logout);
refreshAuthStatus();

refreshWeeklyTabs();
try { openView("mecanizado"); renderMecanizado(); }
catch (error) { console.error("Error al iniciar Módulo de Mecanizado:", error); }



async function previewNcAluminum(){
 const file=document.querySelector("#ncAlFile")?.files?.[0], status=document.querySelector("#ncAlStatus"), btn=document.querySelector("#applyNcAl");
 if(!file){status.textContent="Selecciona el Export NC Aluminio.";return}
 try{
  status.textContent="Leyendo y cruzando reservas con Programación…"; btn.disabled=true;
  ncAlRows=await readNcAluminumWorkbook(file);
  const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");
  const {data,error}=await client.rpc("sgp_previsualizar_nc_aluminio",{p_token:token,p_datos:ncAlRows}); if(error)throw error;
  const {data:newRows,error:newErr}=await client.rpc("sgp_previsualizar_nuevas_nc_aluminio",{p_token:token,p_datos:ncAlRows});if(newErr)throw newErr;ncAlNewRows=newRows||[];ncAlPreview={...data,file:file.name};
  document.querySelector("#ncAlReceived").textContent=data.recibidos||0;document.querySelector("#ncAlMatched").textContent=data.relacionados||0;
  document.querySelector("#ncAlMissing").textContent=data.sin_programacion||0;document.querySelector("#ncAlAmbiguous").textContent=data.ambiguos||0;
  const weeks=(data.por_semana||[]).map(x=>`Semana Maestro ${x.semana}: ${x.cantidad} NC`).join(" · "); document.querySelector("#ncAlWeekSummary").textContent=(weeks?weeks+" · ":"")+"Fuera de programación actual: "+(data.fuera_programacion??data.sin_programacion??0)+". Semana NC se conserva como fecha de creación.";
  status.textContent="Validación completada. No se ha escrito información.";btn.disabled=false;
 }catch(e){status.textContent="Validación rechazada ✕ "+e.message;btn.disabled=true}
}
async function applyNcAluminum(){
 if(!ncAlPreview||!ncAlRows.length)return; const btn=document.querySelector("#applyNcAl"),status=document.querySelector("#ncAlStatus");
 try{btn.disabled=true;status.textContent="Aplicando NC Aluminio…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");
 const {data,error}=await client.rpc("sgp_aplicar_nc_aluminio",{p_token:token,p_nombre_archivo:ncAlPreview.file,p_datos:ncAlRows});if(error)throw error;
 status.textContent=`NC Aluminio actualizado ✓ · ${data.nuevos} nuevas · ${data.actualizados} actualizadas · ${data.relacionados} con Semana Maestro`;
 const {data:chg,error:chgErr}=await client.rpc("sgp_resumen_carga_nc_aluminio",{p_token:token,p_id_lote:data.id_lote});if(chgErr)throw chgErr;window.ncLoadChangeData=chg;const sum=document.querySelector("#ncAlChangeSummary");sum.hidden=false;document.querySelector("#ncLoadNew").textContent=(chg.nuevas||[]).length;document.querySelector("#ncLoadClosed").textContent=(chg.finalizadas||[]).length;document.querySelector("#ncLoadAudit").textContent=(chg.sin_auditar||[]).length;
 if(ncAlNewRows.length){const modal=document.querySelector("#ncNewModal"),table=modal.querySelector("table");document.querySelector("#ncNewTitle").textContent=`NC agregadas en esta carga · ${ncAlNewRows.length}`;document.querySelector("#ncNewBody").innerHTML=ncAlNewRows.map(r=>`<tr><td>${escapeHtml(r.consecutivo)}</td><td>${escapeHtml(r.linea||'')}</td><td>${escapeHtml(r.semana_nc||'')}</td><td>${escapeHtml(r.referencia||'')}</td><td>${escapeHtml(r.acabado||'')}</td><td><span class="nc-state-pill">${escapeHtml(r.estado||'')}</span></td><td>${escapeHtml(String(r.creacion||'').slice(0,10))}</td><td>${escapeHtml(r.reserva_solucion||'')}</td><td>${escapeHtml(ncInches(r.perfil_mm))}</td><td>${escapeHtml(r.no_cortes||'')}</td></tr>`).join('');modal.hidden=false;delete table.dataset.dragReady;enableDraggableColumns(modal)}
 }catch(e){status.textContent="Aplicación rechazada ✕ "+e.message;btn.disabled=false}
}
document.querySelector("#previewNcAl")?.addEventListener("click",previewNcAluminum);
document.querySelector("#applyNcAl")?.addEventListener("click",applyNcAluminum);


let ncViewRows=[],ncViewFilters={},ncViewSort={key:null,dir:1};
let ncHiddenCols=new Set(JSON.parse(localStorage.getItem("sgp_nc_hidden_cols")||"[]"));
let ncCols=[['consecutivo','Consecutivo'],['semana_nc','Sem. NC'],['linea','Línea'],['creacion','Creación'],['dias_abierta','Días'],['semaforo',''],['estado','Estado'],['reserva','Reserva'],['reserva_solucion','Reserva solución'],['produccion','Producción'],['sistema','Sistema'],['referencia','Referencia'],['perfil_mm','Perfil mm'],['perfil_in','Perfil pulg.'],['no_cortes','# Cortes'],['acabado','Acabado'],['concepto','Concepto'],['causa','Causa'],['responsable','Responsable']];
function ncInches(v){let n=Number(String(v??'').replace(',','.'));if(!Number.isFinite(n))return '';let x=n/25.4,w=Math.floor(x),q=Math.round((x-w)*16);if(q===16){w++;q=0}if(!q)return w+'″';const g=(a,b)=>b?g(b,a%b):a,d=g(q,16);return w+' '+(q/d)+'/'+(16/d)+'″'}
function ncFmt(r,k){let v=k==='perfil_in'?ncInches(r.perfil_mm):r[k];if(v==null)return "";if(k==='creacion')return String(v).slice(0,10);return String(v)}
function renderNcView(){const head=document.querySelector("#ncViewHead"),body=document.querySelector("#ncViewBody");if(!head||!body)return;const visibleCols=ncCols.filter(([k])=>!ncHiddenCols.has(k));head.innerHTML='<tr>'+visibleCols.map(([k,l])=>'<th data-col-key="'+escapeHtml(k)+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+escapeHtml(k)+'"><span>'+escapeHtml(l)+(ncViewSort.key===k?(ncViewSort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join('')+'</tr>';let rows=ncViewRows.filter(r=>Object.entries(ncViewFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(ncFmt(r,k))));if(ncViewSort.key)rows=[...rows].sort((x,y)=>ncFmt(x,ncViewSort.key).localeCompare(ncFmt(y,ncViewSort.key),undefined,{numeric:true})*ncViewSort.dir);body.innerHTML=rows.map(r=>'<tr class="'+(String(r.estado).toLowerCase()==='finalizada'?'nc-finalized':'')+'">'+visibleCols.map(([k])=>k==='semaforo'?'<td><span class="nc-light '+String(r.semaforo).toLowerCase()+'" title="'+r.dias_abierta+' días"></span></td>':'<td>'+escapeHtml(ncFmt(r,k))+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+visibleCols.length+'" class="empty">Sin NC para los filtros seleccionados</td></tr>';bindSheetFilters(document.querySelector("#ncViewTable")||head.closest("table"),()=>ncViewRows,visibleCols.map(c=>({key:c[0],label:c[1]})),ncViewFilters,(k,d)=>{ncViewSort={key:k,dir:d};renderNcView()},()=>renderNcView());enableDraggableColumns(head.closest("table"))}
function openNcMetric(kind){
 const tests={consult:r=>String(r.estado).toLowerCase()==='consultada',audit:r=>String(r.estado).toLowerCase()==='sin auditar',overdue:r=>String(r.estado).toLowerCase()!=='finalizada'&&Number(r.dias_abierta)>2,nosolution:r=>r.sin_solucion};
 const titles={consult:'NC en consulta',audit:'NC sin auditar',overdue:'NC con más de 2 días sin finalizar',nosolution:'NC sin solución'},rows=ncViewRows.filter(tests[kind]);
 document.querySelector("#ncMetricTitle").textContent=titles[kind]+' · '+rows.length;
 const modalTable=document.querySelector("#ncMetricModal table");modalTable.tHead.innerHTML='<tr>'+[['consecutivo','NC'],['referencia','Referencia'],['acabado','Acabado'],['estado','Estado'],['creacion','Creación'],['dias_abierta','Días'],['reserva_solucion','Reserva solución'],['perfil_in','Perfil'],['no_cortes','Cortes']].map(([k,l])=>`<th data-key="${k}">${l}</th>`).join('')+'</tr>';
 document.querySelector("#ncMetricBody").innerHTML=rows.map(r=>`<tr><td>${escapeHtml(r.consecutivo)}</td><td>${escapeHtml(r.referencia||'')}</td><td>${escapeHtml(r.acabado||'')}</td><td><span class="nc-state-pill">${escapeHtml(r.estado)}</span></td><td>${escapeHtml(ncFmt(r,'creacion'))}</td><td class="nc-days-cell">${r.dias_abierta}</td><td>${escapeHtml(r.reserva_solucion||'')}</td><td>${escapeHtml(ncInches(r.perfil_mm))}</td><td>${escapeHtml(r.no_cortes??'')}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">Sin registros</td></tr>';document.querySelector("#ncMetricModal").hidden=false;delete modalTable.dataset.dragReady;enableDraggableColumns(document.querySelector("#ncMetricModal"));
}
async function loadNcOperational(){
 const status=document.querySelector("#ncViewStatus");try{status.textContent="Consultando NC…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),week=Number(document.querySelector("#ncViewWeek").value)||null;
 const {data,error}=await client.rpc("sgp_consultar_nc_aluminio",{p_token:token,p_semana:week});if(error)throw error;ncViewRows=data.filas||[];ncViewFilters={};const ws=document.querySelector("#ncViewWeek");if(ws&&data.semanas_abiertas){const cur=ws.value;ws.innerHTML=`<option value="">Todas las semanas abiertas</option>`+data.semanas_abiertas.map(w=>`<option value="${w}">Semana ${w}</option>`).join("");if(cur&&data.semanas_abiertas.map(String).includes(cur))ws.value=cur;}
 const [{data:lineSummary,error:lineErr},{data:originMetrics,error:originErr}]=await Promise.all([client.rpc("sgp_resumen_nc_aluminio_linea",{p_token:token,p_semana:week}),client.rpc("sgp_metricas_origen_nc_aluminio",{p_token:token,p_semana:week})]);if(lineErr)throw lineErr;if(originErr)throw originErr;
 document.querySelector("#ncMPlant").textContent=originMetrics.planta;document.querySelector("#ncMSupplier").textContent=originMetrics.proveedor;
 document.querySelector("#ncLineSummary").innerHTML=(lineSummary||[]).map(x=>`<div class="nc-line-card"><strong>${escapeHtml(x.linea)}</strong><span>Total NC <b>${x.total}</b></span><span>Planta <b>${x.planta}</b></span><span>Proveedor <b>${x.proveedor}</b></span></div>`).join('');
 document.querySelector("#ncMConsult").textContent=data.metricas.en_consulta;document.querySelector("#ncMAudit").textContent=data.metricas.sin_auditar;document.querySelector("#ncMOverdue").textContent=data.metricas.mas_2_dias;document.querySelector("#ncMNoSolution").textContent=data.metricas.sin_solucion;renderNcView();status.textContent=data.semana?`Semana Maestro ${data.semana} · ${ncViewRows.length} NC`:`Todas las semanas abiertas · ${(data.semanas_abiertas||[]).length} semana(s) · ${ncViewRows.length} NC`;
 }catch(e){status.textContent="Consulta rechazada ✕ "+e.message}}
document.querySelector("#loadNcView")?.addEventListener("click",loadNcOperational);
document.querySelectorAll(".nc-metric-btn").forEach(b=>b.addEventListener("click",()=>openNcMetric(b.dataset.ncmetric)));
document.querySelector("#closeNcMetric")?.addEventListener("click",()=>document.querySelector("#ncMetricModal").hidden=true);

let activeSheetFilter=null;function filterSelected(v){return Array.isArray(v)?v:[]}
function closeSheetFilter(){document.querySelector(".sheet-filter-menu")?.remove();activeSheetFilter=null}
function bindSheetFilters(table,getRows,cols,filters,onSort,onFilter){if(!table)return;table.querySelectorAll("[data-sheet-filter]").forEach(btn=>{const key=btn.dataset.sheetFilter,sel=filterSelected(filters[key]);btn.closest("th")?.classList.toggle("filter-active",sel.length>0);btn.onclick=e=>{e.stopPropagation();if(activeSheetFilter===key){closeSheetFilter();return}closeSheetFilter();activeSheetFilter=key;const rows=getRows()||[],vals=[...new Set(rows.map(r=>String(r[key]??"")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),selected=new Set(filterSelected(filters[key]));const m=document.createElement("div");m.className="sheet-filter-menu";const list=()=>vals.slice(0,150).map(v=>'<label class="sheet-filter-check"><input type="checkbox" data-val="'+escapeHtml(v)+'" '+(selected.has(v)?'checked':'')+'> <span>'+escapeHtml(v)+'</span></label>').join("");m.innerHTML='<button data-act="asc">Ordenar A a la Z</button><button data-act="desc">Ordenar Z a la A</button><div class="sheet-filter-sep"></div><strong>Filtrar por valores</strong><div class="sheet-filter-actions"><button data-act="all">Seleccionar todo</button><button data-act="none">Borrar</button></div><input data-sheet-search placeholder="Buscar…"><div class="sheet-filter-values">'+list()+'</div><button class="sheet-apply" data-act="apply">Aplicar</button>';document.body.appendChild(m);const r=btn.getBoundingClientRect();m.style.left=Math.min(r.left,window.innerWidth-310)+"px";m.style.top=(r.bottom+4)+"px";const box=m.querySelector(".sheet-filter-values"),bind=()=>box.querySelectorAll("[data-val]").forEach(x=>x.onchange=()=>x.checked?selected.add(x.dataset.val):selected.delete(x.dataset.val));bind();m.querySelector('[data-act="asc"]').onclick=()=>{closeSheetFilter();onSort(key,1)};m.querySelector('[data-act="desc"]').onclick=()=>{closeSheetFilter();onSort(key,-1)};m.querySelector('[data-act="all"]').onclick=()=>{vals.forEach(v=>selected.add(v));box.innerHTML=list();bind()};m.querySelector('[data-act="none"]').onclick=()=>{selected.clear();box.innerHTML=list();bind()};m.querySelector('[data-act="apply"]').onclick=()=>{if(selected.size)filters[key]=[...selected];else delete filters[key];closeSheetFilter();onFilter()};m.querySelector("[data-sheet-search]").oninput=x=>{const q=x.target.value.toLowerCase();box.querySelectorAll("label").forEach(l=>l.hidden=!l.textContent.toLowerCase().includes(q))}}})}
document.addEventListener("click",e=>{if(!e.target.closest(".sheet-filter-menu")&&!e.target.closest("[data-sheet-filter]"))closeSheetFilter()});
function enableDraggableColumns(root=document){
 root.querySelectorAll('table').forEach(table=>{
  if(table.classList.contains('nc-operational-table'))return;if(table.dataset.dragReady){delete table.dataset.dragReady} 
  const row=table.tHead?.rows?.[0];if(!row||row.cells.length<2)return;table.dataset.dragReady='1';
  [...row.cells].forEach(th=>{th.draggable=true;th.classList.add('draggable-th')});
  let from=null,side='before',target=null;
  row.addEventListener('dragstart',e=>{const th=e.target.closest('th');if(!th)return;from=[...row.cells].indexOf(th);th.classList.add('col-dragging');e.dataTransfer.effectAllowed='move'});
  row.addEventListener('dragover',e=>{const th=e.target.closest('th');if(!th||from==null)return;e.preventDefault();const r=th.getBoundingClientRect();side=e.clientX<r.left+r.width/2?'before':'after';target=[...row.cells].indexOf(th);row.querySelectorAll('.col-drop-left,.col-drop-right').forEach(x=>x.classList.remove('col-drop-left','col-drop-right'));th.classList.add(side==='before'?'col-drop-left':'col-drop-right');e.dataTransfer.dropEffect='move'});
  row.addEventListener('drop',e=>{e.preventDefault();if(from==null||target==null)return;const count=row.cells.length;let insertion=target+(side==='after'?1:0);if(insertion===from||insertion===from+1){from=null;target=null;row.querySelectorAll('.col-drop-left,.col-drop-right').forEach(x=>x.classList.remove('col-drop-left','col-drop-right'));return}
   [...table.rows].forEach(tr=>{if(tr.cells.length!==count)return;const moving=tr.cells[from];let dest=insertion;if(from<dest)dest--;if(dest>=tr.cells.length)tr.appendChild(moving);else tr.insertBefore(moving,tr.cells[dest])});from=null;target=null;row.querySelectorAll('.col-drop-left,.col-drop-right,.col-dragging').forEach(x=>x.classList.remove('col-drop-left','col-drop-right','col-dragging'))});
  row.addEventListener('dragend',()=>{if(table.id==="assemblyTable"){assemblyColumnOrder=[...row.cells].map(th=>th.dataset.colKey).filter(Boolean);localStorage.setItem("sgp_assembly_col_order",JSON.stringify(assemblyColumnOrder))}from=null;target=null;row.querySelectorAll('.col-drop-left,.col-drop-right,.col-dragging').forEach(x=>x.classList.remove('col-drop-left','col-drop-right','col-dragging'))});
 });
}
const tableDragObserver=new MutationObserver(()=>enableDraggableColumns());tableDragObserver.observe(document.body,{childList:true,subtree:true});enableDraggableColumns();

document.querySelector("#closeNcNew")?.addEventListener("click",()=>document.querySelector("#ncNewModal").hidden=true);

function renderNcColumnPicker(){
 const box=document.querySelector("#ncColumnPicker");if(!box)return;
 box.innerHTML='<div class="nc-column-picker-head"><strong>Campos visibles</strong><span>Selecciona qué columnas mostrar</span></div><div class="nc-column-picker-grid">'+ncCols.map(([k,l])=>`<label><input type="checkbox" data-nccolvis="${k}" ${ncHiddenCols.has(k)?'':'checked'}> ${escapeHtml(l||'Semáforo')}</label>`).join('')+'</div>';
 box.querySelectorAll('[data-nccolvis]').forEach(x=>x.addEventListener('change',()=>{x.checked?ncHiddenCols.delete(x.dataset.nccolvis):ncHiddenCols.add(x.dataset.nccolvis);localStorage.setItem("sgp_nc_hidden_cols",JSON.stringify([...ncHiddenCols]));renderNcView()}));
}
document.querySelector("#ncChooseColumns")?.addEventListener("click",()=>{const b=document.querySelector("#ncColumnPicker");b.hidden=!b.hidden;if(!b.hidden)renderNcColumnPicker()});

let ncGlassRows=[],ncGlassPreview=null;
async function previewNcGlass(){
 const file=document.querySelector("#ncGlassFile")?.files?.[0],status=document.querySelector("#ncGlassStatus"),btn=document.querySelector("#applyNcGlass");if(!file){status.textContent="Selecciona el Export NC Vidrio.";return}
 try{status.textContent="Leyendo NC Vidrio…";btn.disabled=true;ncGlassRows=await readNcGlassWorkbook(file);const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_previsualizar_nc_vidrio",{p_token:token,p_datos:ncGlassRows});if(error)throw error;ncGlassPreview={...data,file:file.name};document.querySelector("#ncGlassReceived").textContent=data.recibidos||0;document.querySelector("#ncGlassNew").textContent=data.nuevos||0;document.querySelector("#ncGlassUpdated").textContent=data.actualizados||0;document.querySelector("#ncGlassWeeks").textContent="Semana Maestro detectada: "+(data.por_semana||[]).join(", ");status.textContent="Validación completada. No se ha escrito información.";btn.disabled=false}catch(e){status.textContent="Validación rechazada ✕ "+e.message}}
async function applyNcGlass(){
 if(!ncGlassPreview)return;const status=document.querySelector("#ncGlassStatus"),btn=document.querySelector("#applyNcGlass");try{btn.disabled=true;status.textContent="Aplicando NC Vidrio…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_aplicar_nc_vidrio",{p_token:token,p_nombre_archivo:ncGlassPreview.file,p_datos:ncGlassRows});if(error)throw error;status.textContent=`NC Vidrio actualizado ✓ · ${data.nuevos} nuevas · ${data.actualizados} actualizadas`;const {data:ev,error:evErr}=await client.rpc("sgp_resumen_eventos_actualizacion",{p_token:token,p_id_lote:data.id_lote,p_fuente:"NC_VIDRIO"});if(evErr)throw evErr;window.ncGlassLoadEvents=ev||{};const sm=document.querySelector("#ncGlassChangeSummary");sm.hidden=false;document.querySelector("#ncgLoadNew").textContent=(ev.NUEVA||[]).length;document.querySelector("#ncgLoadClosed").textContent=(ev.FINALIZADA||[]).length;document.querySelector("#ncgLoadOpen").textContent=(ev.ABIERTA||[]).length}catch(e){status.textContent="Aplicación rechazada ✕ "+e.message;btn.disabled=false}}
document.querySelector("#previewNcGlass")?.addEventListener("click",previewNcGlass);document.querySelector("#applyNcGlass")?.addEventListener("click",applyNcGlass);

const ncGlassCols=[['semana_maestro','Sem. Maestro'],['consecutivo','NC'],['estado_nc','Estado'],['dias_abierta','Días'],['fecha_generacion_nc','Generación'],['semana_prod','Sem. Prod'],['oves','OVES'],['orden_sap','Orden SAP'],['item','Item'],['proyecto','Proyecto'],['sistema','Sistema'],['motivo','Motivo'],['linea_responsable','Línea responsable'],['linea_afectada','Línea afectada'],['linea_despacho','Línea despacho'],['cant_repo','Cant. repo'],['cant_recibida','Cant. recibida'],['mt_nc','MT NC'],['estado_auditado','Auditado'],['turno','Turno']];
let ncGlassViewRows=[],ncGlassFilters={},ncGlassHidden=new Set(JSON.parse(localStorage.getItem("sgp_ncg_hidden_cols")||"[]"));
let ncGlassOrder=JSON.parse(localStorage.getItem("sgp_ncg_col_order")||"null");if(Array.isArray(ncGlassOrder)){const m=new Map(ncGlassCols);ncGlassCols.splice(0,ncGlassCols.length,...ncGlassOrder.filter(k=>m.has(k)).map(k=>[k,m.get(k)]),...ncGlassCols.filter(([k])=>!ncGlassOrder.includes(k)))}
function renderNcGlassView(){const h=document.querySelector("#ncGlassHead"),b=document.querySelector("#ncGlassBody");if(!h||!b)return;const cols=ncGlassCols.filter(([k])=>!ncGlassHidden.has(k));h.innerHTML='<tr>'+cols.map(([k,l])=>'<th data-col-key="'+escapeHtml(k)+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+escapeHtml(k)+'"><span>'+escapeHtml(l)+(ncGlassSort.key===k?(ncGlassSort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join('')+'</tr>';let rows=ncGlassViewRows.filter(r=>Object.entries(ncGlassFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(String(r[k]??''))));if(ncGlassSort.key)rows=[...rows].sort((x,y)=>String(x[ncGlassSort.key]??'').localeCompare(String(y[ncGlassSort.key]??''),undefined,{numeric:true})*ncGlassSort.dir);b.innerHTML=rows.length?rows.map(r=>'<tr class="'+(String(r.estado_nc).toUpperCase()==='CERRADA'?'ncg-closed':'ncg-open')+'">'+cols.map(([k])=>'<td>'+escapeHtml(r[k]??'')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+cols.length+'">Sin NC para este filtro.</td></tr>';bindSheetFilters(h.closest("table"),()=>ncGlassViewRows,cols.map(c=>({key:c[0],label:c[1]})),ncGlassFilters,(k,d)=>{ncGlassSort={key:k,dir:d};renderNcGlassView()},()=>renderNcGlassView());enableDraggableColumns(h.closest("table"))}
function renderNcGlassPicker(){const box=document.querySelector("#ncGlassColumnPicker");box.innerHTML='<div class="nc-column-picker-head"><strong>Campos visibles</strong><span>Selecciona las columnas de la tabla</span></div><div class="nc-column-picker-grid">'+ncGlassCols.map(([k,l])=>`<label><input type="checkbox" data-ncgvis="${k}" ${ncGlassHidden.has(k)?'':'checked'}> ${l}</label>`).join('')+'</div>';box.querySelectorAll('[data-ncgvis]').forEach(x=>x.addEventListener('change',()=>{x.checked?ncGlassHidden.delete(x.dataset.ncgvis):ncGlassHidden.add(x.dataset.ncgvis);localStorage.setItem("sgp_ncg_hidden_cols",JSON.stringify([...ncGlassHidden]));renderNcGlassView()}))}
async function loadNcGlassOperational(){const status=document.querySelector("#ncGlassViewStatus");try{status.textContent="Consultando NC Vidrio…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),sel=document.querySelector("#ncGlassWeek"),week=sel?.value?Number(sel.value):null;const {data,error}=await client.rpc("sgp_consultar_nc_vidrio",{p_token:token,p_semana:week});if(error)throw error;ncGlassViewRows=data.rows||[];const current=sel.value,weeks=data.semanas_abiertas||[];sel.innerHTML='<option value="">Todas las semanas abiertas</option>'+weeks.map(w=>`<option value="${w}">Semana ${w}</option>`).join('');if(current&&weeks.map(String).includes(current))sel.value=current;document.querySelector("#ncgTotal").textContent=ncGlassViewRows.length;document.querySelector("#ncgOpen").textContent=ncGlassViewRows.filter(r=>String(r.estado_nc).toUpperCase()==='ABIERTA').length;document.querySelector("#ncgClosed").textContent=ncGlassViewRows.filter(r=>String(r.estado_nc).toUpperCase()==='CERRADA').length;document.querySelector("#ncgSupplier").textContent=ncGlassViewRows.filter(r=>String(r.motivo).toUpperCase().includes('PROVEEDOR')||String(r.linea_afectada).toUpperCase().includes('PROVEEDOR')).length;document.querySelector("#ncgProcess").textContent=ncGlassViewRows.filter(r=>String(r.motivo).toUpperCase().includes('PROCESO')).length;status.textContent=week?`Semana Maestro ${week}`:`Mostrando todas las NC de ${weeks.length} semana(s) abierta(s)`;renderNcGlassView()}catch(e){status.textContent="Error consultando NC Vidrio: "+e.message}}
document.querySelector("#loadNcGlassView")?.addEventListener("click",loadNcGlassOperational);document.querySelector("#ncGlassWeek")?.addEventListener("change",loadNcGlassOperational);document.querySelector("#ncGlassChooseColumns")?.addEventListener("click",()=>{const b=document.querySelector("#ncGlassColumnPicker");b.hidden=!b.hidden;if(!b.hidden)renderNcGlassPicker()});
document.querySelector('[data-view="nc-vidrio"]')?.addEventListener("click",loadNcGlassOperational);



let alTrackRows=[];let alTrackFilters={},alTrackSort={key:null,dir:1};
let alTrackCols=[
["semana_prog","Semana"],["id","ID"],["produccion","Producción"],["reserva","Reserva"],["estado_reserva_fuente","Estado"],["estado_entrega_corte","Entrega corte"],["proyecto","Proyecto"],["sistema","Sistema"],["linea_prog","Línea Prog."],["bodega","Bodega"],["cant_vent","Cant. Vent"],["peso_reserva","Peso Reserva SAP"],["porcentaje_vidrio","% Vidrio"],["vent_cant_vidrio","Vent cant Vidrio"],["cant_pz","Cant. Pz"],["acabado","Acabado"],["ultimo_estado","Último Estado"],["quote","Quote"],["sistema_pvc","Sistema PVC?"],["is_service","is_service"],["anio","Año Prog."],["tipo_orden","Tipo Orden"]
];
const savedAlOrder=JSON.parse(localStorage.getItem("sgp_alt_col_order")||"null");if(Array.isArray(savedAlOrder)){const m=new Map(alTrackCols);alTrackCols=[...savedAlOrder.filter(k=>m.has(k)).map(k=>[k,m.get(k)]),...alTrackCols.filter(([k])=>!savedAlOrder.includes(k))]}
let alHidden=new Set(JSON.parse(localStorage.getItem("sgp_alt_hidden_cols")||"[]"));
const alEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function alVisible(){return alTrackCols.filter(([k])=>!alHidden.has(k))}
function renderAlTrackRows(rows){const h=document.querySelector("#alTrackHead"),b=document.querySelector("#alTrackBody"),cols=alVisible();if(!h||!b)return;h.innerHTML='<tr>'+cols.map(([k,l])=>'<th data-col-key="'+escapeHtml(k)+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+escapeHtml(k)+'"><span>'+escapeHtml(l)+(alTrackSort.key===k?(alTrackSort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join('')+'</tr>';let rr=rows.filter(r=>Object.entries(alTrackFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(String(r[k]??''))));if(alTrackSort.key)rr=[...rr].sort((x,y)=>String(x[alTrackSort.key]??'').localeCompare(String(y[alTrackSort.key]??''),undefined,{numeric:true})*alTrackSort.dir);b.innerHTML=rr.map(r=>'<tr>'+cols.map(([k])=>'<td>'+alEsc(r[k])+'</td>').join('')+'</tr>').join('');bindSheetFilters(h.closest("table"),()=>alTrackRows,cols.map(c=>({key:c[0],label:c[1]})),alTrackFilters,(k,d)=>{alTrackSort={key:k,dir:d};renderAlTrackRows(alTrackRows)},()=>renderAlTrackRows(alTrackRows));enableDraggableColumns(h.closest("table"))}
function alCounts(state){const x=state?alTrackRows.filter(r=>r.estado_reserva===state):alTrackRows;return [new Set(x.map(r=>r.reserva)).size,x.reduce((n,r)=>n+(Number(r.cant_vent)||0),0)]}
async function loadAlTrack(){const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),sel=document.querySelector("#alTrackWeek"),week=sel?.value?Number(sel.value):null;const {data,error}=await client.rpc("sgp_consultar_seguimiento_aluminio",{p_token:token,p_semana:week});if(error){document.querySelector("#alTrackStatus").textContent="Error: "+error.message;return}alTrackRows=data.rows||[];if(sel&&sel.options.length<=1)(data.semanas||[]).forEach(w=>sel.add(new Option("Semana "+w,w)));const ab=alCounts("PENDIENTE_ABASTECIMIENTO"),bo=alCounts("PENDIENTE_BODEGA"),en=alCounts("ALUMINIO_ENTREGADO");document.querySelector("#altTotal").textContent=alTrackRows.length;document.querySelector("#altSupply").textContent=ab[0]+"/"+ab[1];document.querySelector("#altWarehouse").textContent=bo[0]+"/"+bo[1];document.querySelector("#altDelivered").textContent=en[0]+"/"+en[1];document.querySelector("#alTrackStatus").textContent=(week?"Semana "+week:"Todas las semanas")+" · "+alTrackRows.length+" relaciones Reserva + ID";renderAlTrackRows(alTrackRows)}
function openAlTrackState(state){const rows=state?alTrackRows.filter(r=>r.estado_reserva===state):alTrackRows,labels={PENDIENTE_ABASTECIMIENTO:"Pend. Abastecimiento",PENDIENTE_BODEGA:"Pend. Bodega",ALUMINIO_ENTREGADO:"Aluminio entregado"};document.querySelector("#alTrackModalTitle").textContent=state?labels[state]:"Total seguimiento";const rs=new Set(rows.map(r=>r.reserva)).size,pan=rows.reduce((n,r)=>n+(Number(r.cant_vent)||0),0);document.querySelector("#alTrackModalMeta").textContent=rs+" reservas / "+pan+" paneles";const b=document.querySelector("#alTrackModalBody");b.innerHTML=rows.map(r=>`<tr><td>${alEsc(r.semana_prog)}</td><td>${alEsc(r.id)}</td><td>${alEsc(r.produccion)}</td><td>${alEsc(r.reserva)}</td><td>${alEsc(r.estado_reserva_fuente||r.estado_reserva)}</td><td>${alEsc(r.estado_entrega_corte)}</td><td>${alEsc(r.proyecto)}</td><td>${alEsc(r.sistema)}</td></tr>`).join("");document.querySelector("#alTrackModal").hidden=false}
function renderAlPicker(){const p=document.querySelector("#alTrackColumnPicker");if(!p)return;p.innerHTML=alTrackCols.map(([k,l])=>`<label><input type="checkbox" data-altvisible="${k}" ${alHidden.has(k)?"":"checked"}> ${l}</label>`).join("");p.querySelectorAll("[data-altvisible]").forEach(x=>x.addEventListener("change",()=>{x.checked?alHidden.delete(x.dataset.altvisible):alHidden.add(x.dataset.altvisible);localStorage.setItem("sgp_alt_hidden_cols",JSON.stringify([...alHidden]));renderAlTrackRows(alTrackRows)}))}
document.querySelector('[data-view="seguimiento-aluminio"]')?.addEventListener("click",loadAlTrack);document.querySelector("#loadAlTrack")?.addEventListener("click",loadAlTrack);document.querySelector("#alTrackWeek")?.addEventListener("change",loadAlTrack);document.querySelector("#alTrackSummary")?.addEventListener("click",e=>{const c=e.target.closest("[data-alstate]");if(c)openAlTrackState(c.dataset.alstate)});document.querySelector("#closeAlTrackModal")?.addEventListener("click",()=>document.querySelector("#alTrackModal").hidden=true);document.querySelector("#alTrackChooseColumns")?.addEventListener("click",()=>{const p=document.querySelector("#alTrackColumnPicker");renderAlPicker();p.hidden=!p.hidden});

let prRows=[],prReservations=[],prCurrent=null,prNumber=1,prParts=1,prActivePart="",prAssign={};
const prE=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
async function openPriorityWizard(){const year=Number(document.querySelector("#queryYear").value),week=Number(document.querySelector("#queryWeek").value),line=document.querySelector("#queryLine").value||"PANELES_2";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_datos_asignacion_prioridades",{p_token:token,p_anio:year,p_semana:week,p_linea:line});if(error){alert(error.message);return}prRows=data.rows||[];const m=new Map;prRows.forEach(r=>{(()=>{const res=String(r.reserva||"").split(",")[0].trim();if(res){if(!m.has(res))m.set(res,[]);m.get(res).push(r)}})()});prReservations=[...m].map(([reserva,rows])=>({reserva,rows,tipo:rows[0]?.tipo||"",sistema:[...new Set(rows.map(x=>x.sistema).filter(Boolean))].join(", "),acabado:[...new Set(rows.map(x=>x.acabado).filter(Boolean))].join(", "),paneles:rows.reduce((n,x)=>n+(Number(x.cantidad)||0),0),assigned:rows.some(x=>x.prioridad&&x.prioridad_reserva===reserva)}));prNumber=getNextPriorityNumber();document.querySelector("#priorityModal").hidden=false;renderPrList()}
function getNextPriorityNumber(){const nums=prReservations.flatMap(x=>x.rows.filter(r=>r.prioridad&&r.prioridad_reserva===x.reserva).map(r=>Number(String(r.prioridad).split(".")[0]))).filter(Number.isFinite);return nums.length?Math.max(...nums)+1:1}
function renderPrList(){const el=document.querySelector("#priorityReservationList"),done=document.querySelector("#priorityAssignedList");document.querySelector("#priorityWorkModal").hidden=true;el.hidden=false;done.hidden=false;const pending=prReservations.map((x,i)=>({...x,_i:i})).filter(x=>!x.assigned),assigned=prReservations.filter(x=>x.assigned);document.querySelector("#priorityStatus").textContent=prReservations.length+" reservas · Prioridad "+prNumber+" · "+assigned.length+" asignadas · "+pending.length+" pendientes";el.innerHTML='<h3>Reservas pendientes</h3><div class="table-wrap"><table class="nc-operational-table"><thead><tr><th>Tipo</th><th>Sistema</th><th>Acabado</th><th>Reserva AL</th><th>Paneles</th><th></th></tr></thead><tbody>'+pending.map(x=>`<tr><td>${prE(x.tipo)}</td><td>${prE(x.sistema)}</td><td>${prE(x.acabado)}</td><td>${prE(x.reserva)}</td><td>${x.paneles}</td><td><button data-prres="${x._i}">Asignar ${prNumber}</button></td></tr>`).join("")+"</tbody></table></div>";el.querySelectorAll("[data-prres]").forEach(b=>b.onclick=()=>startPr(Number(b.dataset.prres)));done.innerHTML='<h3>Prioridades asignadas</h3><div class="table-wrap"><table class="nc-operational-table"><thead><tr><th>Prioridad</th><th>Tipo</th><th>Reserva AL</th><th>Sistema</th><th>Acabado</th><th>Paneles</th><th>Producciones</th></tr></thead><tbody>'+assigned.sort((a,b)=>String(a.rows.map(r=>r.prioridad).sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}))[0]).localeCompare(String(b.rows.map(r=>r.prioridad).sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}))[0]),undefined,{numeric:true})).map(x=>{const ps=[...new Set(x.rows.filter(r=>r.prioridad_reserva===x.reserva).map(r=>r.prioridad).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));return `<tr><td><strong>${ps.join(", ")}</strong></td><td>${prE(x.tipo)}</td><td>${prE(x.reserva)}</td><td>${prE(x.sistema)}</td><td>${prE(x.acabado)}</td><td>${x.paneles}</td><td>${x.rows.length}</td></tr>`}).join("")+"</tbody></table></div>"}function startPr(i){prCurrent=prReservations[i];prAssign={};prParts=1;prActivePart=String(prNumber);document.querySelector("#priorityParts").innerHTML="";document.querySelector("#priorityPartSummary").innerHTML="";document.querySelector("#priorityProductionBody").innerHTML="";document.querySelector("#priorityWorkModal").hidden=false;document.querySelector("#priorityWorkTitle").textContent="Prioridad "+prNumber+" · Reserva "+prCurrent.reserva;const project=/proyecto/i.test(prCurrent.tipo);document.querySelector("#priorityQuestion").innerHTML=`<h3>Prioridad ${prNumber} · Reserva ${prE(prCurrent.reserva)}</h3><p>${prE(prCurrent.tipo)} · ${prCurrent.paneles} paneles</p>`+(project?'<p><strong>Proyecto:</strong> la reserva se asignará completa y no puede dividirse.</p>':'<p>¿Deseas dividir esta reserva?</p>');const a=document.querySelector("#priorityActions");a.innerHTML=project?'<button data-div="1">Asignar completa</button>':'<button data-div="1">No dividir</button><button data-div="ask">Sí, dividir</button>';a.querySelectorAll("[data-div]").forEach(b=>b.onclick=()=>b.dataset.div==="ask"?askPrParts():setPrParts(1));if(project)setPrParts(1);else renderPrUnassigned()}
function renderPrUnassigned(){const b=document.querySelector("#priorityProductionBody");b.innerHTML=[...prCurrent.rows].map(r=>`<tr><td>—</td><td>${prE(r.id)}</td><td>${prE(r.produccion)}</td><td>${prE(r.cantidad)}</td><td>${prE(r.tipo_vidrio)}</td><td>${prE(r.sistema)}</td><td>${prE(r.acabado)}</td></tr>`).join("")}
function askPrParts(){const n=Number(prompt("¿En cuántas partes deseas dividir la prioridad "+prNumber+"?","2"));if(n>=2&&n<=20)setPrParts(n)}
function setPrParts(n){prParts=n;prAssign={};if(n===1){prCurrent.rows.forEach(r=>prAssign[r.key_produccion]=String(prNumber));prActivePart=String(prNumber)}else prActivePart=prNumber+".1";renderPrParts();renderPrProductions()}
function renderPrParts(){const e=document.querySelector("#priorityParts");e.innerHTML=prParts===1?"":Array.from({length:prParts},(_,i)=>`<button class="${prActivePart===prNumber+"."+(i+1)?"active":""}" data-prpart="${prNumber}.${i+1}">${prNumber}.${i+1}</button>`).join("");e.querySelectorAll("[data-prpart]").forEach(b=>b.onclick=()=>{prActivePart=b.dataset.prpart;renderPrParts();renderPrProductions()})}
function renderPrPartSummary(){const e=document.querySelector("#priorityPartSummary");if(!e)return;const parts=prParts===1?[String(prNumber)]:Array.from({length:prParts},(_,i)=>prNumber+"."+(i+1));e.innerHTML=parts.map(p=>{const rows=prCurrent.rows.filter(r=>prAssign[r.key_produccion]===p),pan=rows.reduce((n,r)=>n+(Number(r.cantidad)||0),0);return `<div class="daily-metric-card"><small>Prioridad ${p}</small><strong>${pan}</strong><span>ventanas · ${rows.length} producciones</span></div>`}).join("")}function renderPrProductions(){renderPrPartSummary();const b=document.querySelector("#priorityProductionBody");b.innerHTML=[...prCurrent.rows].sort((a,z)=>String(prAssign[a.key_produccion]||"999").localeCompare(String(prAssign[z.key_produccion]||"999"),undefined,{numeric:true})).map(r=>`<tr data-prprod="${prE(r.key_produccion)}" data-part-index="${String(prAssign[r.key_produccion]||"").includes(".")?String(prAssign[r.key_produccion]).split(".")[1]:""}"><td>${prE(prAssign[r.key_produccion]||"—")}</td><td>${prE(r.id)}</td><td>${prE(r.produccion)}</td><td>${prE(r.cantidad)}</td><td>${prE(r.tipo_vidrio)}</td><td>${prE(r.sistema)}</td><td>${prE(r.acabado)}</td></tr>`).join("");if(prParts>1)b.querySelectorAll("[data-prprod]").forEach(tr=>tr.onclick=()=>{prAssign[tr.dataset.prprod]=prActivePart;renderPrProductions()})}
async function savePr(){if(!prCurrent)return;if(Object.keys(prAssign).length!==prCurrent.rows.length){alert("Debes asignar una prioridad a todas las producciones de la reserva.");return}const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),year=Number(document.querySelector("#queryYear").value),week=Number(document.querySelector("#queryWeek").value),line=document.querySelector("#queryLine").value||"PANELES_2";const asign=prCurrent.rows.map(r=>({key_produccion:r.key_produccion,prioridad:prAssign[r.key_produccion]}));const {error}=await client.rpc("sgp_guardar_prioridad",{p_token:token,p_anio:year,p_semana:week,p_linea:line,p_reserva:prCurrent.reserva,p_asignaciones:asign});if(error){alert(error.message);return}prCurrent.rows.forEach(r=>{r.prioridad=prAssign[r.key_produccion];r.prioridad_reserva=prCurrent.reserva});prCurrent.assigned=true;prNumber=getNextPriorityNumber();document.querySelector("#priorityWorkModal").hidden=true;renderPrList()}
document.querySelector("#openPriorityWizard")?.addEventListener("click",openPriorityWizard);document.querySelector("#closePriorityModal")?.addEventListener("click",()=>document.querySelector("#priorityModal").hidden=true);document.querySelector("#priorityBack")?.addEventListener("click",()=>document.querySelector("#priorityWorkModal").hidden=true);document.querySelector("#closePriorityWork")?.addEventListener("click",()=>document.querySelector("#priorityWorkModal").hidden=true);document.querySelector("#prioritySave")?.addEventListener("click",savePr);

async function autoGeneratePriorities(){
 const pending=prReservations.filter(x=>!x.assigned);
 if(!pending.length){alert("No hay reservas pendientes.");return}
 const used=[...new Set(prReservations.flatMap(x=>x.rows.map(r=>r.prioridad).filter(Boolean)).map(p=>String(p).split(".")[0]))].sort((a,b)=>Number(a)-Number(b));
 const first=used.length?Math.max(...used.map(Number))+1:1,last=first+pending.length-1;
 if(!confirm("Se asignarán automáticamente "+pending.length+" reservas completas con las prioridades "+first+" a "+last+". Las reservas ya divididas no se modificarán. ¿Continuar?"))return;
 const btn=document.querySelector("#priorityAutoGenerate");btn.disabled=true;btn.textContent="Generando…";
 try{
  const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),year=Number(document.querySelector("#queryYear").value),week=Number(document.querySelector("#queryWeek").value),line=document.querySelector("#queryLine").value||"PANELES_2";
  const {data,error}=await client.rpc("sgp_generar_prioridades_restantes",{p_token:token,p_anio:year,p_semana:week,p_linea:line});if(error)throw error;
  const {data:fresh,error:e2}=await client.rpc("sgp_datos_asignacion_prioridades",{p_token:token,p_anio:year,p_semana:week,p_linea:line});if(e2)throw e2;
  prRows=fresh.rows||[];const m=new Map;prRows.forEach(r=>(()=>{const res=String(r.reserva||"").split(",")[0].trim();if(res){if(!m.has(res))m.set(res,[]);m.get(res).push(r)}})());
  prReservations=[...m].map(([reserva,rows])=>({reserva,rows,tipo:rows[0]?.tipo||"",sistema:[...new Set(rows.map(x=>x.sistema).filter(Boolean))].join(", "),acabado:[...new Set(rows.map(x=>x.acabado).filter(Boolean))].join(", "),paneles:rows.reduce((n,x)=>n+(Number(x.cantidad)||0),0),assigned:rows.some(x=>x.prioridad&&x.prioridad_reserva===reserva)}));
  prNumber=data.siguiente_prioridad||prReservations.length+1;renderPrList();document.querySelector("#priorityStatus").textContent="Generación automática completada · "+data.reservas_generadas+" reservas asignadas.";
 }catch(e){alert("No fue posible generar las prioridades: "+e.message)}
 finally{btn.disabled=false;btn.textContent="Generar prioridades restantes automáticamente"}
}
document.querySelector("#priorityAutoGenerate")?.addEventListener("click",autoGeneratePriorities);

function renderProgramPicker(){const b=document.querySelector('#programColumnPicker');if(!b)return;b.innerHTML='<div class="nc-column-picker-grid">'+detailColumns.map(c=>'<label><input type="checkbox" data-pcol="'+c.key+'" '+(detailHidden.has(c.key)?'':'checked')+'> '+escapeHtml(c.label)+'</label>').join('')+'</div>';b.querySelectorAll('[data-pcol]').forEach(x=>x.onchange=()=>{x.checked?detailHidden.delete(x.dataset.pcol):detailHidden.add(x.dataset.pcol);localStorage.setItem('sgp_program_hidden_cols',JSON.stringify([...detailHidden]));renderQueriedProgramming()})}document.querySelector('#programChooseColumns')?.addEventListener('click',()=>{const b=document.querySelector('#programColumnPicker');b.hidden=!b.hidden;if(!b.hidden)renderProgramPicker()});
function showNcLoadDetail(kind){const d=window.ncLoadChangeData||{},rows=kind==='new'?(d.nuevas||[]):kind==='closed'?(d.finalizadas||[]):(d.sin_auditar||[]),titles={new:'NC nuevas en esta carga',closed:'NC finalizadas desde el último update',audit:'NC sin auditar en esta carga'};document.querySelector('#ncNewTitle').textContent=titles[kind]+' · '+rows.length;document.querySelector('#ncNewBody').innerHTML=rows.map(r=>'<tr><td>'+escapeHtml(r.consecutivo||'')+'</td><td>'+escapeHtml(r.linea_produccion||r.linea||'')+'</td><td>'+escapeHtml(r.semana_nc||'')+'</td><td>'+escapeHtml(r.referencia||'')+'</td><td>'+escapeHtml(r.acabado||'')+'</td><td><span class="nc-state-pill">'+escapeHtml(r.estado||r.estado_nuevo||'')+'</span></td><td>'+escapeHtml(String(r.creacion||'').slice(0,10))+'</td><td>'+escapeHtml(r.reserva_solucion||'')+'</td><td>'+escapeHtml(ncInches(r.perfil_mm))+'</td><td>'+escapeHtml(r.no_cortes||'')+'</td></tr>').join('');document.querySelector('#ncNewModal').hidden=false}document.querySelectorAll('[data-ncload]').forEach(b=>b.addEventListener('click',()=>showNcLoadDetail(b.dataset.ncload)));
function showNcGlassLoadDetail(k){const d=window.ncGlassLoadEvents||{},rows=d[k]||[],t={NUEVA:'NC Vidrio nuevas',FINALIZADA:'NC Vidrio finalizadas en este update',ABIERTA:'NC Vidrio abiertas'}[k];document.querySelector('#ncNewTitle').textContent=t+' · '+rows.length;const head=document.querySelector('#ncNewModal thead');if(head)head.innerHTML='<tr><th>FECHA</th><th>CONSECUTIVO</th><th>SEMANA PROGR.</th><th>ORDEN</th><th>OVES SAP</th><th>ITEM</th><th>ESTADO</th></tr>';document.querySelector('#ncNewBody').innerHTML=rows.map(r=>'<tr><td>'+escapeHtml(String(r.fecha_generacion_nc||r.fecha_repo||'').slice(0,10))+'</td><td>'+escapeHtml(r.consecutivo||'')+'</td><td>'+escapeHtml(r.semana_prod??'')+'</td><td>'+escapeHtml(r.orden||'')+'</td><td>'+escapeHtml(r.oves||'')+'</td><td>'+escapeHtml(r.item||'')+'</td><td>'+escapeHtml(r.estado_nc||'')+'</td></tr>').join('');document.querySelector('#ncNewModal').hidden=false}document.querySelectorAll('[data-ncgload]').forEach(b=>b.addEventListener('click',()=>showNcGlassLoadDetail({new:'NUEVA',closed:'FINALIZADA',open:'ABIERTA'}[b.dataset.ncgload])));
function showOpsChangeDetail(rows,title){rows=rows||[];document.querySelector('#ncNewTitle').textContent=title+' · '+rows.length;const head=document.querySelector('#ncNewModal thead');if(head)head.innerHTML='<tr><th>SEMANA</th><th>ID</th><th>PRODUCCIÓN</th><th>RESERVA</th><th>SISTEMA</th><th>CANTIDAD</th><th>ESTADO</th></tr>';document.querySelector('#ncNewBody').innerHTML=rows.map(r=>'<tr><td>'+escapeHtml(r.semana_actual??r.semana_prog??'')+'</td><td>'+escapeHtml(r.id||'')+'</td><td>'+escapeHtml(r.produccion||'')+'</td><td>'+escapeHtml(r.reserva_al||r.reserva||'')+'</td><td>'+escapeHtml(r.sistema||'')+'</td><td>'+escapeHtml(r.cantidad??r.cant_vent??'')+'</td><td>'+escapeHtml(r.estado_produccion||r.estado||'')+'</td></tr>').join('');document.querySelector('#ncNewModal').hidden=false}document.querySelectorAll('[data-exportchange]').forEach(b=>b.addEventListener('click',()=>showOpsChangeDetail((window.exportChangeData||{})[b.dataset.exportchange],{ABIERTA_ENSAMBLE:'Abiertas en Ensamble',ENSAMBLADA_COMPLETA:'Ensambladas completamente',ORDEN_COMPLETADA:'Órdenes completadas'}[b.dataset.exportchange])));

// Persistent getAppToken already defined above.
function getAppUser(){try{const t=getAppToken();return t?{username:(currentAuth?.usuario||document.querySelector("#authUser")?.value||"")} : null}catch{return null}}
let recRows=[],recCurrent=null,recMissingDraft=[];
async function loadReception(){const token=getAppToken();if(!token)return;const client=await getSupabaseClient(),w=Number(document.querySelector('#recWeek')?.value)||null,{data,error}=await client.rpc('sgp_recepcion_listar',{p_token:token,p_semana:w});if(error)throw error;recRows=data||[];renderReception()}
function renderReception(){const q=(document.querySelector('#recSearch')?.value||'').toLowerCase(),rows=recRows.filter(r=>!q||String(r.reserva).toLowerCase().includes(q)),pending=rows.filter(r=>r.estado!=='RECIBIDA'),received=rows.filter(r=>r.estado==='RECIBIDA');document.querySelector('#recPending').textContent=pending.length;document.querySelector('#recReceived').textContent=received.length;document.querySelector('#recIncomplete').textContent=received.filter(r=>r.completa===false).length;document.querySelector('#recUnlegalized').textContent=received.filter(r=>!r.legalizada).length;document.querySelector('#recMissing').textContent=rows.reduce((a,r)=>a+Number(r.faltantes_abiertos||0),0);document.querySelector('#recPendingLabel').textContent=pending.length;document.querySelector('#recReceivedLabel').textContent=received.length;document.querySelector('#recBody').innerHTML=pending.length?pending.map(r=>'<tr><td>'+escapeHtml(r.semana_prog??'')+'</td><td>'+escapeHtml(r.reserva)+'</td><td>'+escapeHtml(r.sistema||'')+'</td><td>'+escapeHtml(r.acabado||'')+'</td><td>'+escapeHtml(r.cantidad??'')+'</td><td><span class="state-badge state-warn">PENDIENTE POR RECIBIR</span></td><td>'+Number(r.faltantes_abiertos||0)+'</td><td>'+Number(r.dias_pendiente||0).toFixed(1)+'</td><td><button data-receive="'+escapeHtml(r.reserva)+'">Auditar</button></td></tr>').join(''):'<tr><td colspan="9" class="empty-state">No hay reservas pendientes por recibir.</td></tr>';document.querySelector('#recReceivedBody').innerHTML=received.length?received.map(r=>'<tr><td>'+escapeHtml(r.semana_prog??'')+'</td><td>'+escapeHtml(r.reserva)+'</td><td>'+escapeHtml(r.sistema||'')+'</td><td>'+escapeHtml(r.acabado||'')+'</td><td>'+escapeHtml(r.cantidad??'')+'</td><td><span class="state-badge state-ok">RECIBIDA</span></td><td><span class="legal-badge '+(r.legalizada?'legal-ok':'legal-pending')+'">'+(r.legalizada?'LEGALIZADA':'RECIBIDA SIN LEGALIZAR')+'</span></td><td>'+Number(r.faltantes_abiertos||0)+'</td><td><button data-receive="'+escapeHtml(r.reserva)+'">Revisar</button></td></tr>').join(''):'<tr><td colspan="9" class="empty-state">Aún no hay reservas recibidas.</td></tr>';document.querySelectorAll('[data-receive]').forEach(b=>b.onclick=()=>openReception(b.dataset.receive))}
function openReception(reserva){recCurrent=recRows.find(r=>r.reserva===reserva);if(!recCurrent)return;recMissingDraft=[];document.querySelector('#recModalTitle').textContent='Auditar recepción · '+reserva;const date=document.querySelector('#recDate'),shift=document.querySelector('#recShift'),photos=document.querySelector('#recPhotos'),missing=document.querySelector('#recMissingSection');if(date)date.value=String(recCurrent.fecha_recepcion||new Date().toISOString().slice(0,10)).slice(0,10);if(shift)shift.value=recCurrent.turno||'';if(photos)photos.value='';const camera=document.querySelector('#recCameraPhotos'),sel=document.querySelector('#recPhotoSelection');if(camera)camera.value='';if(sel)sel.textContent='Sin archivos seleccionados';document.querySelectorAll('input[name="recCompleteChoice"]').forEach(x=>x.checked=recCurrent.estado==='RECIBIDA'?(x.value===(recCurrent.completa?'SI':'NO')):false);if(missing)missing.hidden=!(recCurrent.estado==='RECIBIDA'&&recCurrent.completa===false);document.querySelector('#recLegalized').checked=recCurrent?.legalizada??false;document.querySelector('#recObservation').value=recCurrent?.observacion||'';if(recCurrent.estado==='RECIBIDA'&&recCurrent.completa===false){recMissingDraft.push({perfil:'',cantidad:1,longitud:'',observacion:''})}renderMissingEditor();document.querySelector('#recModal').hidden=false}
function renderMissingEditor(){const b=document.querySelector('#missingEditor');b.innerHTML=recMissingDraft.map((r,i)=>'<div class="missing-row"><input list="profileCatalog" data-mi="'+i+'" data-k="perfil" placeholder="Buscar perfil" value="'+escapeHtml(r.perfil||'')+'"><input type="number" min="1" data-mi="'+i+'" data-k="cantidad" placeholder="Cantidad" value="'+escapeHtml(r.cantidad||'')+'"><input type="number" min="0" step="0.01" data-mi="'+i+'" data-k="longitud" placeholder="Longitud mm" value="'+escapeHtml(r.longitud||'')+'"><input data-mi="'+i+'" data-k="observacion" placeholder="Observación" value="'+escapeHtml(r.observacion||'')+'"><button data-delmi="'+i+'">✕</button></div>').join('')+'<datalist id="profileCatalog"></datalist>';b.querySelectorAll('[data-mi]').forEach(x=>x.oninput=()=>{recMissingDraft[+x.dataset.mi][x.dataset.k]=x.value;if(x.dataset.k==='perfil')searchProfiles(x.value)});b.querySelectorAll('[data-delmi]').forEach(x=>x.onclick=()=>{recMissingDraft.splice(+x.dataset.delmi,1);renderMissingEditor()})}
async function searchProfiles(q){if(q.length<2)return;const client=await getSupabaseClient(),{data}=await client.rpc('sgp_recepcion_catalogo_perfiles',{p_token:getAppToken(),p_buscar:q});const d=document.querySelector('#profileCatalog');if(d)d.innerHTML=(data||[]).map(x=>'<option value="'+escapeHtml(x.perfil)+'">'+escapeHtml(x.descripcion||'')+'</option>').join('')}
document.querySelector('#recChoosePhotos')?.addEventListener('click',()=>document.querySelector('#recPhotos')?.click());
document.querySelector('#recTakePhoto')?.addEventListener('click',()=>document.querySelector('#recCameraPhotos')?.click());
function updateRecPhotoSelection(){const a=[...document.querySelector('#recPhotos')?.files||[]],b=[...document.querySelector('#recCameraPhotos')?.files||[]],el=document.querySelector('#recPhotoSelection');if(el)el.textContent=(a.length+b.length)?((a.length+b.length)+' archivo(s) seleccionado(s)'):'Sin archivos seleccionados'}
document.querySelector('#recPhotos')?.addEventListener('change',updateRecPhotoSelection);
document.querySelector('#recCameraPhotos')?.addEventListener('change',updateRecPhotoSelection);
let receptionSaving=false;async function saveReception(){if(!recCurrent||receptionSaving)return;const choice=document.querySelector('input[name="recCompleteChoice"]:checked')?.value,date=document.querySelector('#recDate').value,shift=document.querySelector('#recShift').value;if(!date){alert('Seleccione la fecha de recepción.');return}if(!shift){alert('Seleccione el turno de recepción.');return}if(!choice){alert('Indique si la reserva está completa.');return}const complete=choice==='SI',falt=recMissingDraft.filter(x=>x.perfil&&Number(x.cantidad)>0);if(!complete&&!falt.length){alert('La reserva está incompleta. Debe registrar al menos un perfil pendiente.');return}const saveBtn=document.querySelector('#recSave');receptionSaving=true;if(saveBtn){saveBtn.disabled=true;saveBtn.dataset.oldText=saveBtn.textContent;saveBtn.textContent='Guardando…'}try{const client=await getSupabaseClient(),{data,error}=await client.rpc('sgp_recepcion_guardar',{p_token:getAppToken(),p_reserva:recCurrent.reserva,p_completa:complete,p_legalizada:document.querySelector('#recLegalized').checked,p_observacion:document.querySelector('#recObservation').value,p_faltantes:complete?[]:falt,p_fecha_recepcion:date,p_turno:shift});if(error)throw error;const files=[...document.querySelector('#recPhotos').files,...document.querySelector('#recCameraPhotos').files];for(const file of files){const path='recepciones/'+date.slice(0,4)+'/'+recCurrent.reserva+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const up=await client.storage.from('sgp-recepcion').upload(path,file);if(!up.error)await client.from('sgp_recepcion_evidencias').insert({id_recepcion:data.id_recepcion,reserva:recCurrent.reserva,ruta_storage:path,nombre_archivo:file.name,tipo_mime:file.type,tamano_bytes:file.size,usuario:getAppUser()?.username||''})}document.querySelector('#recModal').hidden=true;await loadReception();await loadMissing();alert('Recepción guardada correctamente.')}catch(e){alert('No fue posible guardar la recepción: '+(e?.message||e))}finally{receptionSaving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent=saveBtn.dataset.oldText||'Guardar recepción'}}}
let missingCloseId=null,missingReportRows=[];
function missingDate(v){return v?String(v).slice(0,10):'—'}
function missingTraffic(days){days=Number(days||0);return days>=3?'red':days>=2?'amber':'green'}
function trafficLabel(days){const c=missingTraffic(days);return c==='red'?'CRÍTICO':c==='amber'?'EN SEGUIMIENTO':'EN TIEMPO'}
async function loadMissing(){const token=getAppToken();if(!token)return;const client=await getSupabaseClient(),{data,error}=await client.rpc('sgp_recepcion_faltantes_listar',{p_token:token,p_solo_abiertos:false});if(error){console.error(error);return}const rows=data||[],open=rows.filter(x=>x.estado!=='CERRADO').sort((a,b)=>String(a.fecha_recepcion_reserva||'').localeCompare(String(b.fecha_recepcion_reserva||''))),resolved=rows.filter(x=>x.estado==='CERRADO');missingReportRows=open;document.querySelector('#missReservations').textContent=new Set(open.map(x=>x.reserva)).size;document.querySelector('#missOpen').textContent=open.length;document.querySelector('#missResolved').textContent=resolved.length;document.querySelector('#missGreen').textContent=open.filter(x=>missingTraffic(x.dias)==='green').length;document.querySelector('#missAmber').textContent=open.filter(x=>missingTraffic(x.dias)==='amber').length;document.querySelector('#missRed').textContent=open.filter(x=>missingTraffic(x.dias)==='red').length;document.querySelector('#missingBody').innerHTML=open.length?open.map(x=>'<tr class="traffic-row '+missingTraffic(x.dias)+'"><td>'+escapeHtml(x.reserva)+'</td><td>'+escapeHtml(x.perfil)+'</td><td>'+x.cantidad+'</td><td>'+escapeHtml(x.longitud??'')+'</td><td>'+escapeHtml(x.observacion||'')+'</td><td>'+missingDate(x.fecha_recepcion_reserva)+'</td><td>'+escapeHtml(x.turno_recepcion_reserva||'—')+'</td><td>'+Number(x.dias||0).toFixed(1)+'</td><td><span class="traffic-label '+missingTraffic(x.dias)+'">'+trafficLabel(x.dias)+'</span></td><td><button class="action-success" data-receive-missing="'+x.id_faltante+'" data-label="'+escapeHtml(x.reserva+' · '+x.perfil)+'">Registrar recibido</button></td></tr>').join(''):'<tr><td colspan="10" class="empty-state">No hay pendientes por resolver.</td></tr>';document.querySelector('#missingResolvedBody').innerHTML=resolved.length?resolved.sort((a,b)=>String(b.fecha_recibido||'').localeCompare(String(a.fecha_recibido||''))).map(x=>'<tr><td>'+escapeHtml(x.reserva)+'</td><td>'+escapeHtml(x.perfil)+'</td><td>'+x.cantidad+'</td><td>'+escapeHtml(x.longitud??'')+'</td><td>'+escapeHtml(x.usuario_reporte||x.usuario_creacion||'—')+'</td><td>'+escapeHtml(x.usuario_cierre||'—')+'</td><td>'+missingDate(x.fecha_recibido_operativa||x.fecha_recibido)+'</td><td>'+escapeHtml(x.turno_recibido||'—')+'</td><td><span class="missing-status closed">RECIBIDO</span></td></tr>').join(''):'<tr><td colspan="9" class="empty-state">Aún no hay pendientes resueltos.</td></tr>';document.querySelectorAll('[data-receive-missing]').forEach(b=>b.onclick=()=>openMissingReceive(b.dataset.receiveMissing,b.dataset.label))}
function openMissingReceive(id,label){missingCloseId=id;document.querySelector('#missingReceiveTitle').textContent=label||'Complete fecha y turno reales de recepción.';document.querySelector('#missingReceiveDate').value=new Date().toISOString().slice(0,10);document.querySelector('#missingReceiveShift').value='';document.querySelector('#missingReceiveModal').hidden=false}
function closeMissingReceive(){missingCloseId=null;document.querySelector('#missingReceiveModal').hidden=true}
async function saveMissingReceive(){if(!missingCloseId)return;const date=document.querySelector('#missingReceiveDate').value,shift=document.querySelector('#missingReceiveShift').value;if(!date){alert('Seleccione la fecha de recepción.');return}if(!shift){alert('Seleccione el turno de recepción.');return}const c=await getSupabaseClient(),{error}=await c.rpc('sgp_recepcion_faltante_estado',{p_token:getAppToken(),p_id_faltante:missingCloseId,p_estado:'CERRADO',p_fecha_recibido:date,p_turno:shift});if(error){alert(error.message);return}closeMissingReceive();await loadMissing()}
function generateMissingReport(){if(!missingReportRows.length){alert('No hay reservas activas con pendientes.');return}
 const grouped=new Map();missingReportRows.forEach(x=>{if(!grouped.has(x.reserva))grouped.set(x.reserva,{reserva:x.reserva,sistema:x.sistema||'',fecha:x.fecha_recepcion_reserva||'',turno:x.turno_recepcion_reserva||'',items:[]});grouped.get(x.reserva).items.push(x)});
 const groups=[...grouped.values()].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
 const total=missingReportRows.length,green=missingReportRows.filter(x=>missingTraffic(x.dias)==='green').length,amber=missingReportRows.filter(x=>missingTraffic(x.dias)==='amber').length,red=missingReportRows.filter(x=>missingTraffic(x.dias)==='red').length;
 const generated=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
 const blocks=groups.map(g=>'<section class="card"><div class="card-head"><div><b>Reserva '+escapeHtml(g.reserva)+'</b><span>Sistema · '+escapeHtml(g.sistema||'—')+'</span></div><div class="right"><b>'+missingDate(g.fecha)+'</b><span>'+escapeHtml(g.turno||'')+'</span></div></div><table><thead><tr><th>Perfil</th><th>Cant.</th><th>Longitud</th><th>Observación</th><th class="num">Días</th></tr></thead><tbody>'+g.items.map(x=>'<tr><td>'+escapeHtml(x.perfil)+'</td><td>'+x.cantidad+'</td><td>'+escapeHtml(x.longitud??'')+'</td><td>'+escapeHtml(x.observacion||'')+'</td><td class="num"><span class="dot '+missingTraffic(x.dias)+'"></span><b>'+Number(x.dias||0).toFixed(1)+'</b></td></tr>').join('')+'</tbody></table></section>').join('');
 const w=window.open('','_blank');if(!w){alert('Permita ventanas emergentes para generar el reporte.');return}
 w.document.write('<!doctype html><html><head><title>Pendientes Bodega · Paneles 2</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:Arial,sans-serif;color:#10233f;margin:0;background:#fff}.top{position:relative;background:linear-gradient(135deg,#0b2345,#174f8f);color:#fff;border-radius:14px;padding:17px 19px;margin-bottom:14px;overflow:hidden}.top:after{content:"";position:absolute;right:-34px;top:-55px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.08)}.eyebrow{font-size:9px;font-weight:800;letter-spacing:.14em;color:#bfdbfe;text-transform:uppercase}.title-row{display:flex;justify-content:space-between;align-items:end;gap:20px}h1{font-size:24px;margin:6px 0 3px;color:#fff}.line{display:inline-block;font-size:12px;font-weight:900;color:#0b2345;background:#dbeafe;border-radius:999px;padding:5px 10px;margin-top:4px}.generated{font-size:9px;color:#dbeafe;text-align:right;z-index:1}.generated b{color:#fff}.summary{display:grid;grid-template-columns:1.05fr 1.05fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px}.kpi{border:1px solid #dbe4f0;border-radius:11px;padding:10px 11px;background:#fff;box-shadow:0 2px 8px rgba(15,50,90,.07)}.kpi span{display:block;font-size:7.5px;text-transform:uppercase;color:#64748b;font-weight:900;letter-spacing:.04em}.kpi b{display:block;font-size:19px;margin-top:4px;color:#0b2345}.kpi.green b{color:#15803d}.kpi.amber b{color:#b45309}.kpi.red b{color:#dc2626}.card{position:relative;page-break-inside:avoid;border:1px solid #cbd9ea;border-radius:12px;overflow:hidden;margin:0 0 13px;box-shadow:0 2px 7px rgba(15,50,90,.055)}.card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#2563eb}.card-head{display:flex;justify-content:space-between;padding:11px 14px 10px 16px;background:linear-gradient(90deg,#edf5ff,#f8fbff);border-bottom:1px solid #d7e2ef}.card-head div{display:grid;gap:2px}.card-head b{font-size:13px;color:#0b2345}.card-head span{font-size:9px;color:#64748b}.right{text-align:right}table{width:100%;border-collapse:collapse}th,td{padding:7px 10px;border-bottom:1px solid #e5ebf2;text-align:left;font-size:9px}th{font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#53657c;background:#f8fafc}tbody tr:last-child td{border-bottom:0}.num{text-align:right;white-space:nowrap}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px;vertical-align:-1px;box-shadow:0 0 0 2px #fff,0 0 0 3px #dbe4f0}.dot.green{background:#22c55e}.dot.amber{background:#f59e0b}.dot.red{background:#ef4444}.legend{display:flex;gap:16px;font-size:8px;color:#64748b;margin:9px 2px 0}.legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:-1px}.foot{display:flex;justify-content:space-between;margin-top:14px;padding:9px 2px 0;border-top:1px solid #dbe4f0;font-size:7.5px;color:#64748b}@media print{.card{break-inside:avoid}}</style></head><body><header class="top"><div class="eyebrow">SGP ONE · Módulo de Mecanizado</div><div class="title-row"><div><h1>Pendientes de Bodega</h1><div class="line">Línea · Paneles 2</div></div><div class="generated"><b>Generado</b><br>'+escapeHtml(generated)+'</div></div></header><section class="summary"><div class="kpi"><span>Reservas</span><b>'+groups.length+'</b></div><div class="kpi"><span>Pendientes</span><b>'+total+'</b></div><div class="kpi green"><span>En tiempo</span><b>'+green+'</b></div><div class="kpi amber"><span>Seguimiento</span><b>'+amber+'</b></div><div class="kpi red"><span>Críticos</span><b>'+red+'</b></div></section>'+blocks+'<div class="legend"><span><i style="background:#22c55e"></i>En tiempo</span><span><i style="background:#f59e0b"></i>En seguimiento</span><span><i style="background:#ef4444"></i>Crítico</span></div><footer class="foot"><span>Solo reservas activas con pendientes · de la recepción más antigua a la más reciente</span><span>SGP ONE</span></footer><script>window.onload=()=>window.print()<\/script></body></html>');w.document.close()}
document.querySelector('#missingReceiveClose')?.addEventListener('click',closeMissingReceive);document.querySelector('#missingReceiveCancel')?.addEventListener('click',closeMissingReceive);document.querySelector('#missingReceiveSave')?.addEventListener('click',saveMissingReceive);document.querySelector('#generateMissingReport')?.addEventListener('click',generateMissingReport);
let progRows=[],progSchedule=[],progSelection=null,progCalendarAnchor=null;
const progGroupName={1:'OK / Entregadas en sistema',2:'Recibidas sin legalizar',3:'Pendientes por Bodega',4:'Pendientes por Abastecimiento'};
async function loadProgramming(){const c=await getSupabaseClient(),token=getAppToken();if(!token)return;const [a,b]=await Promise.all([c.rpc('sgp_mecanizado_disponibles',{p_token:token,p_semana:(Number(document.querySelector('#progWeek')?.value)||null)}),c.rpc('sgp_mecanizado_programacion_listar',{p_token:token})]);if(a.error||b.error){console.error(a.error||b.error);return}progRows=a.data||[];progSchedule=b.data||[];renderProgramming()}
function glassClass(p){p=Number(p||0);return p>=100?'good':p>=70?'mid':'low'}
function progDateISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function progWeekStart(value){const d=value?new Date(value+'T12:00:00'):new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d}
function progDayRowHtml(x){
 const row=progRows.find(r=>r.reserva===x.reserva),ord=x.produccion?(row?.ordenes||[]).find(o=>o.produccion===x.produccion):null;
 const part=x.prioridad_semanal?(row?.partes||[]).find(p=>String(p.prioridad)===String(x.prioridad_semanal)):null;
 let orders=x.produccion?(ord?[ord]:[]):(part?.ordenes||row?.ordenes||[]);
 const obs=[x.observacion?'<div><b>Observación general:</b> '+escapeHtml(x.observacion)+'</div>':'',x.observacion_orden?'<div><b>Observación de orden:</b> '+escapeHtml(x.observacion_orden)+'</div>':''].filter(Boolean).join('');
 const orderDetail=orders.length?'<div class="prog-orders-detail"><div class="prog-orders-title"><b>Órdenes programadas</b><span>'+orders.length+' orden'+(orders.length===1?'':'es')+'</span></div><div class="prog-orders-table-wrap"><table><thead><tr><th>Producción / orden</th><th>Tipo de vidrio</th><th>Ventanas</th><th>Vidrio</th></tr></thead><tbody>'+orders.map(o=>'<tr><td><b>'+escapeHtml(o.produccion||'—')+'</b></td><td><span class="glass-type-badge">'+escapeHtml(o.tipo_vidrio||'—')+'</span></td><td>'+Number(o.cantidad||0)+'</td><td><span class="glass-mini '+glassClass(o.vidrio_pct)+'"><b>'+Number(o.vidrio_pct||0).toFixed(0)+'%</b></span></td></tr>').join('')+'</tbody></table></div></div>':'<div class="prog-day-notes muted">No hay detalle de órdenes disponible.</div>';
 return '<details class="prog-day-item" data-prog-id="'+escapeHtml(x.id_programacion)+'"><summary><span class="prog-day-priority">'+escapeHtml(String(x.prioridad))+'</span><div><div class="prog-row-main"><b>'+escapeHtml(x.reserva)+'</b><small>'+(x.prioridad_semanal?'Parte '+escapeHtml(String(x.prioridad_semanal)):'Reserva / parte')+' · '+escapeHtml(x.turno||'')+'</small><span class="prog-row-system"><strong>'+escapeHtml(x.sistema||'—')+'</strong><em>'+escapeHtml(x.acabado||row?.acabado||'—')+'</em></span></div></div><strong>'+x.cantidad_programada+' <small>ventanas</small></strong><span class="glass-mini '+glassClass(x.porc_vidrio_snapshot)+'"><b>'+Number(x.porc_vidrio_snapshot||0).toFixed(0)+'%</b><small>vidrio</small></span><span class="prog-expand">⌄</span></summary><div class="prog-day-expanded"><div class="prog-detail-grid"><div><span>Sistema</span><b>'+escapeHtml(x.sistema||'—')+'</b></div><div><span>Acabado</span><b>'+escapeHtml(x.acabado||row?.acabado||'—')+'</b></div><div><span>Parte semanal</span><b>'+escapeHtml(x.prioridad_semanal||'—')+'</b></div><div><span>Producción / orden</span><b>'+escapeHtml(x.produccion||'Reserva completa')+'</b></div></div>'+orderDetail+(obs?'<div class="prog-day-notes">'+obs+'</div>':'<div class="prog-day-notes muted">Sin observaciones registradas.</div>')+'</div></details>'
}
async function saveProgDayOrder(date,turno){
 const ids=[...document.querySelectorAll('#progDayModal .prog-day-turn[data-turno="'+CSS.escape(turno)+'"] .prog-day-item')].map(x=>x.dataset.progId);
 const c=await getSupabaseClient(),{error}=await c.rpc('sgp_mecanizado_programacion_reordenar',{p_token:getAppToken(),p_ids:ids});
 if(error){alert(error.message);return false}await loadProgramming();openProgDay(date);return true
}
function buildProgReportHtml(date,arr){
 const total=arr.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),res=new Set(arr.map(x=>x.reserva)).size,sys={};arr.forEach(x=>sys[x.sistema||'SIN SISTEMA']=(sys[x.sistema||'SIN SISTEMA']||0)+Number(x.cantidad_programada||0));
 const turns=[...new Set(arr.map(x=>x.turno).filter(Boolean))];
 const rows=turns.map(t=>{const ta=arr.filter(x=>x.turno===t),tt=ta.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),ts={};ta.forEach(x=>ts[x.sistema||'SIN SISTEMA']=(ts[x.sistema||'SIN SISTEMA']||0)+Number(x.cantidad_programada||0));return '<section class="r-turn"><div class="r-turn-head"><div class="r-turn-name"><strong>'+escapeHtml(t)+'</strong><span>'+escapeHtml(shiftLabelForDate(date,t))+'</span></div><div class="r-turn-systems">'+Object.entries(ts).map(([s,n])=>'<em><strong>'+escapeHtml(s)+'</strong> '+n+' ventanas</em>').join('')+'</div><div class="r-turn-total"><b>'+tt+'</b><span>VENTANAS</span></div></div><div class="r-list">'+ta.map((x,i)=>'<div class="r-row"><span class="r-priority">'+(i+1)+'</span><div class="r-res"><b>'+escapeHtml(x.reserva||'')+'</b><small>Parte '+escapeHtml(x.prioridad_semanal||'—')+'</small></div><div class="r-info"><b>'+escapeHtml(x.sistema||'—')+'</b><span>'+escapeHtml(x.acabado||'—')+'</span></div><div class="r-qty"><b>'+Number(x.cantidad_programada||0)+'</b><span>ventanas</span></div><div class="r-glass '+(Number(x.porc_vidrio_snapshot||0)>=100?'ok':Number(x.porc_vidrio_snapshot||0)>=80?'warn':'bad')+'"><b>'+Number(x.porc_vidrio_snapshot||0).toFixed(0)+'%</b><span>vidrio</span></div></div>').join('')+'</div></section>'}).join('');
 return '<div class="r-page"><header><div class="r-brand"><div class="r-logo">SGP<span>ONE</span></div><div><small>PROGRAMACIÓN DE MECANIZADO</small><h1>'+escapeHtml(date)+'</h1><p>'+res+' reservas · '+total+' ventanas programadas</p></div></div><div class="r-date">PLAN DIARIO<br><b>'+new Date(date+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'</b></div></header><div class="r-summary">'+Object.entries(sys).map(([s,n])=>'<div class="r-system"><span>'+escapeHtml(s)+'</span><b>'+n+'</b><small>ventanas</small></div>').join('')+'<div class="r-total"><span>TOTAL DÍA</span><b>'+total+'</b><small>VENTANAS</small></div></div>'+rows+'<footer><b>SGP ONE</b><span>Programación oficial de Mecanizado · Generado '+new Date().toLocaleString('es-CO')+'</span></footer></div>';
}
function progReportDocument(date,arr){return '<!doctype html><html><head><meta charset="utf-8"><title>Programación Mecanizado '+date+'</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{margin:0;padding:0;background:#e8edf4;font-family:Arial,sans-serif;color:#10233d}.r-page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:11mm 12mm 10mm}header{background:#174f87;color:#fff;border-radius:13px;padding:17px 19px;display:flex;align-items:center;justify-content:space-between}.r-brand{display:flex;align-items:center;gap:15px}.r-logo{width:55px;height:55px;border:2px solid rgba(255,255,255,.55);border-radius:12px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-weight:900;font-size:17px;line-height:15px}.r-logo span{font-size:11px}.r-brand small{font-size:8px;font-weight:800;letter-spacing:.7px;color:#cfe1f6}.r-brand h1{font-size:25px;margin:3px 0 1px}.r-brand p{font-size:9px;margin:0;color:#d9e8f7}.r-date{text-align:right;font-size:8px;color:#cfe1f6;line-height:1.5;max-width:185px}.r-date b{font-size:10px;color:#fff;text-transform:capitalize}.r-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:11px 0 14px}.r-summary>div{border:1px solid #cbdced;border-radius:11px;padding:10px 12px;background:#f8fbff}.r-summary span,.r-summary small{display:block;font-size:8px;font-weight:700;color:#5d7188}.r-summary b{display:block;font-size:24px;color:#174f87;margin:2px 0}.r-summary .r-total{background:#123f73;border-color:#123f73}.r-summary .r-total span,.r-summary .r-total small{color:#d9e8f7}.r-summary .r-total b{color:#fff;font-size:28px}.r-turn{border:1px solid #c9daeb;border-radius:12px;overflow:hidden;margin:0 0 11px;break-inside:avoid}.r-turn-head{display:flex;align-items:center;gap:10px;background:#eaf1f8;padding:8px 10px;border-bottom:1px solid #d5e1ed}.r-turn-name{min-width:105px}.r-turn-name strong{display:block;font-size:14px;color:#102f50}.r-turn-name span{font-size:8px;color:#657a91}.r-turn-systems{display:flex;gap:5px;flex:1;flex-wrap:wrap}.r-turn-systems em{font-style:normal;background:#fff;border:1px solid #bcd1e5;border-radius:14px;padding:4px 8px;font-size:8px;color:#425c76}.r-turn-systems em strong{color:#174f87}.r-turn-total{background:#174f87;color:#fff;border-radius:8px;padding:6px 12px;text-align:center;min-width:74px}.r-turn-total b{display:block;font-size:16px}.r-turn-total span{font-size:7px;font-weight:800}.r-row{display:grid;grid-template-columns:28px 1.25fr 2fr .65fr .6fr;align-items:center;min-height:42px;padding:6px 9px;border-bottom:1px solid #e2e9f1}.r-row:last-child{border-bottom:0}.r-priority{width:21px;height:21px;border-radius:50%;background:#e5f0ff;color:#1258a3;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900}.r-res b,.r-info b,.r-qty b,.r-glass b{display:block;font-size:10px}.r-res small,.r-info span,.r-qty span,.r-glass span{display:block;font-size:7px;color:#687b90;margin-top:2px}.r-info b{color:#174f87}.r-qty,.r-glass{text-align:right}.r-qty b{font-size:12px}.r-glass b{font-size:12px}.ok b{color:#07843f}.warn b{color:#c45e00}.bad b{color:#df2020}footer{margin-top:14px;padding-top:8px;border-top:1px solid #ccd9e7;display:flex;justify-content:space-between;font-size:7px;color:#6b7c8e}footer b{color:#174f87}@media print{html,body{background:#fff}.r-page{margin:0;width:210mm;min-height:297mm;box-shadow:none}}@media screen{.r-page{margin:18px auto;box-shadow:0 10px 35px rgba(17,40,70,.2)}}</style></head><body>'+buildProgReportHtml(date,arr)+'<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>'}
function generateProgPdf(date,arr){const w=window.open('','_blank');if(!w)return alert('El navegador bloqueó la ventana del reporte. Permite ventanas emergentes para SGP ONE.');w.document.open();w.document.write(progReportDocument(date,arr));w.document.close()}
function generateProgImage(date,arr){const w=window.open('','_blank');if(!w)return alert('El navegador bloqueó la vista del reporte.');w.document.open();w.document.write(progReportDocument(date,arr).replace('<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script>',''));w.document.close();alert('Se abrió el reporte limpio. En móvil puedes usar Compartir/Captura de página completa; en escritorio puedes imprimirlo como PDF o capturarlo como imagen.')}
function openProgDay(date){
 const arr=progSchedule.filter(x=>x.fecha_programacion===date&&x.estado!=='CANCELADA').sort((a,b)=>String(a.turno).localeCompare(String(b.turno))||Number(a.prioridad)-Number(b.prioridad)||String(a.fecha_creacion).localeCompare(String(b.fecha_creacion)));
 const sys={};arr.forEach(x=>sys[x.sistema||'SIN SISTEMA']=(sys[x.sistema||'SIN SISTEMA']||0)+Number(x.cantidad_programada||0));
 let m=document.querySelector('#progDayModal');if(!m){m=document.createElement('div');m.id='progDayModal';m.className='rec-overlay prog-day-overlay';document.body.appendChild(m)}
 const total=arr.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),res=new Set(arr.map(x=>x.reserva)).size,turnos=[...new Set(arr.map(x=>x.turno).filter(Boolean))];
 m.innerHTML='<div class="prog-day-card"><div class="prog-day-head"><div><small>PROGRAMACIÓN DE MECANIZADO</small><strong>'+date+'</strong><span>'+res+' reservas · '+total+' ventanas</span></div><div class="prog-report-actions"><button type="button" data-report-pdf>PDF</button><button type="button" data-report-image>Imagen</button><button type="button" class="modal-close" data-close-day>×</button></div></div><div class="prog-day-systems">'+Object.entries(sys).map(([s,n])=>'<div><span>'+escapeHtml(s)+'</span><b>'+n+'</b><small>ventanas</small></div>').join('')+'<div class="prog-day-total"><span>TOTAL DÍA</span><b>'+total+'</b><small>ventanas</small></div></div><div class="prog-day-detail">'+(arr.length?turnos.map(t=>{const ta=arr.filter(x=>x.turno===t),ts={};ta.forEach(x=>{const k=x.sistema||'SIN SISTEMA';ts[k]=(ts[k]||0)+Number(x.cantidad_programada||0)});const tt=ta.reduce((n,x)=>n+Number(x.cantidad_programada||0),0);return '<section class="prog-day-turn" data-turno="'+escapeHtml(t)+'"><div class="prog-turn-head"><div class="prog-turn-title"><b>'+escapeHtml(t)+'</b><span class="prog-turn-total">'+tt+' ventanas</span><div class="prog-turn-systems">'+Object.entries(ts).map(([s,n])=>'<span><strong>'+escapeHtml(s)+'</strong><b>'+n+' ventanas</b></span>').join('')+'</div></div><span>Arrastre las filas para cambiar el orden de prioridad</span></div>'+ta.map(progDayRowHtml).join('')+'</section>'}).join(''):'<div class="empty-state">No hay programación para este día.</div>')+'</div></div>';
 m.hidden=false;m.querySelector('[data-close-day]').onclick=()=>m.hidden=true;m.querySelector('[data-report-pdf]')?.addEventListener('click',()=>generateProgPdf(date,arr));m.querySelector('[data-report-image]')?.addEventListener('click',()=>generateProgImage(date,arr));m.onclick=e=>{if(e.target===m)m.hidden=true};
 m.querySelectorAll('.prog-day-item').forEach(el=>{el.draggable=true;el.addEventListener('dragstart',e=>{el.classList.add('dragging');e.dataTransfer.effectAllowed='move'});el.addEventListener('dragend',()=>el.classList.remove('dragging'))});
 m.querySelectorAll('.prog-day-turn').forEach(zone=>{zone.addEventListener('dragover',e=>{e.preventDefault();const dragging=m.querySelector('.dragging');if(!dragging||dragging.closest('.prog-day-turn')!==zone)return;const after=[...zone.querySelectorAll('.prog-day-item:not(.dragging)')].find(x=>e.clientY<x.getBoundingClientRect().top+x.offsetHeight/2);after?zone.insertBefore(dragging,after):zone.appendChild(dragging)});zone.addEventListener('drop',async e=>{e.preventDefault();await saveProgDayOrder(date,zone.dataset.turno)})})
}
function renderProgCalendar(){
 const host=document.querySelector('#progAgenda');if(!host)return;
 const active=progSchedule.filter(x=>x.estado!=='CANCELADA');
 if(!progCalendarAnchor){const dates=active.map(x=>x.fecha_programacion).filter(Boolean).sort();progCalendarAnchor=dates[0]||progDateISO(new Date())}
 const monday=progWeekStart(progCalendarAnchor),days=[];for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);days.push(d)}
 const end=days[6],names=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
 const sysWeek={};active.filter(x=>{const dt=new Date(x.fecha_programacion+'T12:00:00');return dt>=monday&&dt<=end}).forEach(x=>sysWeek[x.sistema||'SIN SISTEMA']=(sysWeek[x.sistema||'SIN SISTEMA']||0)+Number(x.cantidad_programada||0));
 host.innerHTML='<section class="prog-calendar"><div class="prog-calendar-head"><div><b>Calendario semanal</b><span>'+progDateISO(monday)+' al '+progDateISO(end)+'</span></div><div class="prog-calendar-nav"><button type="button" data-cal-prev>‹</button><button type="button" data-cal-today>Hoy</button><button type="button" data-cal-next>›</button></div></div><div class="prog-week-summary">'+Object.entries(sysWeek).map(([s,n])=>'<span>'+escapeHtml(s)+' <b>'+n+'</b></span>').join('')+'</div><div class="prog-calendar-grid">'+days.map((d,i)=>{const iso=progDateISO(d),arr=active.filter(x=>x.fecha_programacion===iso),total=arr.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),systems=[...new Set(arr.map(x=>x.sistema).filter(Boolean))];return '<button type="button" class="prog-cal-day '+(arr.length?'has-program':'')+'" data-cal-day="'+iso+'"><span>'+names[i]+'</span><b>'+d.getDate()+'</b><small>'+arr.length+' prog.</small><strong>'+total+' ventanas</strong><em>'+systems.slice(0,2).map(escapeHtml).join(' · ')+'</em></button>'}).join('')+'</div></section>';
 host.querySelector('[data-cal-prev]').onclick=()=>{const d=progWeekStart(progCalendarAnchor);d.setDate(d.getDate()-7);progCalendarAnchor=progDateISO(d);renderProgCalendar()};
 host.querySelector('[data-cal-next]').onclick=()=>{const d=progWeekStart(progCalendarAnchor);d.setDate(d.getDate()+7);progCalendarAnchor=progDateISO(d);renderProgCalendar()};
 host.querySelector('[data-cal-today]').onclick=()=>{progCalendarAnchor=progDateISO(new Date());renderProgCalendar()};
 host.querySelectorAll('[data-cal-day]').forEach(b=>b.onclick=()=>openProgDay(b.dataset.calDay))
}
function renderProgramming(){
 const programmedFor=(res,prod=null)=>progSchedule.filter(x=>x.estado!=='CANCELADA'&&x.reserva===res&&(!prod||x.produccion===prod)).reduce((n,x)=>n+Number(x.cantidad_programada||0),0);
 const wk=document.querySelector('#progWeek');if(wk&&!wk.dataset.ready){const weeks=[...new Set(progRows.map(r=>Number(r.semana)).filter(Boolean))].sort((a,b)=>b-a);wk.innerHTML='<option value="">Todas las semanas</option>'+weeks.map(w=>'<option value="'+w+'">Semana '+w+'</option>').join('');wk.dataset.ready='1'}
 const q=(document.querySelector('#progSearch')?.value||'').toLowerCase(),rows=progRows.filter(r=>!q||[r.reserva,r.sistema,r.acabado,JSON.stringify(r.ordenes)].join(' ').toLowerCase().includes(q));
 const enriched=rows.map(r=>{const done=programmedFor(r.reserva),left=Math.max(0,Number(r.cantidad)-done);return {...r,_done:done,_left:left,_progress:Number(r.cantidad)?Math.min(100,done/Number(r.cantidad)*100):0}});
 const complete=enriched.filter(r=>r._left<=0&&r._done>0),pending=enriched.filter(r=>r._left>0);
 document.querySelector('#progAvailable').textContent=pending.length;document.querySelector('#progScheduled').textContent=new Set(progSchedule.filter(x=>x.estado!=='CANCELADA').map(x=>x.reserva)).size;document.querySelector('#progWindows').textContent=progSchedule.filter(x=>x.estado!=='CANCELADA').reduce((a,x)=>a+Number(x.cantidad_programada||0),0);document.querySelector('#progGlassAvg').textContent=(rows.length?rows.reduce((a,x)=>a+Number(x.vidrio_pct||0),0)/rows.length:0).toFixed(0)+'%';
 const card=r=>'<details class="prog-res '+(r._done?'prog-res-partial':'')+'"><summary><div><b>'+escapeHtml(r.reserva)+'</b><span>'+escapeHtml(r.sistema||'')+' · '+escapeHtml(r.acabado||'')+' · '+r.cantidad+' ventanas</span><span class="prog-balance"><b>'+r._done+' programadas</b> · '+r._left+' sin programar</span><span class="prog-progress"><i style="width:'+r._progress+'%"></i></span></div><button type="button" data-prog-res="'+escapeHtml(r.reserva)+'" data-prog-qty="'+r._left+'">'+(r._done?'Continuar':'Programar')+'</button><div class="glass-mini '+glassClass(r.vidrio_pct)+'"><b>'+Number(r.vidrio_pct||0).toFixed(0)+'%</b><span>Vidrio '+r.vidrio_cant+'/'+r.cantidad+'</span></div></summary><div class="prog-orders">'+(r.ordenes||[]).map(o=>{const op=programmedFor(r.reserva,o.produccion),orem=Math.max(0,Number(o.cantidad)-op);return '<div class="prog-order"><div><b>'+escapeHtml(o.produccion||'Orden')+'</b><span>'+o.cantidad+' ventanas · <strong class="'+(orem===0?'done-text':'pending-text')+'">'+op+' programadas · '+orem+' pendientes</strong></span></div><div class="glass-mini '+glassClass(o.vidrio_pct)+'"><b>'+Number(o.vidrio_pct||0).toFixed(0)+'%</b><span>'+Number(o.vidrio_cant||0)+'/'+o.cantidad+'</span></div><button type="button" data-prog-order="'+escapeHtml(r.reserva)+'" data-prod="'+escapeHtml(o.produccion||'')+'" data-prog-qty="'+orem+'" '+(orem<=0?'disabled':'')+'>'+(orem<=0?'Programada':'Programar orden')+'</button></div>'}).join('')+'</div></details>';
 document.querySelector('#progPool').innerHTML=[1,2,3,4].map(g=>{const rr=pending.filter(x=>Number(x.grupo)===g);return '<section class="prog-group"><div class="prog-group-title"><b>'+progGroupName[g]+'</b><span>'+rr.length+'</span></div>'+(rr.length?rr.map(card).join(''):'<div class="empty-state">Sin reservas en esta condición.</div>')+'</section>'}).join('')+'<section class="prog-group prog-complete-group"><div class="prog-group-title"><b>✓ Reservas completamente programadas</b><span>'+complete.length+'</span></div>'+(complete.length?complete.map(r=>'<details class="prog-res prog-res-complete"><summary><div><b>'+escapeHtml(r.reserva)+'</b><span>'+escapeHtml(r.sistema||'')+' · '+escapeHtml(r.acabado||'')+' · '+r.cantidad+' ventanas</span><span class="prog-balance"><b>'+r._done+' programadas</b> · 0 pendientes</span><span class="prog-progress"><i style="width:100%"></i></span></div><span class="prog-done-badge">PROGRAMADA</span><div class="glass-mini '+glassClass(r.vidrio_pct)+'"><b>'+Number(r.vidrio_pct||0).toFixed(0)+'%</b><span>Vidrio '+r.vidrio_cant+'/'+r.cantidad+'</span></div></summary></details>').join(''):'<div class="empty-state">Aún no hay reservas completamente programadas.</div>')+'</section>';
 renderProgCalendar();
 document.querySelectorAll('[data-prog-res],[data-prog-order]').forEach(b=>b.onclick=e=>{e.preventDefault();if(Number(b.dataset.progQty||0)<=0)return;openProgModal(b.dataset.progRes||b.dataset.progOrder,b.dataset.prod||null,Number(b.dataset.progQty||1))})
}
function renderProgParts(parts,produccion){
 let host=document.querySelector('#progPartsBox');if(!host)return;
 if(produccion||!parts.length){host.hidden=true;host.innerHTML='';return}
 const glassSummary=p=>{const g={};(p.ordenes||[]).forEach(o=>{const types=String(o.tipo_vidrio||'—').split('/').map(x=>x.trim()).filter(Boolean);types.forEach(t=>g[t]=(g[t]||0)+Number(o.cantidad||0))});return Object.entries(g).map(([t,n])=>'<span class="part-glass-chip"><b>'+escapeHtml(t)+'</b><strong>'+n+' und</strong></span>').join('')};
 const partProgrammed=p=>progSchedule.filter(x=>x.reserva===progSelection?.reserva&&String(x.prioridad_semanal||'')===String(p.prioridad)&&x.estado!=='CANCELADA').reduce((n,x)=>n+Number(x.cantidad_programada||0),0);
 host.hidden=false;host.innerHTML='<label>Parte / prioridad semanal</label><div class="prog-part-list">'+parts.map(p=>{const done=partProgrammed(p),left=Math.max(0,Number(p.cantidad)-done);return '<details class="prog-part '+(left<=0?'prog-part-done':done>0?'prog-part-partial':'')+'"><summary><label class="prog-part-choice"><input type="radio" name="progPartChoice" value="'+escapeHtml(p.prioridad)+'" '+(left<=0?'disabled':'')+'><span class="part-radio-ui"></span><span class="part-main"><b>Parte '+escapeHtml(p.prioridad)+'</b>'+(left<=0?'<em class="part-status-badge">✓ PROGRAMADA</em>':done>0?'<em class="part-status-badge partial">PARCIAL</em>':'')+'<span>'+p.cantidad+' ventanas · <strong class="'+(left===0?'done-text':'pending-text')+'">'+done+' programadas · '+left+' pendientes</strong> · Vidrio '+Number(p.vidrio_pct||0).toFixed(0)+'%</span><span class="part-glass-summary">'+glassSummary(p)+'</span></span></label></summary><div class="prog-part-orders">'+(p.ordenes||[]).map(o=>'<div><b>'+escapeHtml(o.produccion||'Orden')+'</b><span>'+o.cantidad+' ventanas · <strong class="glass-type-inline">Vidrio: '+escapeHtml(o.tipo_vidrio||'—')+'</strong> · '+Number(o.vidrio_pct||0).toFixed(0)+'%</span><textarea data-part-order="'+escapeHtml(o.produccion||'')+'" placeholder="Comentario específico de esta orden (opcional)"></textarea></div>').join('')+'</div></details>'}).join('')+'</div>';
 host.querySelectorAll('input[name="progPartChoice"]').forEach(r=>r.onchange=()=>{const p=parts.find(x=>String(x.prioridad)===r.value);if(!p)return;const done=partProgrammed(p),left=Math.max(0,Number(p.cantidad)-done);progSelection.part=p;progSelection.maxQty=left;document.querySelector('#progQty').value=left;document.querySelector('#progQty').readOnly=true});
}

function openProgModal(reserva,produccion,qty){if(qty<=0)return;const row=progRows.find(x=>x.reserva===reserva),parts=row?.partes||[];progSelection={reserva,produccion,maxQty:qty,part:null};document.querySelector('#progModalTitle').textContent='Programar '+reserva;document.querySelector('#progModalMeta').textContent=produccion||'Reserva / cantidad parcial';document.querySelector('#progShift').value='TURNO 1';document.querySelector('#progPriority').value=Math.max(0,...progSchedule.filter(x=>x.estado!=='CANCELADA'&&x.fecha_programacion===new Date().toISOString().slice(0,10)&&x.turno==='TURNO 1').map(x=>Number(x.prioridad)||0))+1;document.querySelector('#progObs').value='';document.querySelector('#progOrderObs').value='';document.querySelector('#progQty').readOnly=false;renderProgParts(parts,produccion);document.querySelector('#progQty').value=qty;document.querySelector('#progDate').value=new Date().toISOString().slice(0,10);const recalcPriority=()=>{const d=document.querySelector('#progDate').value,t=document.querySelector('#progShift').value;document.querySelector('#progPriority').value=Math.max(0,...progSchedule.filter(x=>x.estado!=='CANCELADA'&&x.fecha_programacion===d&&x.turno===t).map(x=>Number(x.prioridad)||0))+1};document.querySelector('#progDate').onchange=recalcPriority;document.querySelector('#progShift').onchange=recalcPriority;recalcPriority();document.querySelector('#progModal').hidden=false}
function closeProgModal(){document.querySelector('#progModal').hidden=true;document.querySelector('#progQty').readOnly=false;progSelection=null}
async function saveProgramming(){if(!progSelection)return;const args={p_token:getAppToken(),p_reserva:progSelection.reserva,p_produccion:progSelection.produccion,p_cantidad:Number(document.querySelector('#progQty').value),p_fecha:document.querySelector('#progDate').value,p_turno:document.querySelector('#progShift').value,p_prioridad:Number(document.querySelector('#progPriority').value),p_prioridad_semanal:progSelection.part?String(progSelection.part.prioridad):null,p_observacion:document.querySelector('#progObs').value,p_observacion_orden:[document.querySelector('#progOrderObs').value,...[...document.querySelectorAll('#progPartsBox textarea')].filter(x=>x.value.trim()).map(x=>x.dataset.partOrder+': '+x.value.trim())].filter(Boolean).join(' | ')};if(!args.p_fecha||!args.p_cantidad){alert('Complete fecha y cantidad.');return}if(args.p_cantidad>progSelection.maxQty){alert('Solo quedan '+progSelection.maxQty+' ventanas pendientes por programar.');return}const c=await getSupabaseClient();let {error}=await c.rpc('sgp_mecanizado_programar',args);if(error&&/schema cache|Could not find the function/i.test(error.message||'')){await new Promise(r=>setTimeout(r,700));({error}=await c.rpc('sgp_mecanizado_programar',args))}if(error){alert(error.message);return}closeProgModal();await loadProgramming()}
document.querySelector('#progRefresh')?.addEventListener('click',loadProgramming);document.querySelector('#progWeek')?.addEventListener('change',loadProgramming);document.querySelector('#progSearch')?.addEventListener('input',renderProgramming);document.querySelector('#progModalClose')?.addEventListener('click',closeProgModal);document.querySelector('#progCancel')?.addEventListener('click',closeProgModal);document.querySelector('#progSave')?.addEventListener('click',saveProgramming);

document.querySelectorAll('[data-mach-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mach-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-mach-panel]').forEach(x=>x.hidden=x.dataset.machPanel!==b.dataset.machTab);if(b.dataset.machTab==='recepcion')loadReception();if(b.dataset.machTab==='faltantes')loadMissing();if(b.dataset.machTab==='programacion')loadProgramming()});
document.querySelectorAll('input[name="recCompleteChoice"]').forEach(x=>x.addEventListener('change',()=>{const incomplete=x.checked&&x.value==='NO';document.querySelector('#recMissingSection').hidden=!incomplete;if(incomplete&&recMissingDraft.length===0){recMissingDraft.push({perfil:'',cantidad:1,longitud:'',observacion:''});renderMissingEditor()}if(!incomplete){recMissingDraft=[];renderMissingEditor()}}));
document.querySelector('#recRefresh')?.addEventListener('click',loadReception);document.querySelector('#recSearch')?.addEventListener('input',renderReception);document.querySelector('#addMissing')?.addEventListener('click',()=>{recMissingDraft.push({perfil:'',cantidad:1,longitud:'',observacion:''});const no=document.querySelector('input[name="recCompleteChoice"][value="NO"]');if(no)no.checked=true;document.querySelector('#recMissingSection').hidden=false;renderMissingEditor()});document.querySelector('#recClose')?.addEventListener('click',()=>document.querySelector('#recModal').hidden=true);document.querySelector('#recCancel')?.addEventListener('click',()=>document.querySelector('#recModal').hidden=true);document.querySelector('#recSave')?.addEventListener('click',saveReception);

document.querySelector('#saveShiftConfig')?.addEventListener('click',async()=>{const v={lunes_sabado:{turno1:{inicio:document.querySelector('#cfgWeekT1Start').value,fin:document.querySelector('#cfgWeekT1End').value},turno2:{inicio:document.querySelector('#cfgWeekT2Start').value,fin:document.querySelector('#cfgWeekT2End').value}},domingo:{turno1:{inicio:document.querySelector('#cfgSunT1Start').value,fin:document.querySelector('#cfgSunT1End').value},turno2:{inicio:document.querySelector('#cfgSunT2Start').value,fin:document.querySelector('#cfgSunT2End').value}}};try{const c=await getSupabaseClient(),{error}=await c.rpc('sgp_configuracion_general_guardar',{p_token:getAppToken(),p_clave:'HORARIOS_TURNOS',p_valor:v});if(error)throw error;sgpGeneralConfig.HORARIOS_TURNOS=v;alert('Horarios guardados correctamente')}catch(e){alert('No fue posible guardar los horarios: '+(e?.message||e))}});

let prodRows=[],prodNoveltyTarget=null,prodNoveltyProduction=null;
const PROD_STATES=['PROGRAMADA','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'];
const noveltyTypes={PROVEEDOR:['Detalle de proveedor'],BODEGA:['Detalle del perfil','Error de acabado','Medida errada'],MECANIZADO_PERSONAL:['Daño de pieza por personal'],MECANIZADO_MAQUINA:['Daño de pieza por máquina'],INGENIERIA:['XML no disponible','Error de fabricación','Información / plano','Otro'],CALIDAD:['Novedad de calidad','Liberación / definición','Otro']};
function prodStateClass(s){return 'state-'+String(s||'PROGRAMADA').toLowerCase()}
async function loadProductionBoard(){
 const date=document.querySelector('#prodDate')?.value,shift=document.querySelector('#prodShift')?.value;if(!date)return;
 try{const db=await getSupabaseClient();let q=db.from('sgp_mecanizado_programacion').select('*').eq('fecha_programacion',date).neq('estado','CANCELADA').order('turno').order('prioridad');if(shift)q=q.eq('turno',shift);const {data,error}=await q;if(error)throw error;let carry=[];const shifts=shift?[shift]:[...new Set((data||[]).map(x=>x.turno))];for(const st of shifts){const cr=await db.rpc('sgp_mecanizado_pendientes_turno',{p_token:getAppToken(),p_fecha:date,p_turno:st});if(!cr.error)carry.push(...(cr.data||[]).map(o=>({...o,_targetShift:st})))}const ids=(data||[]).map(x=>x.id_programacion);let ex=[],nov=[];if(ids.length){const er=await db.from('sgp_mecanizado_ejecucion').select('*').in('id_programacion',ids);if(!er.error)ex=er.data||[];const nr=await db.from('sgp_mecanizado_novedades').select('*').in('id_programacion',ids);if(!nr.error)nov=nr.data||[]}prodRows=(data||[]).map(x=>({...x,ejecucion:ex.find(e=>e.id_programacion===x.id_programacion),novedades:nov.filter(n=>n.id_programacion===x.id_programacion)}));if(carry.length){const grouped=new Map();carry.forEach(o=>{const k=o._targetShift+'|'+o.id_programacion_origen;let g=grouped.get(k);if(!g){g={id_programacion:'carry-'+o._targetShift.replaceAll(' ','-')+'-'+o.id_programacion_origen,reserva:o.reserva,prioridad_semanal:o.prioridad_semanal,sistema:o.sistema,acabado:o.acabado,cantidad_programada:0,turno:o._targetShift,prioridad:-1,_carry:true,_carryOrders:[],ejecucion:{estado:o.estado},novedades:[]};grouped.set(k,g)}g.cantidad_programada+=Number(o.cantidad||0);g._carryOrders.push(o)});prodRows=[...grouped.values(),...prodRows]}renderProductionBoard()}catch(e){console.error(e);document.querySelector('#prodBoard').innerHTML='<div class="empty-state"><strong>No fue posible cargar producción</strong><p>'+escapeHtml(e.message||String(e))+'</p></div>'}
}
function prodWeekCalendarHtml(){const selected=document.querySelector('#prodDate')?.value||progDateISO(new Date()),start=progWeekStart(selected),names=['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];let h='';for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=progDateISO(d);h+='<button type="button" data-prod-day="'+iso+'" class="'+(iso===selected?'active':'')+'"><small>'+names[i]+'</small><b>'+d.getDate()+'</b><span>'+d.toLocaleDateString('es-CO',{month:'short'}).replace('.','')+'</span></button>'}return '<div class="prod-week"><button type="button" class="prod-week-nav" data-prod-week-prev>‹</button><div class="prod-week-days">'+h+'</div><button type="button" class="prod-week-nav" data-prod-week-next>›</button></div>'}function bindProdWeek(){const root=document.querySelector('#prodWeekCalendar');if(!root)return;root.querySelectorAll('[data-prod-day]').forEach(b=>b.onclick=()=>{document.querySelector('#prodDate').value=b.dataset.prodDay;loadProductionBoard()});const move=n=>{const d=new Date(document.querySelector('#prodDate').value+'T12:00:00');d.setDate(d.getDate()+n);document.querySelector('#prodDate').value=progDateISO(d);loadProductionBoard()};root.querySelector('[data-prod-week-prev]')?.addEventListener('click',()=>move(-7));root.querySelector('[data-prod-week-next]')?.addEventListener('click',()=>move(7))}
function renderProductionBoard(){
 const host=document.querySelector('#prodBoard'),sum=document.querySelector('#prodSummary'),cal=document.querySelector('#prodWeekCalendar');if(!host)return;if(cal){cal.innerHTML=prodWeekCalendarHtml();bindProdWeek()}const total=prodRows.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),processed=prodRows.filter(x=>(x.ejecucion?.estado||'CORTE')==='PROCESADO').reduce((n,x)=>n+Number(x.cantidad_programada||0),0),nov=prodRows.reduce((n,x)=>n+x.novedades.length,0);
 sum.innerHTML='<div><span>Programadas</span><b>'+total+'</b></div><div><span>Procesadas</span><b>'+processed+'</b></div><div><span>Novedades</span><b>'+nov+'</b></div><div><span>Cumplimiento</span><b>'+(total?Math.round(processed/total*100):0)+'%</b></div>';
 if(!prodRows.length){host.innerHTML='<div class="empty-state"><strong>Sin programación</strong><p>No hay reservas programadas para los filtros seleccionados.</p></div>';return}
 const turns=[...new Set(prodRows.map(x=>x.turno))];host.innerHTML=turns.map(t=>{const tr=prodRows.filter(x=>x.turno===t),carryRows=tr.filter(x=>x._carry),regular=tr.filter(x=>!x._carry),carryOrders=carryRows.flatMap(x=>x._carryOrders||[]);const pending=carryOrders.length?'<div class="prod-prev-pending"><div class="prod-prev-title"><b>Pendientes del turno anterior</b><span>'+carryOrders.length+' producciones · '+carryOrders.reduce((n,o)=>n+Number(o.cantidad||0),0)+' ventanas</span></div>'+carryOrders.map(o=>'<div class="prod-prev-order"><b>'+escapeHtml(o.produccion||'—')+'</b><span>'+escapeHtml(o.proyecto||'')+'</span><em>'+escapeHtml(o.estado||'PROGRAMADA')+'</em></div>').join('')+'</div>':'<div class="prod-prev-pending empty"><b>Pendientes del turno anterior</b><span>Sin producciones pendientes</span></div>';return '<section class="prod-turn" data-prod-turn="'+escapeHtml(t)+'"><button type="button" class="prod-turn-head" data-turn-focus="'+escapeHtml(t)+'"><div><b>'+escapeHtml(t)+'</b><span>'+escapeHtml(shiftLabelForDate(document.querySelector('#prodDate').value,t))+'</span></div><div class="prod-turn-head-actions"><strong>'+regular.reduce((n,x)=>n+Number(x.cantidad_programada||0),0)+' ventanas</strong><span class="prod-focus-icon">⛶</span></div></button>'+pending+regular.map((x,i)=>{const st=x.ejecucion?.estado||'PROGRAMADA';return '<article class="prod-job '+(x._carry?'prod-carryover':'')+'"><div class="prod-job-main"><span class="prod-priority">'+(i+1)+'</span><div class="prod-job-id"><b>'+escapeHtml(x.reserva)+'</b><span>Parte '+escapeHtml(x.prioridad_semanal||'—')+' · '+escapeHtml(x.sistema||'—')+' · '+escapeHtml(x.acabado||'—')+'</span></div><div class="prod-job-qty"><b>'+Number(x.cantidad_programada||0)+'</b><span>ventanas</span></div><span class="prod-state '+prodStateClass(st)+'">'+st+'</span><button class="prod-expand" data-prod-expand="'+x.id_programacion+'">⌄</button></div><div class="prod-job-detail" data-prod-detail="'+x.id_programacion+'" hidden><div class="prod-orders-exec"><div class="prod-orders-exec-head"><b>Detalle de órdenes</b><span>Reserva / parte programada</span></div><div class="prod-order-source" data-prod-orders="'+x.id_programacion+'"></div></div><div class="prod-state-picker">'+PROD_STATES.map(s=>'<button data-prod-state="'+s+'" data-prod-id="'+x.id_programacion+'" class="'+prodStateClass(s)+' '+(st===s?'selected':'')+'">'+s+'</button>').join('')+'</div><label>Observaciones del líder<textarea data-prod-obs="'+x.id_programacion+'" placeholder="Observaciones operativas…">'+escapeHtml(x.ejecucion?.observacion||'')+'</textarea></label><div class="prod-actions"><button data-prod-novelty="'+x.id_programacion+'">+ Reportar novedad</button><button class="primary" data-prod-save="'+x.id_programacion+'">Guardar</button></div><div class="prod-nov-list">'+(x.novedades.length?x.novedades.map(n=>'<div><b>'+escapeHtml(n.origen.replaceAll('_',' '))+'</b><span>'+escapeHtml(n.tipo||'')+'</span><em>'+escapeHtml(n.estado||'ABIERTA')+'</em></div>').join(''):'<small>Sin novedades reportadas.</small>')+'</div></div></article>'}).join('')+'</section>'}).join('');
 host.querySelectorAll('[data-prod-orders]').forEach(async el=>{const x=prodRows.find(r=>r.id_programacion===el.dataset.prodOrders);try{const db=await getSupabaseClient();let orders=[],states=[];if(x?._carry){orders=x._carryOrders.map(o=>({produccion:o.produccion,proyecto:o.proyecto,tipo:o.tipo,cantidad:o.cantidad,vidrio_preparado:0,vidrio_novedad:0,vidrio_traslado:0}));states=x._carryOrders.map(o=>({produccion:o.produccion,estado:o.estado,id_programacion:o.id_programacion_origen,_carry:true}))}else{const [dr,er]=await Promise.all([db.rpc('sgp_mecanizado_detalle_reserva',{p_token:getAppToken(),p_reserva:String(x?.reserva||''),p_parte:String(x?.prioridad_semanal||'')}),db.from('sgp_mecanizado_ejecucion_orden').select('*').eq('id_programacion',x.id_programacion)]);if(dr.error)throw dr.error;states=er.error?[]:(er.data||[]);orders=dr.data||[]}el.innerHTML=orders.length?'<div class="prod-order-table-head"><span>Orden / proyecto</span><span>Ventanas</span><span>Vidrio</span><span>Estado</span></div>'+orders.map(o=>{const oe=states.find(e=>String(e.produccion)===String(o.produccion)),os=oe?.estado||(x.ejecucion?.estado||'PROGRAMADA'),tipo=String(o.tipo||'').trim();return '<div class="prod-order-line prod-order-exec-row"><div><b>'+escapeHtml(o.produccion||'—')+'</b><span>'+escapeHtml(o.proyecto||o.cliente||'')+(tipo?' · '+escapeHtml(tipo.toUpperCase()):'')+'</span></div><strong>'+Number(o.cantidad||0)+'</strong><div class="prod-glass-counts"><span class="glass-prep">Prep. <b>'+Number(o.vidrio_preparado||0)+'</b></span><span class="glass-nov">Nov. <b>'+Number(o.vidrio_novedad||0)+'</b></span><span class="glass-move">Trasl. <b>'+Number(o.vidrio_traslado||0)+'</b></span></div><select class="prod-order-state '+prodStateClass(os)+'" data-order-state data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">'+PROD_STATES.map(s=>'<option value="'+s+'" '+(s===os?'selected':'')+'>'+s+'</option>').join('')+'</select><div class="prod-order-followup"><textarea data-order-obs placeholder="Observación de esta orden…">'+escapeHtml(oe?.observacion||'')+'</textarea><div><button type="button" data-order-novelty data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">+ Novedad</button><button type="button" class="primary" data-order-save data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">Guardar orden</button></div></div></div>'}).join(''):'<div class="prod-order-empty">No hay órdenes asociadas a esta parte.</div>';el.querySelectorAll('[data-order-state]').forEach(s=>s.onchange=async()=>{s.className='prod-order-state '+prodStateClass(s.value);const {error}=await db.rpc('sgp_mecanizado_guardar_estado_orden',{p_token:getAppToken(),p_id_programacion:s.dataset.prodId,p_produccion:s.dataset.production,p_estado:s.value,p_observacion:null});if(error)alert('No fue posible cambiar el estado de la orden: '+error.message)});el.querySelectorAll('[data-order-save]').forEach(b=>b.onclick=async()=>{const row=b.closest('.prod-order-exec-row'),state=row.querySelector('[data-order-state]').value,observacion=row.querySelector('[data-order-obs]').value;const {error}=await db.rpc('sgp_mecanizado_guardar_estado_orden',{p_token:getAppToken(),p_id_programacion:b.dataset.prodId,p_produccion:b.dataset.production,p_estado:state,p_observacion:observacion});if(error)return alert('No fue posible guardar la orden: '+error.message);b.textContent='Guardado ✓';setTimeout(()=>b.textContent='Guardar orden',1200)});el.querySelectorAll('[data-order-novelty]').forEach(b=>b.onclick=()=>openProductionNovelty(b.dataset.prodId,b.dataset.production))}catch(e){el.innerHTML='<div class="prod-order-empty">No fue posible cargar las órdenes: '+escapeHtml(e.message||String(e))+'</div>'}});
 host.querySelectorAll('[data-turn-focus]').forEach(b=>b.onclick=()=>{const sec=b.closest('.prod-turn'),focused=host.classList.contains('prod-turn-focused')&&sec.classList.contains('focused');host.classList.toggle('prod-turn-focused',!focused);host.querySelectorAll('.prod-turn').forEach(x=>x.classList.toggle('focused',!focused&&x===sec));b.querySelector('.prod-focus-icon').textContent=focused?'⛶':'✕'});
 host.querySelectorAll('[data-prod-expand]').forEach(b=>b.onclick=()=>{const d=host.querySelector('[data-prod-detail="'+b.dataset.prodExpand+'"]');d.hidden=!d.hidden;b.textContent=d.hidden?'⌄':'⌃'});
 host.querySelectorAll('[data-prod-state]').forEach(b=>b.onclick=()=>{const root=b.closest('.prod-state-picker');root.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
 host.querySelectorAll('[data-prod-save]').forEach(b=>{if(String(b.dataset.prodSave).startsWith('carry-'))b.hidden=true;else b.onclick=()=>saveProductionExecution(b.dataset.prodSave)});
 host.querySelectorAll('[data-prod-novelty]').forEach(b=>b.onclick=()=>openProductionNovelty(b.dataset.prodNovelty));
}
async function saveProductionExecution(id){const row=prodRows.find(x=>x.id_programacion===id),detail=document.querySelector('[data-prod-detail="'+id+'"]'),state=detail.querySelector('.prod-state-picker .selected')?.dataset.prodState||'PROGRAMADA',obs=detail.querySelector('[data-prod-obs]').value;try{const db=await getSupabaseClient(),{error}=await db.from('sgp_mecanizado_ejecucion').upsert({id_programacion:id,estado:state,cantidad_procesada:state==='PROCESADO'?Number(row.cantidad_programada||0):0,observacion:obs,usuario:currentAuth?.usuario||'',actualizado_en:new Date().toISOString()},{onConflict:'id_programacion'});if(error)throw error;await loadProductionBoard()}catch(e){alert('No fue posible guardar: '+e.message)}}
async function openProductionNovelty(id,production=null){prodNoveltyTarget=id;prodNoveltyProduction=production;const r=prodRows.find(x=>x.id_programacion===id);document.querySelector('#prodNoveltyContext').textContent=(r?.reserva||'')+' · Parte '+(r?.prioridad_semanal||'—')+(production?' · Orden '+production:'');document.querySelector('#prodNoveltyModal').hidden=false;document.querySelector('#prodNoveltyOrigin').value='';document.querySelector('#prodNoveltyOrigin').dispatchEvent(new Event('change'));const inp=document.querySelector('#prodNoveltyProfile'),dl=document.querySelector('#prodProfileCatalog'),len=document.querySelector('#prodNoveltyLength');inp.value='';len.value='';let timer;const search=async()=>{try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_mecanizado_perfiles_reserva',{p_token:getAppToken(),p_reserva:String(r?.reserva||''),p_buscar:inp.value.trim()});if(error)throw error;dl.innerHTML=(data||[]).map(p=>'<option value="'+escapeHtml(p.perfil)+'" data-length="'+escapeHtml(p.longitud??'')+'">'+escapeHtml(p.descripcion||'')+' · '+escapeHtml(p.longitud??'—')+' pulg</option>').join('')}catch(e){dl.innerHTML=''}};inp.oninput=()=>{clearTimeout(timer);timer=setTimeout(search,180)};inp.onchange=()=>{const opt=[...dl.options].find(o=>o.value===inp.value);if(opt?.dataset.length)len.value=opt.dataset.length};await search()}
document.querySelector('#prodNoveltyOrigin')?.addEventListener('change',e=>{const o=e.target.value,t=document.querySelector('#prodNoveltyType'),lab=document.querySelector('#prodNoveltyRefLabel');t.innerHTML='<option value="">Seleccionar…</option>'+((noveltyTypes[o]||[]).map(x=>'<option>'+x+'</option>').join(''));lab.firstChild.textContent=o==='MECANIZADO_MAQUINA'?'Ticket mantenimiento ':['INGENIERIA','CALIDAD'].includes(o)?'Número de novedad ':'Número de NC ';});
document.querySelector('#prodNoveltySave')?.addEventListener('click',async()=>{const o=document.querySelector('#prodNoveltyOrigin').value,t=document.querySelector('#prodNoveltyType').value,ref=document.querySelector('#prodNoveltyRef').value.trim();if(!o||!t)return alert('Selecciona origen y tipo de novedad.');if((o==='MECANIZADO_PERSONAL'||o==='MECANIZADO_MAQUINA'||o==='INGENIERIA'||o==='CALIDAD')&&!ref)return alert('Debes suministrar '+(o==='MECANIZADO_MAQUINA'?'el ticket de mantenimiento':o==='MECANIZADO_PERSONAL'?'el número de NC':'el número de novedad')+'.');const payload={id_programacion:prodNoveltyTarget,produccion:prodNoveltyProduction||null,origen:o,tipo:t,perfil:document.querySelector('#prodNoveltyProfile').value,longitud:Number(document.querySelector('#prodNoveltyLength').value)||null,cantidad:Number(document.querySelector('#prodNoveltyQty').value)||null,cortes_afectados:document.querySelector('#prodNoveltyCuts').value,observacion:document.querySelector('#prodNoveltyObs').value,usuario:currentAuth?.usuario||'',estado:ref?'REPORTADA':'PENDIENTE_RESOLVER'};if(o==='MECANIZADO_MAQUINA')payload.ticket_mtto=ref;else if(['INGENIERIA','CALIDAD'].includes(o))payload.numero_novedad=ref;else payload.numero_nc=ref;try{const db=await getSupabaseClient(),{error}=await db.from('sgp_mecanizado_novedades').insert(payload);if(error)throw error;document.querySelector('#prodNoveltyModal').hidden=true;await loadProductionBoard()}catch(e){alert('No fue posible guardar la novedad: '+e.message)}});
document.querySelector('#prodRefresh')?.addEventListener('click',loadProductionBoard);document.querySelector('#prodNoveltyClose')?.addEventListener('click',()=>document.querySelector('#prodNoveltyModal').hidden=true);document.querySelector('#prodNoveltyCancel')?.addEventListener('click',()=>document.querySelector('#prodNoveltyModal').hidden=true);
if(document.querySelector('#prodDate'))document.querySelector('#prodDate').value=new Date().toISOString().slice(0,10);
