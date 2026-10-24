import { initPieceMasterUI, showMissingPieceMaster, configurePieceMasterUI } from "./src/ui/piece-master-admin.js";
import { initPickingDeliveryReport } from "./src/modules/picking-delivery-report-controller.js";
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
import { filterGlassRowsByWeek, indexGlassProductionWeeks, weeksWithGlass } from "./src/domain/glass-week-filter.js";
import { buildGlassRelationGraph, traceGlassRelations, summarizeGlassBurro } from "./src/domain/glass-relations-graph.js";
import { buildGlassNodeInsights, glassCoverage, glassRackBreakdown } from "./src/domain/glass-explorer-insights.js";
import { consolidatePieceReferences } from "./src/domain/piece-detail-views.js";
import { mergeCarryOrdersWithGlass, glassCountLabel } from "./src/domain/carry-glass.js";
import { indexReceptionAluminumStates, receptionAluminumStateMeta } from "./src/domain/reception-aluminum-state.js";
import { initFilePickers } from "./src/ui/file-picker.js";
import { attachReceptionWeeks, receptionWeekOptions, filterReceptionRows, normalizeReceptionWeek } from "./src/domain/picking-reception-weeks.js";
import { comparePriority, priorityDepth, groupPriorityRows, splitPriorityPart, validatePriorityAssignments, hasScheduledPriority } from "./src/domain/priority-hierarchy.js";
import { readNcAluminumWorkbook } from "./src/domain/nc-aluminum-importer.js?v=73";
import { readNcGlassWorkbook } from "./src/domain/nc-glass-importer.js?v=84";

const mecanizado = createMecanizadoModule(trackingRows);
// UI exclusivamente visual: mantiene los inputs nativos y sus validaciones.
initFilePickers(document);
initPieceMasterUI();
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
// Publicar únicamente un puente de consulta para el Planificador; no exponer credenciales.
window.SGPPlannerBridge={getRows:()=>assemblyRows,getToken:()=>getAppToken(),getClient:()=>getSupabaseClient(),loadAssembly:()=>loadAssembly()};
let queriedSystemSummary = [];
let detailSort = { key: null, dir: 1 };
let currentPieceRows=[];let currentPieceView='summary';let currentPieceContext='order';let pieceDetailColumns=['perfil','marca','fabricacion','longitud','cantidad','descripcion'];
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

let sharedReservationRows=[],sharedReservationLoadedAt=0;
function setSharedReservationRows(rows){sharedReservationRows=Array.isArray(rows)?rows:[];sharedReservationLoadedAt=Date.now()}
async function ensureSharedReservations(force=false){
 if(!force&&sharedReservationRows.length&&Date.now()-sharedReservationLoadedAt<60000)return sharedReservationRows;
 const token=getAppToken?.()||sessionStorage.getItem(APP_SESSION_KEY);if(!token)return [];
 try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_reservas_asociadas_listar',{p_token:token,p_semana:null,p_linea:'PANELES_2'});if(error)throw error;setSharedReservationRows(data||[])}catch(e){console.warn('Reservas asociadas:',e)}
 return sharedReservationRows
}
function sharedMetaForOrder(order,principal=null){
 const key=order?.key_produccion||order?.key||null,prod=String(order?.produccion||'');
 if(key){const m=sharedReservationRows.find(x=>String(x.key_produccion)===String(key));if(m)return m}
 const exact=sharedReservationRows.filter(x=>String(x.produccion||'')===prod&&(!principal||String(x.reserva_principal||'')===String(principal)));
 return exact.length===1?exact[0]:exact.find(x=>String(x.reserva_principal||'')===String(principal||''))||null
}
function sharedRowsFromMeta(meta){return Array.isArray(meta?.reservas)?meta.reservas:[]}
function isSharedMeta(meta){return Boolean(meta?.es_reserva_compartida)||sharedRowsFromMeta(meta).some(r=>Boolean(r.es_principal_compartida))}
function reserveRelationLabel(r){return r?.tipo==='PRINCIPAL'?'Principal':r?.es_principal_compartida?'Compartida':'Asociada'}
function sharedBadgeHtml(meta){return meta&&isSharedMeta(meta)?'<span class="shared-reserve-badge">⚠ RESERVA COMPARTIDA</span>':''}
function sharedDetailsHtml(meta){
 const rr=sharedRowsFromMeta(meta);if(!isSharedMeta(meta)||rr.length<=1)return '';
 return '<details class="shared-reserve-details"><summary>Ver reservas y acabados</summary><div>'+rr.map(r=>'<span class="shared-reserve-chip '+(r.tipo==='PRINCIPAL'?'principal':'secondary')+'"><b>'+escapeHtml(r.reserva||'—')+'</b><em>'+escapeHtml(reserveRelationLabel(r))+'</em><small>'+escapeHtml(r.acabado||'ACABADO POR CONFIRMAR')+(r.semana?' · SEM '+escapeHtml(r.semana):'')+'</small></span>').join('')+'</div></details>'
}
function sharedIncomingForReserve(reserva){
 const r=String(reserva||'');if(!r)return [];
 return sharedReservationRows.filter(x=>isSharedMeta(x)&&sharedRowsFromMeta(x).some(z=>z.es_principal_compartida&&String(z.reserva)===r))
}
function sharedPrimaryForReserve(reserva){
 const r=String(reserva||'');if(!r)return [];
 return sharedReservationRows.filter(x=>isSharedMeta(x)&&String(x.reserva_principal||'')===r)
}
function sharedReserveNoticeHtml(reserva){
 const primary=sharedPrimaryForReserve(reserva),incoming=sharedIncomingForReserve(reserva);
 if(!primary.length&&!incoming.length)return '';
 const bits=[];if(primary.length)bits.push(primary.length+' orden'+(primary.length===1?'':'es')+' de esta reserva usa'+(primary.length===1?'':'n')+' material compartido');
 if(incoming.length)bits.push(incoming.length+' orden'+(incoming.length===1?'':'es')+' de otra reserva requiere'+(incoming.length===1?'':'n')+' material de esta reserva');
 return '<div class="shared-reserve-notice"><b>⚠ RESERVA COMPARTIDA</b><span>'+escapeHtml(bits.join(' · '))+'</span>'+incoming.slice(0,4).map(x=>'<small>Para '+escapeHtml(x.produccion||'—')+' · principal '+escapeHtml(x.reserva_principal||'—')+'</small>').join('')+'</div>'
}
function sharedMetaFromEmbedded(row,principal=null){
 const rr=Array.isArray(row?.reservas_compartidas)?row.reservas_compartidas:[];
 if(rr.length>1)return {key_produccion:row?.key_produccion||row?.key||null,produccion:row?.produccion||'',reserva_principal:principal||rr.find(x=>x.tipo==='PRINCIPAL')?.reserva||'',es_reserva_compartida:Boolean(row?.reserva_compartida)||rr.some(x=>Boolean(x.es_principal_compartida)),reservas:rr};
 return sharedMetaForOrder(row,principal)
}
function sharedReserveOptions(meta,fallbackReserva='',fallbackAcabado=''){
 const rr=sharedRowsFromMeta(meta);
 const list=rr.length?rr:[{reserva:fallbackReserva,tipo:'PRINCIPAL',acabado:fallbackAcabado||null,es_principal_compartida:false}];
 return list.map(r=>({reserva:String(r.reserva||''),acabado:String(r.acabado||''),tipo:r.tipo||'ASOCIADA',es_principal_compartida:Boolean(r.es_principal_compartida)})).filter(x=>x.reserva)
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
let weeklyCommitInProgress = false;
let weeklyCommitNeedsVerification = false;
function refreshWeeklyPackageGate() {
  const status = weeklyPackageStatus();
  const token = sessionStorage.getItem(APP_SESSION_KEY);
  els.commit.disabled = weeklyCommitInProgress || weeklyCommitNeedsVerification || !(status.ready && token);
  els.commit.textContent = weeklyCommitInProgress ? "Carga en proceso…" : weeklyCommitNeedsVerification ? "Verificar semana antes de reintentar" : status.ready ? (token ? "Cargar semana" : "Inicia sesión para cargar") : "Carga final bloqueada";
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
    if (error) {
      console.warn("Error temporal validando sesión SGP:", error);
      els.authStatus.textContent = "Reintentando sesión…";
      return null;
    }
    if (!data?.valida) {
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
 {key:'mecanizado',label:'Módulo de Mecanizado',children:[
   ['mecanizado.recepcion','Recepción'],
   ['mecanizado.faltantes','Pendientes de material'],
   ['mecanizado.programacion','Programación'],
   ['mecanizado.proceso','Producción'],
   ['mecanizado.novedades','Novedades']
 ]},
 {key:'picking',label:'Picking',children:[
   ['picking.entrega','Entrega de órdenes'],
   ['picking.recepcion','Recepción / Auditoría']
 ]},
 {key:'programacion',label:'Programación semanal'},
 {key:'ensamble',label:'Ensamble',children:[
   ['ensamble.hoja','Hoja de ensamble'],
   ['ensamble.ubicaciones','Reporte de ubicaciones']
 ]},
 {key:'nc-aluminio',label:'NC Aluminio'},
 {key:'nc-vidrio',label:'NC Vidrio'},
 {key:'seguimiento-aluminio',label:'Seguimiento de aluminio'},
 {key:'pendientes-aluminio',label:'Pendientes de aluminio'},
 {key:'carga-semanal',label:'Carga semanal'},
 {key:'informes',label:'Informes'},
 {key:'actualizacion',label:'Actualización diaria',children:[
   ['actualizacion.export','Export diario'],
   ['actualizacion.glass-location','Ubicación de vidrio'],
   ['actualizacion.nc-al','NC Aluminio'],
   ['actualizacion.nc-glass','NC Vidrio'],
   ['actualizacion.al-track','Seguimiento de aluminio']
 ]},
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
   document.querySelectorAll('[data-mach-tab]').forEach(b=>{const key='mecanizado.'+b.dataset.machTab;const legacy=b.dataset.machTab==='proceso'&&access.includes('mecanizado.produccion');b.hidden=!(access.includes('mecanizado')||access.includes(key)||legacy)});
   document.querySelectorAll('[data-daily-tab]').forEach(b=>{const key='actualizacion.'+b.dataset.dailyTab;b.hidden=!(access.includes('actualizacion')||access.includes(key))});
   const pickDelivery=document.querySelector('#pickDeliveryTab'),pickReception=document.querySelector('#pickReceptionTab');
   if(pickDelivery)pickDelivery.hidden=!(access.includes('picking')||access.includes('picking.entrega'));
   if(pickReception)pickReception.hidden=!(access.includes('picking')||access.includes('picking.recepcion'));
   const assemblySheet=document.querySelector('#assemblySheetTab'),assemblyLocations=document.querySelector('#assemblyLocationReportTab');
   if(assemblySheet)assemblySheet.hidden=!(access.includes('ensamble')||access.includes('ensamble.hoja'));
   if(assemblyLocations)assemblyLocations.hidden=!(access.includes('ensamble')||access.includes('ensamble.ubicaciones'));
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
 try{const result=await readAluminumTrackingWorkbook(file);if(result.errors.length)throw new Error(result.errors.length+" error(es) en el archivo");aluminumTrackingRows=result.rows;const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_previsualizar_seguimiento_aluminio",{p_token:token,p_datos:aluminumTrackingRows});if(error)throw error;if(els.aluminumFile.files?.[0]!==file)return;aluminumTrackingPreview={...data,file:file.name};els.aTotal.textContent=data.recibidos||0;const sum=summarizeAluminumTracking(aluminumTrackingRows);if(els.aSupply)els.aSupply.textContent=sum.states.PENDIENTE_ABASTECIMIENTO||0;if(els.aWarehouse)els.aWarehouse.textContent=sum.states.PENDIENTE_BODEGA||0;els.aDelivered.textContent=sum.states.ALUMINIO_ENTREGADO||0;els.aluminumStatus.textContent="Validación completada · "+(data.reservas||0)+" reservas · "+(data.producciones||0)+" producciones · "+(data.nuevas_relaciones||0)+" relaciones Reserva + ID nuevas · Semanas: "+Object.entries(data.por_semana||{}).map(([w,n])=>w+": "+n).join(" · ")+" · No se ha escrito información.";els.applyAluminumTracking.disabled=false}catch(error){els.aluminumStatus.textContent="Validación bloqueada: "+error.message}finally{els.validateAluminum.disabled=false}
}
async function applyAluminumTracking(){
 if(!aluminumTrackingPreview)return;els.applyAluminumTracking.disabled=true;els.aluminumStatus.textContent="Aplicando seguimiento…";
 try{const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_aplicar_seguimiento_aluminio",{p_token:token,p_nombre_archivo:aluminumTrackingPreview.file,p_datos:aluminumTrackingRows});if(error)throw error;els.aluminumStatus.textContent=`Seguimiento actualizado ✓ · ${data.nuevas_relaciones} relaciones Reserva + ID nuevas · ${data.relaciones_existentes} existentes · ${data.cambios} cambios de estado/semana`}catch(error){els.aluminumStatus.textContent="Aplicación rechazada ✕ "+error.message;els.applyAluminumTracking.disabled=false}
}

configurePieceMasterUI({getToken:()=>getAppToken?.()||sessionStorage.getItem(APP_SESSION_KEY),onMasterSaved:async()=>{await validatePiecesFile();}});
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
    if (classification.unclassified.length) showMissingPieceMaster(classification.unclassified);
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
  return queriedProductions.filter(r=>(!line||r.id_linea===line)&&(!term||[r.id,r.reserva_principal,r.reserva_al,r.produccion,r.sistema,r.proyecto,r.cliente,r.acabado,JSON.stringify(r.reservas_compartidas||[])].some(v=>String(v??"").toLowerCase().includes(term))));
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
    const system=r.sistema||'SIN SISTEMA',reserva=String(r.reserva_principal??r.reserva_al??'').trim()||'SIN RESERVA',acabado=r.acabado||'SIN ACABADO',qty=Number(r.cantidad||0),hm=hasMuntin(r);
    if(!systems.has(system))systems.set(system,{sistema:system,reservas:new Set(),producciones:0,unidades:0,prodMuntin:0,unidMuntin:0});
    const sg=systems.get(system);sg.reservas.add(reserva);sg.producciones++;sg.unidades+=qty;if(hm){sg.prodMuntin++;sg.unidMuntin+=qty}
    if(!types.has(system))types.set(system,{sistema:system,proyecto:0,retail:0});
    const tg=types.get(system),tipo=String(r.tipo||'').toUpperCase();if(tipo==='PROYECTO')tg.proyecto+=qty;if(tipo==='RETAIL')tg.retail+=qty;
    const rk=reserva+'|'+system+'|'+acabado;if(!reservations.has(rk))reservations.set(rk,{reserva,sistema:system,acabado,producciones:0,unidades:0,prodMuntin:0,unidMuntin:0});
    const rg=reservations.get(rk);rg.producciones++;rg.unidades+=qty;if(hm){rg.prodMuntin++;rg.unidMuntin+=qty}
  });
  const summary=[...systems.values()].sort((x,y)=>y.unidades-x.unidades);
  els.systemSummaryBody.innerHTML=summary.map(g=>`<tr class="${g.prodMuntin?'has-muntin-summary':''}"><td><strong>${escapeHtml(g.sistema)}</strong></td><td>${g.reservas.size}</td><td>${g.producciones}</td><td><strong>${g.unidades}</strong></td><td>${g.prodMuntin}</td><td>${g.unidMuntin}</td></tr>`).join('');
  els.systemSummaryFoot.innerHTML=`<tr><td>TOTAL</td><td>${new Set(baseRows.map(r=>String(r.reserva_principal??r.reserva_al??'').trim()||'SIN RESERVA')).size}</td><td>${baseRows.length}</td><td>${units}</td><td>${baseRows.filter(hasMuntin).length}</td><td>${baseRows.filter(hasMuntin).reduce((n,r)=>n+Number(r.cantidad||0),0)}</td></tr>`;
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
  els.queryBody.innerHTML=rows.length?rows.map(r=>{const reserva=String(r.reserva_principal??r.reserva_al??'').trim()||'SIN RESERVA',meta=sharedMetaFromEmbedded(r,reserva),firstReserva=reserva!==prev;if(firstReserva){idx++;prev=reserva}const hm=hasMuntin(r),shared=isSharedMeta(meta);
    return `<tr class="${idx%2===0?'reservation-alt':''} ${hm?'has-muntin':''} ${shared?'shared-row':''}">${detailColumns.filter(c=>!detailHidden.has(c.key)).map(c=>{let v=detailValue(r,c.key);if(c.key==='reserva_al')return `<td><button class="piece-link" data-piece-mode="reserva" data-piece-value="${escapeHtml(reserva)}">${escapeHtml(reserva)}</button>${shared?'<div class="shared-cell-note">'+sharedBadgeHtml(meta)+sharedDetailsHtml(meta)+'</div>':''}</td>`;if(c.key==='produccion')return `<td><button class="piece-link" data-piece-mode="produccion" data-piece-value="${escapeHtml(r.produccion)}">${escapeHtml(r.produccion)}</button></td>`;if(c.key==='muntin')v=hm?'SÍ · '+(r.cantidad_muntin??r.cantidad??''):'—';return `<td>${escapeHtml(v||'—')}</td>`}).join('')}</tr>`;
  }).join(''):`<tr><td colspan="${detailColumns.filter(c=>!detailHidden.has(c.key)).length}" class="empty">No hay registros con los filtros seleccionados.</td></tr>`;
}
function basePieceDescription(s){
  return String(s||'').replace(/\s+[A-Z]$/i,'').trim();
}
function renderPieceModal(){
  const src=currentPieceRows;
  const pieceTable=els.pieceProfileHead?.closest('table');
  if(pieceTable)pieceTable.dataset.pieceView=currentPieceView;
  document.querySelectorAll('[data-piece-view]').forEach(b=>{
    const view=b.dataset.pieceView;
    b.hidden=(view==='pickorders'&&currentPieceContext!=='picking-part')
      ||(view==='references'&&!['picking-part','query-reserva'].includes(currentPieceContext));
    b.classList.toggle('active',b.dataset.pieceView===currentPieceView);
    b.setAttribute('aria-pressed',String(b.dataset.pieceView===currentPieceView));
  });
  els.pieceDetailedOptions.hidden=currentPieceView!=='detailed';
  if(currentPieceView==='pickorders'){renderPickingPartPieces();return;}
  if(currentPieceView==='references'){
    const rows=consolidatePieceReferences(src);
    els.pieceProfileHead.innerHTML='<tr><th>Referencia</th><th>Cantidad</th></tr>';
    els.pieceProfileBody.innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${escapeHtml(x.perfil)}</strong></td><td class="num"><strong>${escapeHtml(x.cantidad)}</strong></td></tr>`).join(''):'<tr><td colspan="2" class="empty">Sin referencias disponibles.</td></tr>';
    els.pieceProfileFoot.innerHTML=`<tr><td><strong>TOTAL</strong></td><td class="num"><strong>${escapeHtml(rows.reduce((n,x)=>n+x.cantidad,0))}</strong></td></tr>`;
    return;
  }
  if(currentPieceView==='summary'){
    const map=new Map();src.forEach(r=>{const k=r.codigo_sap;if(!map.has(k))map.set(k,{perfil:k,descripcion:basePieceDescription(r.descripcion),cantidad:0});map.get(k).cantidad+=Number(r.cantidad||0)});
    const rows=[...map.values()].sort((x,y)=>String(x.perfil).localeCompare(String(y.perfil),undefined,{numeric:true}));
    els.pieceProfileHead.innerHTML='<tr><th>Perfil</th><th>Cantidad</th><th>Descripción</th></tr>';
    els.pieceProfileBody.innerHTML=rows.map(x=>`<tr><td><strong>${escapeHtml(x.perfil)}</strong></td><td class="num"><strong>${x.cantidad}</strong></td><td>${escapeHtml(x.descripcion)}</td></tr>`).join('');
    els.pieceProfileFoot.innerHTML=`<tr><td>TOTAL</td><td class="num">${rows.reduce((n,x)=>n+x.cantidad,0)}</td><td></td></tr>`;return;
  }
  if(currentPieceView==='expanded'){
    const map=new Map();src.forEach(r=>{const k=[r.codigo_sap,r.marca].join('|');if(!map.has(k))map.set(k,{perfil:r.codigo_sap,descripcion:basePieceDescription(r.descripcion),marca:r.marca||'—',cantidad:0});map.get(k).cantidad+=Number(r.cantidad||0)});
    const rows=[...map.values()].sort((x,y)=>String(x.perfil).localeCompare(String(y.perfil),undefined,{numeric:true})||String(x.marca).localeCompare(String(y.marca),undefined,{numeric:true}));
    els.pieceProfileHead.innerHTML='<tr><th>Perfil</th><th>Marca</th><th>Cantidad</th><th>Descripción</th></tr>';
    els.pieceProfileBody.innerHTML=rows.map(x=>`<tr><td><strong>${escapeHtml(x.perfil)}</strong></td><td>${escapeHtml(x.marca)}</td><td class="num"><strong>${x.cantidad}</strong></td><td>${escapeHtml(x.descripcion)}</td></tr>`).join('');
    els.pieceProfileFoot.innerHTML=`<tr><td>TOTAL</td><td></td><td class="num">${rows.reduce((n,x)=>n+x.cantidad,0)}</td><td></td></tr>`;return;
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
  currentPieceContext=mode==='reserva'?'query-reserva':'order';currentPieceRows=[];currentPieceView='summary';
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
    queriedProductions=data?.producciones || []; queriedSystemSummary=data?.resumen_sistemas || [];await ensureSharedReservations();
    els.qWeek.textContent=`${week} / ${year}`;
    els.queryStatus.textContent=queriedProductions.length ? `Semana ${week} cargada desde Supabase ✓ · ${queriedProductions.length} producciones.` : `No hay programación almacenada para la semana ${week} / ${year}.`;
    renderQueriedProgramming();
  } catch(error) { queriedProductions=[]; els.queryStatus.textContent="No fue posible consultar: "+error.message; renderQueriedProgramming(); }
  finally { els.queryProgramming.disabled=false; }
}



const assemblyDefaultColumns=[["semana_actual","Sem."],["prioridad","Prioridad"],["id","ID"],["produccion","Producción"],["reserva_compartida","Reserva compartida"],["sistema","Sistema"],["cantidad","Cant."],["ensamblado","Ensamblado"],["saldo_ensamble","Saldo Ens."],["estado_produccion","Estado"],["estado_mecanizado","Estado Mec."],["observacion_mecanizado","Obs. Mecanizado"],["pendientes_mecanizado","PDT Mecanizado"],["porc_vidrio","% Vidrio"],["tipo_vidrio","Tipo vidrio"],["medidas","Tamaños"],["ubicacion_vidrio","Ubicación vidrio"],["reserva_al","Reserva"],["estado_reserva_al","Estado reserva"],["acabado","Acabado"],["orden_oves","OVES"]];
let assemblyHidden=new Set(JSON.parse(localStorage.getItem("sgp_assembly_hidden_cols")||"[]"));
function assemblyColumns(){const keys=new Set(assemblyDefaultColumns.map(c=>c[0])),extra=[],internal=new Set(['reservas_compartidas']);assemblyRows.forEach(r=>Object.keys(r||{}).forEach(k=>{if(!keys.has(k)&&!internal.has(k)){keys.add(k);extra.push([k,k.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase())])}}));return [...assemblyDefaultColumns,...extra]}
function renderAssemblyPicker(){const b=document.querySelector("#assemblyColumnPicker");if(!b)return;const cols=assemblyColumns();b.innerHTML='<div class="nc-column-picker-grid">'+cols.map(c=>'<label><input type="checkbox" data-acol="'+escapeHtml(c[0])+'" '+(assemblyHidden.has(c[0])?'':'checked')+'> '+escapeHtml(c[1])+'</label>').join("")+'</div>';b.querySelectorAll("[data-acol]").forEach(x=>x.onchange=()=>{x.checked?assemblyHidden.delete(x.dataset.acol):assemblyHidden.add(x.dataset.acol);localStorage.setItem("sgp_assembly_hidden_cols",JSON.stringify([...assemblyHidden]));renderAssembly()})}
document.querySelector("#assemblyChooseColumns")?.addEventListener("click",()=>{const b=document.querySelector("#assemblyColumnPicker");if(!b)return;b.hidden=!b.hidden;if(!b.hidden)renderAssemblyPicker()});
let assemblyColumnFilters={},assemblySort={key:null,dir:1};let assemblyColumnOrder=JSON.parse(localStorage.getItem('sgp_assembly_col_order')||'[]');
function renderAssembly(){if(!els.assemblyBody)return;const q=String(els.assemblySearch?.value||"").trim().toLowerCase(),state=els.assemblyState?.value||"";let rows=assemblyRows.filter(r=>(!state||r.estado_produccion===state)&&(!q||Object.values(r).some(v=>String(v??"").toLowerCase().includes(q))));rows=rows.filter(r=>Object.entries(assemblyColumnFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(String(r[k]??""))));if(assemblySort.key)rows=[...rows].sort((a,b)=>(assemblySort.key==="prioridad"?comparePriority(a.prioridad,b.prioridad):String(a[assemblySort.key]??"").localeCompare(String(b[assemblySort.key]??""),undefined,{numeric:true}))*assemblySort.dir);else rows=[...rows].sort((a,b)=>Number(a.semana_actual??a.semana_base??0)-Number(b.semana_actual??b.semana_base??0)||comparePriority(a.prioridad,b.prioridad)||String(a.id??"").localeCompare(String(b.id??""),undefined,{numeric:true}));const n=v=>Number(v??0),pct=v=>v==null?"—":(n(v)<=1?Math.round(n(v)*100):Math.round(n(v)))+"%";els.asTotal.textContent=rows.length;els.asBalance.textContent=rows.reduce((a,r)=>a+n(r.saldo_ensamble),0);els.asOpen.textContent=rows.filter(r=>r.estado_produccion==="ABIERTA").length;els.asClosed.textContent=rows.filter(r=>r.estado_produccion==="CERRADA").length;els.asAssembled.textContent=rows.filter(r=>r.estado_produccion==="ENSAMBLADA").length;let cols=assemblyColumns().filter(c=>!assemblyHidden.has(c[0]));if(assemblyColumnOrder.length){const pos=new Map(assemblyColumnOrder.map((k,i)=>[k,i]));cols=[...cols].sort((a,b)=>(pos.has(a[0])?pos.get(a[0]):9999)-(pos.has(b[0])?pos.get(b[0]):9999))}const head=document.querySelector("#assemblyHead");if(head){head.innerHTML="<tr>"+cols.map(c=>'<th data-col-key="'+escapeHtml(c[0])+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+escapeHtml(c[0])+'"><span>'+escapeHtml(c[1])+(assemblySort.key===c[0]?(assemblySort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join("")+"</tr>";bindSheetFilters(document.querySelector("#assemblyTable"),()=>assemblyRows,cols.map(c=>({key:c[0],label:c[1]})),assemblyColumnFilters,(k,dir)=>{assemblySort={key:k,dir};renderAssembly()},()=>renderAssembly())}els.assemblyBody.innerHTML=rows.length?rows.map(r=>"<tr>"+cols.map(c=>{let v=c[0]==="porc_vidrio"?pct(r[c[0]]):(c[0]==="semana_actual"?(r.semana_actual??r.semana_base):(r[c[0]]??"—"));if(c[0]==="prioridad"&&priorityDepth(v)===3)return '<td><span class="priority-level3-chip" title="Tercer nivel de prioridad">'+escapeHtml(v)+'</span></td>';if(c[0]==="reserva_compartida"){const meta=sharedMetaFromEmbedded(r,r.reservas_compartidas?.find?.(x=>x.tipo==='PRINCIPAL')?.reserva||null);return '<td class="assembly-shared-cell">'+(r.reserva_compartida&&meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'—')+'</td>'}if(c[0]==="ubicacion_vidrio"&&r.key_produccion&&v&&v!=="—")return '<td><button class="glass-location-link" data-glass-key="'+escapeHtml(r.key_produccion)+'" data-glass-id="'+escapeHtml(r.id||"")+'">'+escapeHtml(v)+"</button></td>";if(c[0]==="pendientes_mecanizado"&&v&&v!=="—")return '<td><span class="assembly-pdt '+(r.pdt_por_validar?'repo-validation-wait':(r.pdt_repo_ok?'repo-ready':'repo-wait'))+'">'+escapeHtml(v)+(r.pdt_por_validar?' · POR VALIDAR':'')+'</span></td>';if(c[0]==="estado_mecanizado"&&v&&v!=="—")return '<td><span class="prod-state '+prodStateClass(v)+'">'+escapeHtml(v)+'</span></td>';if(c[0]==="produccion"&&r.reserva_compartida){const meta=sharedMetaFromEmbedded(r,r.reservas_compartidas?.find?.(x=>x.tipo==='PRINCIPAL')?.reserva||null);return '<td><b>'+escapeHtml(v)+'</b>'+(meta?sharedBadgeHtml(meta):'')+'</td>'}return "<td>"+escapeHtml(v)+"</td>"}).join("")+"</tr>").join(""):'<tr><td colspan="'+Math.max(cols.length,1)+'" class="empty">No hay órdenes con estos filtros.</td></tr>';els.assemblyBody.querySelectorAll("[data-glass-key]").forEach(b=>b.onclick=()=>openGlassDetail(b.dataset.glassKey,b.dataset.glassId));enableDraggableColumns(document.querySelector("#assemblyTable"))}
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
// LAB v294: análisis de dispersión de vidrio, exclusivamente lectura.
let glassEfficiencyRows=[];
let glassWeekByProduction=new Map();
// LAB v306: semana efectiva de la producción. Los datos operativos de vidrio no se alteran.
function visibleGlassEfficiencyRows(){
 const week=document.querySelector('#glassEfficiencyWeek')?.value||'all';
 return filterGlassRowsByWeek(glassEfficiencyRows,glassWeekByProduction,week);
}
async function loadGlassEfficiencyWeeks(client,token,request,previous='all'){
 const picker=document.querySelector('#glassEfficiencyWeek');
 const status=document.querySelector('#glassEfficiencyWeekStatus');
 if(!picker||!status)return;
 picker.disabled=true;
 status.textContent='Identificando semanas de programación…';
 try{
  // Reutilizar RPC autorizadas. No se leen tablas con RLS desde el navegador.
  const {data:available,error:weekError}=await client.rpc('sgp_picking_semanas',{p_token:token});
  if(weekError)throw weekError;
  const weeks=[...new Set((available||[]).map(Number).filter(w=>Number.isInteger(w)&&w>=1&&w<=53))];
  if(!weeks.length)throw new Error('No se encontraron semanas de programación');
  const year=new Date().getFullYear();
  const weekly=[];
  for(let i=0;i<weeks.length;i+=3){
   const results=await Promise.all(weeks.slice(i,i+3).map(async w=>{
    const {data,error}=await client.rpc('sgp_consultar_programacion_semana',{p_token:token,p_anio:year,p_semana:w});
    if(error)throw error;
    return data?.producciones||[];
   }));
   weekly.push(...results.flat());
  }
  if(request!==locationReportRequest)return;
  const indexed=indexGlassProductionWeeks(weekly);
  const missing=[...new Set(glassEfficiencyRows.map(r=>String(r.key_produccion)))].filter(k=>!indexed.has(k));
  if(missing.length)throw new Error(missing.length+' órdenes sin correspondencia semanal');
  const options=weeksWithGlass(glassEfficiencyRows,indexed);
  if(!options.length)throw new Error('No existen semanas identificadas para estas órdenes');
  glassWeekByProduction=indexed;
  picker.innerHTML='<option value="all">Todas las semanas</option>'+options.map(value=>{
   const [y,w]=value.split('-');
   return '<option value="'+value+'">Semana '+Number(w)+' · '+Number(y)+'</option>';
  }).join('');
  picker.value=options.includes(previous)?previous:'all';
  picker.disabled=false;
  status.textContent=options.length+' semanas disponibles';
  renderGlassEfficiency();
  if(!document.querySelector('#glassExplorerModal')?.hidden)renderGlassExplorer();
 }catch(e){
  if(request!==locationReportRequest)return;
  glassWeekByProduction=new Map();
  picker.innerHTML='<option value="all">Todas las semanas</option>';
  picker.disabled=true;
  status.textContent='Filtro semanal no disponible: '+String(e?.message||e)+'. El reporte general continúa operativo.';
  renderGlassEfficiency();
 }
}

function renderGlassEfficiency(){
 const target=document.querySelector('#glassEfficiencyList'),stats=document.querySelector('#glassEfficiencyStats');
 if(!target||!stats)return;
 const query=(document.querySelector('#glassEfficiencySearch')?.value||'').trim().toLowerCase();
 const filter=document.querySelector('#glassEfficiencyFilter')?.value||'all';
 const reservations=new Map();
 visibleGlassEfficiencyRows().forEach(r=>{
  const key=String(r.key_produccion||''),res=String(r.reserva||'SIN RESERVA').split(',')[0].trim(),pos=String(r.posicion||'SIN UBICACIÓN'),part=String(r.parte||'SIN PARTE');
  if(!reservations.has(res))reservations.set(res,new Map());
  const orders=reservations.get(res);
  if(!orders.has(key))orders.set(key,{key,name:String(r.produccion||key),line:String(r.id_linea||''),system:String(r.sistema||''),finish:String(r.acabado||''),part,windows:Number(r.ventanas||0),source:String(r.reservas_origen||res),locations:[]});
  orders.get(key).locations.push({pos,total:Number(r.unidades||0),prepared:Number(r.preparadas||0),novelty:Number(r.novedad||0),transfer:Number(r.traslado||0)});
 });
 let totalOrders=0,multi=0,three=0;
 reservations.forEach(orders=>orders.forEach(o=>{const n=o.locations.filter(l=>l.prepared>0&&l.pos!=='SIN UBICACIÓN').length;totalOrders++;if(n>=2)multi++;if(n>=3)three++}));
 stats.innerHTML='<span><b>'+totalOrders+'</b> órdenes con ubicación</span><span><b>'+multi+'</b> órdenes en 2+ burros preparados</span><span><b>'+three+'</b> órdenes en 3+ burros preparados</span>';
 const html=[];
 [...reservations.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).forEach(([res,orders])=>{
  const selected=[...orders.values()].map(o=>({...o,racks:o.locations.filter(l=>l.prepared>0&&l.pos!=='SIN UBICACIÓN').length,prepared:o.locations.reduce((n,l)=>n+l.prepared,0)})).filter(o=>(filter==='all'||o.racks>=(filter==='three'?3:2))&&(!query||[res,o.name,o.key,o.part,o.system,o.finish,o.source,...o.locations.map(l=>l.pos)].join(' ').toLowerCase().includes(query))).sort((a,b)=>a.part.localeCompare(b.part,undefined,{numeric:true})||b.racks-a.racks||a.name.localeCompare(b.name));
  if(!selected.length)return;
  const sum=selected.reduce((n,o)=>n+o.prepared,0),windows=selected.reduce((n,o)=>n+o.windows,0),reserveRacks=new Set(selected.flatMap(o=>o.locations.filter(l=>l.prepared>0).map(l=>l.pos))).size,parts=new Map();
  selected.forEach(o=>{if(!parts.has(o.part))parts.set(o.part,[]);parts.get(o.part).push(o)});
  const partsHtml=[...parts.entries()].map(([part,partOrders])=>{
   const partWindows=partOrders.reduce((n,o)=>n+o.windows,0),partPrepared=partOrders.reduce((n,o)=>n+o.prepared,0),partRacks=new Set(partOrders.flatMap(o=>o.locations.filter(l=>l.prepared>0).map(l=>l.pos))).size;
   const ordersHtml=partOrders.map(o=>{
    const status=o.racks>=3?'high':o.racks===2?'medium':'low';
    const locs=o.locations.sort((a,b)=>b.prepared-a.prepared||a.pos.localeCompare(b.pos)).map(l=>'<tr><td><strong>'+escapeHtml(l.pos)+'</strong></td><td class="num">'+l.prepared.toLocaleString('es-CO')+'</td><td class="num">'+l.novelty.toLocaleString('es-CO')+'</td><td class="num">'+l.transfer.toLocaleString('es-CO')+'</td><td class="num">'+l.total.toLocaleString('es-CO')+'</td></tr>').join('');
    return '<details class="glass-efficiency-order"><summary><span class="glass-efficiency-order-name">'+escapeHtml(o.name)+'<small>'+escapeHtml(o.system)+' · '+escapeHtml(o.finish)+' · '+escapeHtml(o.line)+(o.source!==res?' · Reservas de origen: '+escapeHtml(o.source):'')+'</small></span><span class="glass-efficiency-pill '+status+'">'+o.racks+' burro'+(o.racks===1?'':'s')+' preparado'+(o.racks===1?'':'s')+'</span><b>'+o.windows.toLocaleString('es-CO')+' ventanas · '+o.prepared.toLocaleString('es-CO')+' vidrios preparados</b></summary><div class="table-wrap"><table><thead><tr><th>Ubicación / burro</th><th>Preparados</th><th>Novedad</th><th>Traslado</th><th>Total</th></tr></thead><tbody>'+locs+'</tbody></table></div></details>';
   }).join('');
   return '<details class="glass-efficiency-part" open><summary><strong>'+(part==='SIN PARTE'?'Sin parte asignada':'Parte '+escapeHtml(part))+'</strong><span>'+partOrders.length+' órdenes · '+partWindows+' ventanas · '+partRacks+' burros · '+partPrepared+' vidrios preparados</span></summary><div class="glass-efficiency-orders">'+ordersHtml+'</div></details>';
  }).join('');
  const systems=[...new Set(selected.map(o=>o.system).filter(Boolean))];
  const finishes=[...new Set(selected.map(o=>o.finish).filter(Boolean))];
  const priorities=[...new Set(selected.flatMap(o=>o.part.split(',').map(p=>p.trim())).filter(p=>p&&p!=='SIN PARTE'))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const heading='Reserva '+escapeHtml(res)+(systems.length?' · '+escapeHtml(systems.join(' / ')):'')+(finishes.length?' · '+escapeHtml(finishes.join(' / ')):'');
  const priorityLabel=priorities.length?'Prioridad'+(priorities.length>1?'es':'')+': '+escapeHtml(priorities.join(', ')):'Prioridad sin asignar';
  html.push('<details class="glass-efficiency-reservation"><summary><span class="glass-efficiency-reservation-title"><strong>'+heading+'</strong><small>'+priorityLabel+'</small></span><span>'+selected.length+' órdenes · '+windows+' ventanas · '+reserveRacks+' burros · '+sum.toLocaleString('es-CO')+' vidrios preparados</span></summary><div class="glass-efficiency-parts">'+partsHtml+'</div></details>');
 });
 target.innerHTML=html.join('')||'<p class="empty">No hay órdenes para los filtros seleccionados.</p>';
 target.querySelectorAll('.glass-efficiency-reservation,.glass-efficiency-part,.glass-efficiency-order').forEach(el=>{
  const summary=el.querySelector(':scope > summary');if(!summary||summary.querySelector('.glass-open-relations'))return;
  const button=document.createElement('button');button.type='button';button.className='glass-open-relations';button.textContent='Ver relaciones';
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openGlassExplorer();const title=summary.querySelector('strong,.glass-efficiency-order-name')?.textContent||'';document.querySelector('#glassExplorerSearch').value=title.replace(/^Reserva |^Parte /,'').split(' · ')[0].trim();renderGlassExplorer()});
  summary.appendChild(button);
 });

}

/* LAB v298: explorador de relaciones; sólo lectura, basado en la misma RPC autenticada. */
const glassExplorer={selected:null,lastClickId:null,lastClickAt:0};
function glassExplorerModel(){
 return buildGlassRelationGraph(visibleGlassEfficiencyRows(),document.querySelector('#glassExplorerStatus')?.value||'prepared');
}
// LAB v307: pop-ups contextuales. Cálculos locales sobre la RPC de ubicaciones (sin nuevas solicitudes).
function glassExplorerInsightHTML(node,insight,mode='prepared'){
 const esc=v=>escapeHtml(String(v));
 if(!node||!insight)return '<p>Sin información disponible.</p>';
 const label='<strong class="glass-tooltip-heading">'+esc(node.label)+'</strong>';
 const row=(cls,title,qty)=>'<div class="glass-tooltip-row"><span class="glass-tooltip-dot '+cls+'"></span><span>'+title+'</span><b>'+Number(qty||0).toLocaleString('es-CO')+'</b></div>';
 if(node.type==='burro'){
  const reserv=glassRackBreakdown(insight,mode),shared=reserv.length>1;
  const byReserve=reserv.map(r=>'<div class="glass-tooltip-reserve"><strong>'+esc(r.reserva)+'</strong><span>'+Number(mode==='all'?r.total:r.prepared).toLocaleString('es-CO')+' vidrios · '+r.orders+' órdenes</span></div>').join('');
  return '<section class="glass-tooltip-inner">'+label+
   '<p class="glass-tooltip-subtitle">'+(shared?'<span class="glass-tooltip-warning">Compartido: '+reserv.length+' reservas principales</span>':reserv.length+' reserva principal')+'</p>'+
   '<div class="glass-tooltip-summary">'+row('prepared','Preparados',insight.prepared)+row('novelty','Novedad',insight.novelty)+row('transfer','Traslado',insight.transfer)+row('others','Otros',insight.others)+'</div>'+
   '<div class="glass-tooltip-total">Total en ubicación <b>'+Number(insight.total).toLocaleString('es-CO')+'</b></div>'+
   '<div class="glass-tooltip-reserves"><span class="glass-tooltip-caption">Por reserva · '+(mode==='prepared'?'preparados':'todos los estados')+'</span>'+byReserve+'</div></section>';
 }
 const coverage=glassCoverage(insight),percent=coverage.percentage;
 const completion=node.type==='orden'?(coverage.complete?'<span class="glass-tooltip-complete">✓ Completa por cantidad</span>':'<span class="glass-tooltip-partial">◔ Parcial por cantidad</span>'):'';
 return '<section class="glass-tooltip-inner">'+label+
  '<div class="glass-tooltip-subtitle">'+Number(coverage.windows).toLocaleString('es-CO')+' ventanas '+completion+'</div>'+
  '<div class="glass-tooltip-summary">'+row('prepared','Vidrios preparados',insight.prepared)+row('novelty','Novedad',insight.novelty)+row('transfer','Traslado',insight.transfer)+row('others','Otros',insight.others)+'</div>'+
  '<div class="glass-tooltip-total">Total vidrios <b>'+Number(insight.total).toLocaleString('es-CO')+'</b></div>'+
  '<div class="glass-tooltip-progress"><span style="width:'+percent+'%"></span></div>'+
  '<div class="glass-tooltip-coverage">Cobertura por cantidad: <b>'+percent+'%</b></div>'+
  '<small class="glass-tooltip-footnote">Cobertura numérica; no certifica asignación por ventana.</small></section>';
}
function showGlassExplorerTooltip(el,node,insight,mode){
 const tooltip=document.querySelector('#glassExplorerTooltip');
 if(!tooltip||!el||!node||!insight)return;
 tooltip.innerHTML=glassExplorerInsightHTML(node,insight,mode);
 tooltip.hidden=false;
 const rect=el.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
 const vw=window.innerWidth,vh=window.innerHeight;
 let x=rect.right+12;
 if(x+box.width>vw-8)x=rect.left-box.width-12;
 x=Math.max(8,Math.min(x,vw-box.width-8));
 const y=Math.max(8,Math.min(rect.top+rect.height/2-box.height/2,vh-box.height-8));
 tooltip.style.left=x+'px';tooltip.style.top=y+'px';
}
function hideGlassExplorerTooltip(){const tooltip=document.querySelector('#glassExplorerTooltip');if(tooltip)tooltip.hidden=true;}
function renderGlassExplorer(){
 const graph=document.querySelector('#glassExplorerGraph'),details=document.querySelector('#glassExplorerDetails'),summary=document.querySelector('#glassExplorerSummary');
 if(!graph||!details||!summary)return;
 const model=glassExplorerModel(),query=(document.querySelector('#glassExplorerSearch')?.value||'').toLowerCase().trim();
 hideGlassExplorerTooltip();
 const insights=buildGlassNodeInsights(visibleGlassEfficiencyRows());
 const mode=document.querySelector('#glassExplorerStatus')?.value||'prepared';
 const matching=[...model.nodes.values()].filter(n=>!query||n.label.toLowerCase().includes(query));
 const selected=glassExplorer.selected;
 // LAB v299: recorrer la jerarquía completa desde la selección, no sólo un salto.
 const adjacency=new Map();
 for(const edge of model.edges.values()){const {a,b}=edge;if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a)}
 let seeds=query?matching.map(n=>n.id):selected&&model.nodes.has(selected)?[selected]:[];
 let allowed=new Set();
 if(seeds.length){let queue=seeds.map(id=>({id,depth:0}));for(const id of seeds)allowed.add(id);
  for(let i=0;i<queue.length;i++){const {id,depth}=queue[i];if(depth>=3)continue;for(const next of adjacency.get(id)||[]){if(!allowed.has(next)){allowed.add(next);queue.push({id:next,depth:depth+1})}}}
 }else if(!query){allowed=new Set(model.nodes.keys())}
 const visible=[...model.nodes.values()].filter(n=>allowed.has(n.id));
 const columns=['reserva','parte','orden','burro'];
 const groups=columns.map(type=>visible.filter(n=>n.type===type).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true})).slice(0,70));
 const width=1000,rowHeight=74,height=Math.max(350,...groups.map(g=>g.length*rowHeight+65));
 const coords=new Map();groups.forEach((g,i)=>g.forEach((n,j)=>coords.set(n.id,{x:125+i*250,y:52+j*rowHeight})));
 const esc=v=>escapeHtml(String(v));
 // LAB v306: destacar el alcance completo de la selección en ambas direcciones.
 // Burro -> orden -> parte -> reserva, y reserva -> parte -> orden -> burro.
 // Desde parte u orden se siguen ambas direcciones sin saltar a ramas ajenas.
 const trace=traceGlassRelations(model,selected);
 const related=trace.nodes;
 const hasFocus=related.size>0;
 const paths=[...model.edges.entries()].filter(([,edge])=>coords.has(edge.a)&&coords.has(edge.b)).map(([id,{a,b,qty}])=>{
  const p=coords.get(a),q=coords.get(b),active=trace.edges.has(id),direct=a===selected||b===selected;
  const stroke=hasFocus&&active?(direct?'#f97316':'#fb923c'):'#9cb5d2';
  const thickness=hasFocus&&active?Math.min(12,(direct?5:3)+Math.sqrt(qty)):Math.min(7,1+Math.sqrt(qty));
  const opacity=!hasFocus||active?'.95':'.10';
  return '<path d="M'+p.x+' '+p.y+' C'+(p.x+120)+' '+p.y+','+(q.x-120)+' '+q.y+','+q.x+' '+q.y+'" stroke="'+stroke+'" stroke-width="'+thickness+'" fill="none" opacity="'+opacity+'"><title>'+qty+' vidrios</title></path>';
 }).join('');
 const palette={reserva:'#7756d6',parte:'#e89b35',orden:'#10a37f',burro:'#1674ed'};
 const shapes=visible.filter(n=>coords.has(n.id)).map(n=>{
  const p=coords.get(n.id),metric=insights.get(n.id);
  const label=n.label.length>24?n.label.slice(0,23)+'…':n.label;
  const count=n.type==='burro'?n.glass+' vidrios':n.windows+' ventanas';
  const reservations=n.type==='burro'?glassRackBreakdown(metric,mode):[];
  const shared=n.type==='burro'&&reservations.length>1;
  const coverage=n.type==='orden'?glassCoverage(metric):null;
  const badge=shared?'⚠ '+reservations.length+' reservas':coverage?(coverage.complete?'✓ Completa':'◔ Parcial'):'';
  const badgeBg=shared?'#fee5dc':coverage?(coverage.complete?'#dcf9e9':'#ffedca'):'transparent';
  const badgeFg=shared?'#9e2811':coverage?(coverage.complete?'#087552':'#83500b'):'white';
  const focusStroke=selected===n.id?'#10264e':hasFocus&&related.has(n.id)?'#f97316':shared?'#d84432':'white';
  const focusWidth=selected===n.id?5:hasFocus&&related.has(n.id)?4:shared?3:1;
  const opacity=!hasFocus||related.has(n.id)?1:.3;
  return '<g data-node="'+esc(n.id)+'" role="button" tabindex="0" aria-label="'+esc(n.label+' · '+count+(badge?' · '+badge:'')+(n.type==='burro'?' · doble clic para detalle':''))+'" class="glass-explorer-node">'+
   '<rect x="'+(p.x-106)+'" y="'+(p.y-30)+'" width="212" height="60" rx="12" fill="'+palette[n.type]+'" stroke="'+focusStroke+'" stroke-width="'+focusWidth+'" opacity="'+opacity+'"/>'+
   '<text x="'+p.x+'" y="'+(p.y-14)+'" fill="white" text-anchor="middle" font-size="12" font-weight="700" opacity="'+opacity+'">'+esc(label)+'</text>'+
   '<text x="'+p.x+'" y="'+(p.y+3)+'" fill="white" text-anchor="middle" font-size="11" font-weight="800" opacity="'+opacity+'">'+esc(count)+'</text>'+
   (badge?'<rect x="'+(p.x-77)+'" y="'+(p.y+7)+'" width="154" height="19" rx="9" fill="'+badgeBg+'" opacity="'+opacity+'"/><text x="'+p.x+'" y="'+(p.y+21)+'" fill="'+badgeFg+'" text-anchor="middle" font-size="11" font-weight="800" opacity="'+opacity+'">'+esc(badge)+'</text>':'')+
   '<title>'+esc(n.label)+' · '+esc(count)+(badge?' · '+esc(badge):'')+'</title></g>';
 }).join('');
 graph.innerHTML='<svg viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'" aria-label="Red de reservas, partes, órdenes y burros"><g>'+paths+shapes+'</g></svg>';
 graph.querySelectorAll('[data-node]').forEach(el=>{
  const id=el.getAttribute('data-node'),node=model.nodes.get(id),insight=insights.get(id);
  const tooltip=()=>showGlassExplorerTooltip(el,node,insight,mode);
  const activate=()=>{
   const now=Date.now();
   if(node?.type==='burro'&&glassExplorer.lastClickId===id&&now-glassExplorer.lastClickAt<600){
    glassExplorer.lastClickId=null;hideGlassExplorerTooltip();openGlassBurroDetail(node.label);return;
   }
   glassExplorer.lastClickId=id;glassExplorer.lastClickAt=now;
   glassExplorer.selected=id;renderGlassExplorer();
   const fresh=[...graph.querySelectorAll('[data-node]')].find(item=>item.getAttribute('data-node')===id);
   showGlassExplorerTooltip(fresh,node,insight,mode);
  };
  el.addEventListener('mouseenter',tooltip);
  el.addEventListener('mouseleave',hideGlassExplorerTooltip);
  el.addEventListener('focus',tooltip);
  el.addEventListener('blur',hideGlassExplorerTooltip);
  el.addEventListener('click',activate);
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
 });
 const count=type=>[...model.nodes.values()].filter(n=>n.type===type).length;
 summary.textContent=count('reserva')+' reservas · '+count('parte')+' partes · '+count('orden')+' órdenes · '+count('burro')+' ubicaciones con vidrio';
 if(!selected||!model.nodes.has(selected)){details.textContent='Selecciona un nodo para consultar sus conexiones. Puedes buscar por reserva, orden o burro.';return}
 const node=model.nodes.get(selected),linked=[...model.edges.values()].filter(({a,b})=>a===selected||b===selected).map(({a,b,qty})=>({node:model.nodes.get(a===selected?b:a),qty})).filter(x=>x.node).sort((a,b)=>b.qty-a.qty);
 const nodeCount=node.type==='burro'?node.glass+' vidrios':node.windows+' ventanas';
 const context=node.type==='burro'?'<button type="button" class="glass-burro-detail-action" id="glassBurroDetailsButton">Ver detalle del burro</button>':'';
 details.innerHTML='<h3>'+esc(node.label)+'</h3><p>'+esc(nodeCount)+' · '+linked.length+' relaciones directas</p>'+glassExplorerInsightHTML(node,insights.get(selected),mode)+context+linked.map(x=>'<div class="glass-explorer-link"><strong>'+esc(x.node.label)+'</strong><span>'+x.qty+' vidrios</span><button type="button" data-related="'+esc(x.node.id)+'">Explorar</button></div>').join('');
 details.querySelector('#glassBurroDetailsButton')?.addEventListener('click',()=>openGlassBurroDetail(node.label));
 details.querySelectorAll('[data-related]').forEach(el=>el.addEventListener('click',()=>{glassExplorer.selected=el.getAttribute('data-related');renderGlassExplorer()}));
}
function openGlassBurroDetail(position){
 const modal=document.querySelector('#glassBurroModal');
 if(!modal)return;
 const info=summarizeGlassBurro(visibleGlassEfficiencyRows(),position);
 const esc=v=>escapeHtml(String(v));
 modal.querySelector('#glassBurroTitle').textContent='Burro '+info.position;
 const week=document.querySelector('#glassEfficiencyWeek')?.selectedOptions?.[0]?.textContent||'Todas las semanas';
 modal.querySelector('#glassBurroContext').textContent=week+' · Ubicación actual · todos los estados';
 modal.querySelector('#glassBurroMetrics').innerHTML='<span><b>'+info.reservations+'</b> reservas</span><span><b>'+info.parts+'</b> partes</span><span><b>'+info.orders+'</b> órdenes</span><span><b>'+info.totals.preparados+'</b> preparados</span><span><b>'+info.totals.novedad+'</b> novedad</span><span><b>'+info.totals.traslado+'</b> traslado</span><span><b>'+info.totals.otros+'</b> otros</span>';
 const insight=buildGlassNodeInsights(visibleGlassEfficiencyRows()).get('b:'+position);
 const reservations=glassRackBreakdown(insight,'all');
 const byReserve=modal.querySelector('#glassBurroReservas');
 if(byReserve)byReserve.innerHTML=(reservations.length>1?'<strong class="glass-burro-sharing">⚠ Burro compartido por '+reservations.length+' reservas principales</strong>':'')+
  reservations.map(item=>'<div class="glass-burro-reserve"><strong>'+esc(item.reserva)+'</strong><span>'+item.prepared+' preparados · '+item.novelty+' novedad · '+item.transfer+' traslado · '+item.others+' otros</span></div>').join('');

 const body=modal.querySelector('#glassBurroBody');
 body.innerHTML=info.items.length?info.items.map(x=>
  '<tr><td>'+esc(x.reserva)+'</td><td>'+esc(x.parte)+'</td><td><strong>'+esc(x.orden)+'</strong></td><td class="num">'+x.ventanas+'</td><td class="num">'+x.preparados+'</td><td class="num">'+x.novedad+'</td><td class="num">'+x.traslado+'</td><td class="num">'+x.otros+'</td><td class="num"><strong>'+x.total+'</strong></td></tr>'
 ).join(''):'<tr><td colspan="9">No hay vidrios asociados con la semana seleccionada.</td></tr>';
 modal.hidden=false;
 modal.querySelector('#glassBurroClose')?.focus();
}
function closeGlassBurroDetail(){const modal=document.querySelector('#glassBurroModal');if(modal)modal.hidden=true;}
document.querySelector('#glassBurroClose')?.addEventListener('click',closeGlassBurroDetail);
document.querySelector('#glassBurroModal')?.addEventListener('click',e=>{if(e.target.id==='glassBurroModal')closeGlassBurroDetail()});
function openGlassExplorer(){
 const modal=document.querySelector('#glassExplorerModal');if(!modal)return;
 glassExplorer.selected=null;modal.hidden=false;document.body.classList.add('glass-explorer-open');renderGlassExplorer();document.querySelector('#glassExplorerSearch')?.focus();
}
function closeGlassExplorer(){const modal=document.querySelector('#glassExplorerModal');if(modal)modal.hidden=true;hideGlassExplorerTooltip();document.body.classList.remove('glass-explorer-open');}
document.querySelector('#glassExploreButton')?.addEventListener('click',openGlassExplorer);
document.querySelector('#glassExplorerClose')?.addEventListener('click',closeGlassExplorer);
document.querySelector('#glassExplorerCloseBottom')?.addEventListener('click',closeGlassExplorer);
document.querySelector('#glassExplorerReset')?.addEventListener('click',()=>{glassExplorer.selected=null;document.querySelector('#glassExplorerSearch').value='';renderGlassExplorer()});
document.querySelector('#glassExplorerSearch')?.addEventListener('input',()=>{glassExplorer.selected=null;renderGlassExplorer()});
document.querySelector('#glassExplorerStatus')?.addEventListener('change',()=>{glassExplorer.selected=null;renderGlassExplorer()});
document.querySelector('#glassExplorerGraph')?.addEventListener('scroll',hideGlassExplorerTooltip,{passive:true});
document.querySelector('#glassExplorerModal')?.addEventListener('click',e=>{if(e.target.id==='glassExplorerModal')closeGlassExplorer()});
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 if(!document.querySelector('#glassBurroModal')?.hidden){closeGlassBurroDetail();return}
 if(!document.querySelector('#glassExplorerModal')?.hidden)closeGlassExplorer();
});

document.querySelector('#glassEfficiencySearch')?.addEventListener('input',renderGlassEfficiency);
document.querySelector('#glassEfficiencyFilter')?.addEventListener('change',renderGlassEfficiency);
document.querySelector('#glassEfficiencyWeek')?.addEventListener('change',()=>{renderGlassEfficiency();glassExplorer.selected=null;if(!document.querySelector('#glassExplorerModal')?.hidden)renderGlassExplorer();});
// LAB v302: consultas independientes, reintento manual y datos previos conservados.
let locationReportRequest=0;
async function loadLocationReport(){
 const request=++locationReportRequest,token=getAppToken();
 const status=els.locationReportStatus;
 if(!token){status.textContent="Inicia sesión para consultar.";return}
 status.textContent="Actualizando ubicaciones…";
 const failures=[];let success=0;
 const errorLabel=(name,e)=>{const message=String(e?.message||e||'Error desconocido');
  const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
  return name+': '+(offline?'sin conexión a Internet':/failed to fetch|networkerror|fetch failed|load failed/i.test(message)?'falló la conexión con Supabase':message);
 };
 try{
  const client=await getSupabaseClient();
  const calls=[['Resumen', 'sgp_reporte_ubicaciones_vidrio'],['Burros','sgp_reporte_burros_estado'],['Distribución','sgp_reporte_dispersion_vidrio']];
  const results=await Promise.allSettled(calls.map(async ([name,rpc])=>{
   const {data,error}=await client.rpc(rpc,{p_token:token});if(error)throw error;return data;
  }));
  if(request!==locationReportRequest)return;
  results.forEach((result,i)=>{
   const name=calls[i][0];if(result.status==='rejected'){failures.push(errorLabel(name,result.reason));return}
   const data=result.value;success++;
   if(i===0){const m=data?.metricas||{};
    els.lrPrepared.textContent=m.preparadas??0;els.lrNovelty.textContent=m.novedad??0;els.lrTransfer.textContent=m.traslado??0;els.lrOther.textContent=m.otros??0;els.lrRacks.textContent=m.burros??0;els.lrMixed.textContent=data?.burros_mixtos??0;
    els.locationByReservation.innerHTML=(data?.por_reserva||[]).map(r=>`<tr><td>${escapeHtml(String(r.reserva).split(',')[0].trim())}</td><td class="num"><strong>${r.burros}</strong></td><td class="num">${r.unidades}</td></tr>`).join("")||'<tr><td colspan="3" class="empty">Sin ubicaciones</td></tr>';
   }else if(i===1){els.locationMixedRacks.innerHTML=(data||[]).map(r=>`<tr><td><strong>${escapeHtml(r.posicion)}</strong></td><td><span class="rack-status rack-${escapeHtml(r.orden_estado)}">${escapeHtml(r.estado)}</span></td><td>${escapeHtml([...new Set(String(r.reservas||'').split(',').map(v=>v.trim()).filter(Boolean))].join(', '))}</td><td class="num">${r.cantidad_reservas}</td><td class="num"><strong>${r.unidades}</strong></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Sin burros activos</td></tr>';
   }else{const weekPicker=document.querySelector('#glassEfficiencyWeek'),priorWeek=weekPicker?.value||'all';glassEfficiencyRows=data||[];glassWeekByProduction=new Map();if(weekPicker){weekPicker.disabled=true;weekPicker.value='all';}renderGlassEfficiency();void loadGlassEfficiencyWeeks(client,token,request,priorWeek);}
  });
 }catch(e){if(request!==locationReportRequest)return;failures.push(errorLabel('Conexión',e))}
 if(request!==locationReportRequest)return;
 status.textContent=failures.length?(success?'Reporte parcial ('+success+'/3). ':'No se pudieron actualizar los datos. ')+failures.join(' · ')+' · Se conservan los últimos datos cargados.':'Reporte actualizado ✓ datos de ubicación activos.';
 // No mostrar datos antiguos como si fueran actuales.
 if(failures.length)status.textContent+=' Pulsa Reporte de ubicaciones para reintentar.';
}
function openAssemblyTab(tab){
 const report=tab==="report";els.assemblySheetPanel.hidden=report;els.assemblyLocationReportPanel.hidden=!report;els.assemblySheetTab.classList.toggle("active",!report);els.assemblyLocationReportTab.classList.toggle("active",report);if(report)loadLocationReport();
}

async function refreshAssemblyWeeks(selectLatest=false){
 const token=getAppToken();if(!token||!els.assemblyWeek)return;
 const current=els.assemblyWeek.value;
 try{const client=await getSupabaseClient();const {data,error}=await client.rpc("sgp_picking_semanas",{p_token:token});if(error)throw error;const weeks=(data||[]).map(Number).filter(Number.isFinite).sort((a,b)=>b-a);els.assemblyWeek.innerHTML='<option value="">Todas las semanas</option>'+weeks.map(w=>'<option value="'+w+'">Semana '+w+'</option>').join('');if(!selectLatest&&current&&weeks.includes(Number(current)))els.assemblyWeek.value=current;else if(weeks.length)els.assemblyWeek.value=String(weeks[0]);}
 catch(e){console.warn("No fue posible actualizar semanas de Ensamble",e)}
}
async function loadAssembly(){
 const token=getAppToken();if(!token){els.assemblyStatus.textContent="Inicia sesión para consultar.";return}
 els.loadAssembly.disabled=true;els.assemblyStatus.textContent="Consultando estado actual…";
 try{const client=await getSupabaseClient();const week=els.assemblyWeek.value?Number(els.assemblyWeek.value):null;const {data,error}=await client.rpc("sgp_consultar_ensamble",{p_token:token,p_semana:week,p_linea:els.assemblyLine.value});if(error)throw error;assemblyRows=data.filas||[];renderAssembly();els.assemblyStatus.textContent=`Actualizado ✓ ${assemblyRows.length} órdenes · datos actuales de SGP.`;}
 catch(e){els.assemblyStatus.textContent="Consulta rechazada ✕ "+e.message}finally{els.loadAssembly.disabled=false}
}

// Empaque: consulta de solo lectura sobre la misma RPC autenticada de Ensamble.
let packingRows=[];
let packingRequestSequence=0;
function syncPackingWeekOptions(){
 const source=els.assemblyWeek,target=document.getElementById('packingWeek');
 if(!source||!target)return;
 const previous=target.value;
 const options=Array.from(source.options||[]);
 target.replaceChildren(...options.map(o=>new Option(o.text,o.value)));
 if(options.some(o=>o.value===previous))target.value=previous;
 else target.value=source.value||'';
}
function renderPackingSheet(){
 const body=document.getElementById('packingPreviewBody'),status=document.getElementById('packingPreviewStatus');
 if(!body)return;
 const search=(document.getElementById('packingPreviewSearch')?.value||'').trim().toLowerCase();
 const filter=document.getElementById('packingPreviewFilter')?.value||'all';
 const sort=document.getElementById('packingPreviewSort')?.value||'priority';
 const validBalance=r=>r.saldos_inicializados===true&&r.saldo_ensamble!==null&&r.saldo_ensamble!==undefined&&r.saldo_ensamble!==''&&Number.isFinite(Number(r.saldo_ensamble))&&Number(r.saldo_ensamble)>=0;
 const ready=r=>r.presente_ultimo_export!==false&&validBalance(r)&&Number(r.saldo_ensamble)===0;
 let rows=packingRows.filter(r=>(!search||[r.produccion,r.sistema,r.reserva_al,r.id].some(v=>String(v??'').toLowerCase().includes(search)))&&(filter==='all'||(filter==='ready'?ready(r):filter==='pending'?r.presente_ultimo_export!==false&&validBalance(r)&&Number(r.saldo_ensamble)>0:true)));
 rows.sort((a,b)=>sort==='balance'?Number(b.saldo_ensamble??-1)-Number(a.saldo_ensamble??-1):sort==='production'?String(a.produccion??'').localeCompare(String(b.produccion??''),undefined,{numeric:true}):comparePriority(a.prioridad,b.prioridad)||String(a.produccion??'').localeCompare(String(b.produccion??''),undefined,{numeric:true}));
 const esc=v=>String(v??'—').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 body.innerHTML=rows.length?rows.map(r=>{
  const freshness=r.presente_ultimo_export===false?'No figura en último Export':r.ultima_vez_export?'Export: '+(Number.isNaN(new Date(r.ultima_vez_export).getTime())?'fecha no válida':new Date(r.ultima_vez_export).toLocaleString('es-CO')):'Sin fecha de Export';
  const state=r.presente_ultimo_export===false?'Sin dato vigente':ready(r)?'Totalmente ensamblada':validBalance(r)&&Number(r.saldo_ensamble)>0?'Con saldo de ensamble':'Saldo sin validar';
  return '<tr><td>'+esc(r.prioridad)+'</td><td>'+esc(r.produccion)+'</td><td>'+esc(r.sistema)+'</td><td>'+esc(r.cantidad)+'</td><td>'+esc(r.ensamblado)+'</td><td>'+esc(r.saldo_ensamble)+'</td><td>'+esc(state)+'<small style="display:block;color:#61728b">'+esc(freshness)+'</small></td><td>'+esc(r.saldo_empaque)+'</td><td>—</td></tr>';
 }).join(''):'<tr><td colspan="9">No hay producciones para los filtros seleccionados.</td></tr>';
 if(status)status.textContent=rows.length+' producciones · '+rows.filter(r=>r.presente_ultimo_export===false).length+' ausentes del último Export · Prioridades y comentarios de Empaque aún no editables.';
}
async function loadPackingSheet(){
 const body=document.getElementById('packingPreviewBody'),status=document.getElementById('packingPreviewStatus');
 if(!body)return;
 const requestSequence=++packingRequestSequence;
 const requestedToken=getAppToken();
 syncPackingWeekOptions();
 packingRows=[];
 body.innerHTML='<tr><td colspan="9">Consultando producciones…</td></tr>';
 const token=requestedToken;
 if(!token){packingRows=[];body.innerHTML='<tr><td colspan="9">Inicia sesión para consultar Empaque.</td></tr>';if(status)status.textContent='Inicia sesión para consultar Empaque.';return;}
 if(status)status.textContent='Consultando Empaque…';
 try{
  const client=await getSupabaseClient();
  const selectedWeek=document.getElementById('packingWeek')?.value;
  const week=selectedWeek?Number(selectedWeek):null;
  const line=document.getElementById('packingLine')?.value||'PANELES_2';
  const {data,error}=await client.rpc('sgp_consultar_ensamble',{p_token:token,p_semana:week,p_linea:line});
  if(requestSequence!==packingRequestSequence||getAppToken()!==requestedToken)return;
  if(error)throw error;
  packingRows=Array.isArray(data?.filas)?data.filas:[];
  renderPackingSheet();
 }catch(error){if(requestSequence!==packingRequestSequence||getAppToken()!==requestedToken)return;packingRows=[];if(status)status.textContent='Consulta rechazada: '+error.message;if(body)body.innerHTML='<tr><td colspan="9">No fue posible cargar Empaque.</td></tr>';}
}
document.getElementById('productionPackingTab')?.addEventListener('click',()=>{void loadPackingSheet();});
for(const id of ['packingWeek','packingLine'])document.getElementById(id)?.addEventListener('change',()=>{void loadPackingSheet();});
for(const id of ['packingPreviewSearch','packingPreviewFilter','packingPreviewSort'])document.getElementById(id)?.addEventListener('input',renderPackingSheet);

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
    dailyExportPreview=null;dailyExportRows=[];
    // The Export has already committed. Reporting/refresh failures must not relabel it as rejected.
    try{
      const {data:chg,error:chgErr}=await client.rpc('sgp_resumen_eventos_actualizacion',{p_token:token,p_id_lote:data.id_carga_diaria,p_fuente:'EXPORT'});
      if(chgErr)throw chgErr;
      window.exportChangeData=chg||{};
      const cs=document.querySelector('#dailyExportChangeSummary');if(cs)cs.hidden=false;
      const eo=document.querySelector('#expOpenAssembly'),ea=document.querySelector('#expAssemblyDone'),ep=document.querySelector('#expPackingDone');
      if(eo)eo.textContent=(chg.ABIERTA_ENSAMBLE||[]).length;
      if(ea)ea.textContent=(chg.ENSAMBLADA_COMPLETA||[]).length;
      if(ep)ep.textContent=(chg.ORDEN_COMPLETADA||[]).length;
    }catch(reportError){
      console.warn('Export aplicado; resumen de eventos no disponible',reportError);
      els.dailyExportStatus.textContent+=' · No fue posible consultar el resumen de eventos.';
    }
    if(document.getElementById('productionPackingTab')?.getAttribute('aria-selected')==='true')void loadPackingSheet();
    if(document.getElementById('productionAssemblyTab')?.getAttribute('aria-selected')==='true')void loadAssembly();
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
  if (weeklyCommitInProgress || weeklyCommitNeedsVerification) return;
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
  const preflightStartedAt = performance.now();

  els.importStatus.textContent = "Preflight: comprobando sesión, rol y estado de la semana…";
  const { data: preflight, error: preflightError } = await client.rpc("sgp_preflight_carga_semanal", { p_token: token, p_anio: year, p_semana: week });
  if (preflightError || !preflight?.ok) {
    const msg = preflightError?.message || "Preflight no válido";
    els.importStatus.textContent = "CARGA RECHAZADA ✕ " + msg; window.alert("CARGA RECHAZADA ✕\n\n" + msg); refreshWeeklyPackageGate(); return;
  }
  const preflightMs = Math.round(performance.now() - preflightStartedAt);
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

  weeklyCommitInProgress = true;
  els.commit.disabled = true; els.commit.textContent = `Enviando ${total.toLocaleString("es-CO")} registros…`;
  els.importStatus.textContent = "SOLICITUD ENVIADA… No cierres esta pestaña. Esperando confirmación del servidor.";
  if (els.previewStatus) els.previewStatus.textContent = "Estado: solicitud de carga enviada; esperando respuesta transaccional.";
  await new Promise(resolve => setTimeout(resolve, 50));
  // Retry only an explicitly rejected concurrency lock. Never retry an uncertain timeout.
  const maxLockRetries = 2;
  let completed = false;
  try {
    for (let attempt = 0; attempt <= maxLockRetries; attempt++) {
      if (attempt > 0) {
        els.importStatus.textContent = `Bloqueo de carga: reintento ${attempt}/${maxLockRetries} en 60 segundos…`;
        await new Promise(resolve => setTimeout(resolve, 60000));
        // The previous writer may have completed while we waited. Do not duplicate a week.
        const { data: check, error: checkError } = await client.rpc("sgp_preflight_carga_semanal", {
          p_token: token, p_anio: year, p_semana: week
        });
        if (checkError || !check?.ok) throw checkError || new Error("No fue posible verificar la semana antes del reintento.");
        if (check.semana_ya_cargada) throw new Error("SEMANA_YA_CARGADA: otra carga finalizó mientras se esperaba. No se repetirá la escritura.");
      }
      els.importStatus.textContent = `Cargando semana ${week} · intento ${attempt + 1}/${maxLockRetries + 1}…`;
      const rpcStartedAt = performance.now();
      const { data, error } = await client.rpc("sgp_cargar_paquete_semanal", {
        p_token: token, p_anio: year, p_semana: week, p_programacion: validatedProductions,
        p_piezas: piecesPayload, p_accesorios: accessoriesPayload, p_vidrio: glassPayload
      });
      const rpcMs = Math.round(performance.now() - rpcStartedAt);
      console.info("[SGP carga semanal] tiempos", { anio: year, semana: week, intento: attempt + 1, preflight_ms: preflightMs, rpc_ms: rpcMs, resultado: error ? "ERROR" : "OK", codigo: error?.code || null });
      if (error) {
        const isConcurrencyLock = /CARGA_SEMANAL_EN_PROCESO/i.test(error.message || "");
        if (isConcurrencyLock && attempt < maxLockRetries) continue;
        throw error;
      }
      const timings = data?.tiempos_ms;
      if (timings && typeof timings === "object") {
        console.info("[SGP carga semanal] tiempos por etapa (ms)", timings);
      }
      const inserted = data?.insertados?.total ?? total;
      els.importStatus.textContent = `CARGA COMPLETADA ✓ Semana ${week} · Lote ${data.id_lote_carga} · ${inserted} registros · ${Math.round(rpcMs / 1000)} s.`;
      els.commit.textContent = "Semana cargada ✓";
      if (els.previewStatus) els.previewStatus.textContent = `Escritura realizada: SÍ ✓ · Lote ${data.id_lote_carga} · Usuario ${data.usuario} · Total ${inserted}.`;
      window.alert(`CARGA COMPLETADA ✓\n\nSemana ${week} / ${year}\nLote: ${data.id_lote_carga}\nRegistros insertados: ${inserted}`);
      completed = true;
      break;
    }
  } catch (error) {
    const msg = [error?.message,error?.details,error?.hint].filter(Boolean).join(" · ") || String(error);
    const uncertain = /statement timeout|lock timeout|network|fetch failed|failed to fetch|networkerror|aborterror/i.test(msg);
    if (uncertain) weeklyCommitNeedsVerification = true;
    const guidance = uncertain ? "Resultado no confirmado. Verifique el estado de la semana antes de intentar una nueva carga." : "";
    els.importStatus.textContent = "CARGA NO COMPLETADA ✕ " + msg;
    if (els.previewStatus) els.previewStatus.textContent = "Resultado no confirmado. " + guidance + " Error: " + msg;
    window.alert("CARGA NO COMPLETADA ✕\n\n" + msg + (guidance ? "\n\n" + guidance : ""));
    refreshWeeklyPackageGate();
  } finally {
    weeklyCommitInProgress = false;
    refreshWeeklyPackageGate();
    if (weeklyCommitNeedsVerification) {
      els.importStatus.textContent = "RESULTADO INCIERTO: comprueba en el servidor si la semana se cargó antes de volver a intentar.";
    }
  }
}
els.nav.forEach(button => button.addEventListener("click", async () => {openView(button.dataset.view);if(button.dataset.view==='inicio')loadHomeBalances();if(button.dataset.view==='configuracion')loadUserAdmin();if(button.dataset.view==='picking')loadPicking();if(button.dataset.view==='ensamble'){await refreshAssemblyWeeks(true);loadAssembly()}}));
function getISOWeekNumber(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/86400000)+1)/7);
}
const homeWeekEl=document.querySelector("#homeCurrentWeek");
if(homeWeekEl) homeWeekEl.textContent=String(getISOWeekNumber());
let homeBalanceRows=[];
async function loadHomeBalances(){
 const overdue=document.querySelector('#homeOverdueCards'),current=document.querySelector('#homeCurrentBalance'),count=document.querySelector('#homeOverdueCount');
 if(!overdue||!current||!getAppToken())return;
 try{
  const db=await getSupabaseClient();
  const res=await db.rpc('sgp_resumen_saldos_portada',{p_token:getAppToken()});
  if(res.error)throw res.error;
  homeBalanceRows=res.data?.filas||[];
  const sums=new Map(),lines=['PANELES_2','FRAMES_2'];
  homeBalanceRows.forEach(r=>{
   const w=Number(r.semana_actual),line=String(r.id_linea||'');
   if(!Number.isFinite(w)||!lines.includes(line))return;
   const x=sums.get(w)||{week:w,lines:{PANELES_2:{ens:0,pack:0},FRAMES_2:{ens:0,pack:0}}};
   x.lines[line].ens+=Number(r.saldo_ensamble||0);
   x.lines[line].pack+=Number(r.saldo_empaque||0);
   sums.set(w,x);
  });
  const loadedWeeks=[...sums.keys()].filter(Number.isFinite),week=loadedWeeks.length?Math.max(...loadedWeeks):getISOWeekNumber();
  const homeWeek=document.querySelector('#homeCurrentWeek');if(homeWeek)homeWeek.textContent=String(week);
  const hasBalance=x=>lines.some(line=>x.lines[line].ens>0||x.lines[line].pack>0);
  const past=[...sums.values()].filter(x=>x.week<week&&hasBalance(x)).sort((x,y)=>x.week-y.week);
  const now=sums.get(week)||{week,lines:{PANELES_2:{ens:0,pack:0},FRAMES_2:{ens:0,pack:0}}};
  const renderWeek=(x,isOverdue)=>'<div class="home-balance-week '+(isOverdue?'overdue':'current')+'" data-home-balance-week="'+x.week+'"><strong>Semana '+x.week+'</strong><div class="home-balance-lines">'+lines.map(line=>{const z=x.lines[line];return '<div class="home-balance-line"><b class="home-balance-line-name">'+(line==='PANELES_2'?'▦ PANELES':'▣ FRAMES')+'</b><button type="button" class="home-balance-area" data-home-area="ensamble" data-home-line="'+line+'"><i>Ensamble</i><b>'+z.ens.toLocaleString('es-CO')+' <small>und</small></b></button><button type="button" class="home-balance-area" data-home-area="empaque" data-home-line="'+line+'"><i>Empaque</i><b>'+z.pack.toLocaleString('es-CO')+' <small>und</small></b></button></div>'}).join('')+'</div></div>';
  count.textContent=String(past.length);
  overdue.innerHTML=past.length?past.map(x=>renderWeek(x,true)).join(''):'<div class="home-balance-empty ok">Sin saldos de semanas vencidas.</div>';
  current.innerHTML=renderWeek(now,false);
 }catch(e){console.error('Saldos portada',e);overdue.innerHTML='<div class="home-balance-empty">No fue posible cargar los saldos.</div>';current.innerHTML='';}
}
function openHomeBalanceDetail(week,area=null,line=null){
 const all=homeBalanceRows.filter(r=>Number(r.semana_actual)===week&&(!line||String(r.id_linea)===line)&&(Number(r.saldo_ensamble||0)>0||Number(r.saldo_empaque||0)>0));
 const ens=all.reduce((n,r)=>n+Number(r.saldo_ensamble||0),0),pack=all.reduce((n,r)=>n+Number(r.saldo_empaque||0),0);
 const rows=area==='ensamble'?all.filter(r=>Number(r.saldo_ensamble||0)>0):area==='empaque'?all.filter(r=>Number(r.saldo_empaque||0)>0):all;
 const title=area==='ensamble'?'Saldo de Ensamble':area==='empaque'?'Saldo de Empaque':'Saldo de producción';
 document.querySelector('#homeBalanceModalEyebrow').textContent=title.toUpperCase();
 document.querySelector('#homeBalanceModalTitle').textContent='Semana '+week+(line?' · '+(line==='PANELES_2'?'PANELES':'FRAMES'):'');
 document.querySelector('#homeBalanceModalMeta').textContent=(week<getISOWeekNumber()?'Semana vencida':'Semana actual')+' · '+rows.length+' producciones con saldo';
 document.querySelector('#homeBalanceModalSummary').innerHTML='<button type="button" class="home-balance-summary-filter'+(area==='ensamble'?' active':'')+'" data-home-area="ensamble"><span>Saldo Ensamble</span><strong>'+ens.toLocaleString('es-CO')+' und</strong></button><button type="button" class="home-balance-summary-filter'+(area==='empaque'?' active':'')+'" data-home-area="empaque"><span>Saldo Empaque</span><strong>'+pack.toLocaleString('es-CO')+' und</strong></button>';
 const head=document.querySelector('#homeBalanceModal table thead');
 if(head)head.innerHTML='<tr><th>Tipo</th><th>Producción</th><th>Sistema</th><th>Acabado</th>'+(area==='ensamble'?'<th>Saldo Ensamble</th>':area==='empaque'?'<th>Saldo Empaque</th>':'<th>Saldo Ensamble</th><th>Saldo Empaque</th>')+'</tr>';
 document.querySelector('#homeBalanceModalBody').innerHTML=rows.length?rows.map(r=>'<tr><td>'+escapeHtml(r.tipo||'—')+'</td><td><b>'+escapeHtml(r.produccion||'—')+'</b></td><td>'+escapeHtml(r.sistema||'—')+'</td><td>'+escapeHtml(r.acabado||'—')+'</td>'+(area==='ensamble'?'<td>'+Number(r.saldo_ensamble||0).toLocaleString('es-CO')+'</td>':area==='empaque'?'<td>'+Number(r.saldo_empaque||0).toLocaleString('es-CO')+'</td>':'<td>'+Number(r.saldo_ensamble||0).toLocaleString('es-CO')+'</td><td>'+Number(r.saldo_empaque||0).toLocaleString('es-CO')+'</td>')+'</tr>').join(''):'<tr><td colspan="'+(area?5:6)+'" class="empty">Sin saldos pendientes.</td></tr>';
 document.querySelector('#homeBalanceModal').dataset.week=String(week);document.querySelector('#homeBalanceModal').dataset.line=line||'';
 document.querySelector('#homeBalanceModal').hidden=false;
}
document.querySelector('#homeBalance')?.addEventListener('click',e=>{const card=e.target.closest('[data-home-balance-week]');if(!card)return;const area=e.target.closest('[data-home-area]');if(area){e.preventDefault();e.stopPropagation();openHomeBalanceDetail(Number(card.dataset.homeBalanceWeek),area.dataset.homeArea,area.dataset.homeLine);}});
document.querySelector('#homeBalanceModalSummary')?.addEventListener('click',e=>{const b=e.target.closest('[data-home-area]');if(!b)return;const m=document.querySelector('#homeBalanceModal'),week=Number(m.dataset.week);if(week)openHomeBalanceDetail(week,b.dataset.homeArea,m.dataset.line||null);});
document.querySelector('#closeHomeBalanceModal')?.addEventListener('click',()=>document.querySelector('#homeBalanceModal').hidden=true);
document.querySelectorAll("[data-home-view]").forEach(button => button.addEventListener("click", () => {
  const viewName=button.dataset.homeView;
  const navButton=document.querySelector('.nav [data-view="'+viewName+'"]');
  if(navButton && !navButton.hidden){navButton.click();return;}
  openView(viewName);
  if(viewName==='picking')loadPicking();
}));
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
 // Una selección nueva o la X de quitar archivo invalidan cualquier vista previa.
 els.aluminumFile?.addEventListener("change",()=>{
  aluminumTrackingRows=[];aluminumTrackingPreview=null;
  if(els.applyAluminumTracking)els.applyAluminumTracking.disabled=true;
  if(els.aluminumStatus)els.aluminumStatus.textContent="Archivo modificado. Vuelve a validar seguimiento.";
 });
 document.querySelector("#ncAlFile")?.addEventListener("change",()=>{
  ncAlRows=[];ncAlNewRows=[];ncAlPreview=null;
  const apply=document.querySelector("#applyNcAl"),status=document.querySelector("#ncAlStatus");
  if(apply)apply.disabled=true;
  if(status)status.textContent="Archivo modificado. Vuelve a validar NC Aluminio.";
 });
 document.querySelector("#ncGlassFile")?.addEventListener("change",()=>{
  ncGlassRows=[];ncGlassPreview=null;
  const apply=document.querySelector("#applyNcGlass"),status=document.querySelector("#ncGlassStatus");
  if(apply)apply.disabled=true;
  if(status)status.textContent="Archivo modificado. Vuelve a validar NC Vidrio.";
 });
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
refreshWeeklyTabs();
try {
  openView("inicio");
  renderMecanizado();
  refreshAuthStatus().then(()=>loadHomeBalances()).catch(error=>console.error("Error al validar sesión SGP ONE:",error));
} catch (error) { console.error("Error al iniciar SGP ONE:", error); }



async function previewNcAluminum(){
 const file=document.querySelector("#ncAlFile")?.files?.[0], status=document.querySelector("#ncAlStatus"), btn=document.querySelector("#applyNcAl");
 if(!file){status.textContent="Selecciona el Export NC Aluminio.";return}
 try{
  status.textContent="Leyendo y cruzando reservas con Programación…"; btn.disabled=true;
  ncAlRows=await readNcAluminumWorkbook(file);
  const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");
  const {data,error}=await client.rpc("sgp_previsualizar_nc_aluminio",{p_token:token,p_datos:ncAlRows}); if(error)throw error;
  const {data:newRows,error:newErr}=await client.rpc("sgp_previsualizar_nuevas_nc_aluminio",{p_token:token,p_datos:ncAlRows});if(newErr)throw newErr;ncAlNewRows=newRows||[];if(document.querySelector("#ncAlFile")?.files?.[0]!==file)return;ncAlPreview={...data,file:file.name};
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
 try{status.textContent="Leyendo NC Vidrio…";btn.disabled=true;ncGlassRows=await readNcGlassWorkbook(file);const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_previsualizar_nc_vidrio",{p_token:token,p_datos:ncGlassRows});if(error)throw error;if(document.querySelector("#ncGlassFile")?.files?.[0]!==file)return;ncGlassPreview={...data,file:file.name};document.querySelector("#ncGlassReceived").textContent=data.recibidos||0;document.querySelector("#ncGlassNew").textContent=data.nuevos||0;document.querySelector("#ncGlassUpdated").textContent=data.actualizados||0;document.querySelector("#ncGlassWeeks").textContent="Semana Maestro detectada: "+(data.por_semana||[]).join(", ");status.textContent="Validación completada. No se ha escrito información.";btn.disabled=false}catch(e){status.textContent="Validación rechazada ✕ "+e.message}}
async function applyNcGlass(){
 if(!ncGlassPreview)return;const status=document.querySelector("#ncGlassStatus"),btn=document.querySelector("#applyNcGlass");try{btn.disabled=true;status.textContent="Aplicando NC Vidrio…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_aplicar_nc_vidrio",{p_token:token,p_nombre_archivo:ncGlassPreview.file,p_datos:ncGlassRows});if(error)throw error;status.textContent=`NC Vidrio actualizado ✓ · ${data.nuevos} nuevas · ${data.actualizados} actualizadas`;const {data:ev,error:evErr}=await client.rpc("sgp_resumen_eventos_actualizacion",{p_token:token,p_id_lote:data.id_lote,p_fuente:"NC_VIDRIO"});if(evErr)throw evErr;window.ncGlassLoadEvents=ev||{};const sm=document.querySelector("#ncGlassChangeSummary");sm.hidden=false;document.querySelector("#ncgLoadNew").textContent=(ev.NUEVA||[]).length;document.querySelector("#ncgLoadClosed").textContent=(ev.FINALIZADA||[]).length;document.querySelector("#ncgLoadOpen").textContent=(ev.ABIERTA||[]).length}catch(e){status.textContent="Aplicación rechazada ✕ "+e.message;btn.disabled=false}}
document.querySelector("#previewNcGlass")?.addEventListener("click",previewNcGlass);document.querySelector("#applyNcGlass")?.addEventListener("click",applyNcGlass);

const ncGlassCols=[['semana_maestro','Sem. Maestro'],['consecutivo','NC'],['estado_nc','Estado'],['dias_abierta','Días'],['fecha_generacion_nc','Generación'],['semana_prod','Sem. Prod'],['oves','OVES'],['orden_sap','Orden SAP'],['item','Item'],['proyecto','Proyecto'],['sistema','Sistema'],['motivo','Motivo'],['linea_responsable','Línea responsable'],['linea_afectada','Línea afectada'],['linea_despacho','Línea despacho'],['cant_repo','Cant. repo'],['cant_recibida','Cant. recibida'],['mt_nc','MT NC'],['estado_auditado','Auditado'],['turno','Turno']];
let ncGlassSort={key:null,dir:1};
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
function renderAlTrackRows(rows){const h=document.querySelector("#alTrackHead"),b=document.querySelector("#alTrackBody"),cols=alVisible();if(!h||!b)return;h.innerHTML='<tr>'+cols.map(([k,l])=>'<th data-col-key="'+escapeHtml(k)+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+escapeHtml(k)+'"><span>'+escapeHtml(l)+(alTrackSort.key===k?(alTrackSort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join('')+'</tr>';let rr=rows.filter(r=>Object.entries(alTrackFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(String(r[k]??''))));if(alTrackSort.key)rr=[...rr].sort((x,y)=>String(x[alTrackSort.key]??'').localeCompare(String(y[alTrackSort.key]??''),undefined,{numeric:true})*alTrackSort.dir);b.innerHTML=rr.map(r=>'<tr>'+cols.map(([k])=>'<td>'+alEsc(r[k])+'</td>').join('')+'</tr>').join('');bindSheetFilters(h.closest("table"),()=>alTrackRows,cols.map(c=>({key:c[0],label:c[1]})),alTrackFilters,(k,d)=>{alTrackSort={key:k,dir:d};renderAlTrackRows(alTrackRows);renderAlCompact()},()=>renderAlTrackRows(alTrackRows));enableDraggableColumns(h.closest("table"))}
let alCompactFilters={},alCompactSort={key:null,dir:1},alCompactCache=[];
const alCompactCols=[['tipo_orden','Tipo'],['sistema','Sistema'],['acabado','Acabado'],['reserva','Reserva AL'],['cant_vent','Paneles'],['estado_operativo','Estado reserva'],['estado_mecanizado','Estado mecanizado']];
function alReservationState(rows){const vals=rows.map(r=>r.estado_operativo);if(vals.includes('OK / ENTREGADA EN SISTEMA'))return 'ALUMINIO ENTREGADO';if(vals.includes('RECIBIDA SIN LEGALIZAR'))return 'RECIBIDA SIN LEGALIZAR';if(vals.includes('PENDIENTE BODEGA'))return 'PENDIENTE BODEGA';if(vals.includes('PENDIENTE ABASTECIMIENTO'))return 'PENDIENTE ABASTECIMIENTO';return 'NO DISPONIBLE'}
function alMachState(rows){const s=rows.map(r=>String(r.estado_mecanizado||'SIN PROGRAMAR').toUpperCase());for(const x of ['PROCESADO','MECANIZADO','CORTE','PROGRAMADA'])if(s.includes(x))return x;return 'SIN PROGRAMAR'}
function alCompactData(){if(alCompactCache.length)return alCompactCache;const groups=new Map();alTrackRows.forEach(r=>{const k=String(r.reserva||'—');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});return alCompactCache=[...groups].map(([res,rows])=>({tipo_orden:[...new Set(rows.map(x=>x.tipo_orden||x.tipo).filter(Boolean))].join(' / ')||'—',sistema:[...new Set(rows.map(x=>x.sistema).filter(Boolean))].join(' / ')||'—',acabado:[...new Set(rows.map(x=>x.acabado).filter(Boolean))].join(' / ')||'—',reserva:res,cant_vent:rows.reduce((n,x)=>n+Number(x.cant_vent||0),0),estado_operativo:alReservationState(rows),estado_mecanizado:alMachState(rows)}))}
function alStateBadge(v){const cls={'ALUMINIO ENTREGADO':'al-badge-delivered','RECIBIDA SIN LEGALIZAR':'al-badge-received','PENDIENTE BODEGA':'al-badge-warehouse','PENDIENTE ABASTECIMIENTO':'al-badge-supply'}[v]||'al-badge-neutral';return '<span class="al-compact-badge '+cls+'">'+escapeHtml(v)+'</span>'}
function alMachBadge(v){return '<span class="prod-state '+prodStateClass(v)+'">'+escapeHtml(v)+'</span>'}
function renderAlCompact(){const host=document.querySelector('#alCompactBoard');if(!host)return;let rows=alCompactData().filter(r=>Object.entries(alCompactFilters).every(([k,v])=>!Array.isArray(v)||!v.length||v.includes(String(r[k]??''))));if(alCompactSort.key)rows=[...rows].sort((x,y)=>String(x[alCompactSort.key]??'').localeCompare(String(y[alCompactSort.key]??''),undefined,{numeric:true})*alCompactSort.dir);host.innerHTML='<table id="alCompactTable" class="nc-operational-table al-compact-table"><thead><tr>'+alCompactCols.map(([k,l])=>'<th data-col-key="'+k+'"><button type="button" class="sheet-filter-btn" data-sheet-filter="'+k+'"><span>'+escapeHtml(l)+(alCompactSort.key===k?(alCompactSort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+alCompactCols.map(([k])=>'<td>'+(k==='estado_operativo'?alStateBadge(r[k]):k==='estado_mecanizado'?alMachBadge(r[k]):escapeHtml(r[k]))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';const table=host.querySelector('table');bindSheetFilters(table,alCompactData,alCompactCols.map(c=>({key:c[0],label:c[1]})),alCompactFilters,(k,d)=>{alCompactSort={key:k,dir:d};renderAlCompact()},()=>renderAlCompact());enableDraggableColumns(table)}
function alCounts(state){const x=state?alTrackRows.filter(r=>{const op=String(r.estado_operativo||'');return state==='ALUMINIO_ENTREGADO'?op==='OK / ENTREGADA EN SISTEMA':op===state.replaceAll('_',' ')}):alTrackRows;return [new Set(x.map(r=>r.reserva)).size,x.reduce((n,r)=>n+(Number(r.cant_vent)||0),0)]}
async function loadAlTrack(){const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),sel=document.querySelector("#alTrackWeek"),week=sel?.value?Number(sel.value):null;const {data,error}=await client.rpc("sgp_consultar_seguimiento_aluminio",{p_token:token,p_semana:week});if(error){document.querySelector("#alTrackStatus").textContent="Error: "+error.message;return}alTrackRows=data.rows||[];alCompactCache=[];if(sel&&sel.options.length<=1)(data.semanas||[]).forEach(w=>sel.add(new Option("Semana "+w,w)));const total=alCounts(),ab=alCounts("PENDIENTE_ABASTECIMIENTO"),bo=alCounts("PENDIENTE_BODEGA"),en=alCounts("ALUMINIO_ENTREGADO");document.querySelector("#altTotal").textContent=total[0]+"/"+total[1];document.querySelector("#altSupply").textContent=ab[0]+"/"+ab[1];document.querySelector("#altWarehouse").textContent=bo[0]+"/"+bo[1];document.querySelector("#altDelivered").textContent=en[0]+"/"+en[1];document.querySelector("#alTrackStatus").textContent=(week?"Semana "+week:"Todas las semanas")+" · "+total[0]+" reservas / "+total[1]+" ventanas";if(!document.querySelector('#alCompactPanel')?.hidden)renderAlCompact();else renderAlTrackRows(alTrackRows)}
function openAlTrackState(state){const rows=state?alTrackRows.filter(r=>r.estado_reserva===state):alTrackRows,labels={PENDIENTE_ABASTECIMIENTO:"Pend. Abastecimiento",PENDIENTE_BODEGA:"Pend. Bodega",ALUMINIO_ENTREGADO:"Aluminio entregado"};document.querySelector("#alTrackModalTitle").textContent=state?labels[state]:"Total seguimiento";const rs=new Set(rows.map(r=>r.reserva)).size,pan=rows.reduce((n,r)=>n+(Number(r.cant_vent)||0),0);document.querySelector("#alTrackModalMeta").textContent=rs+" reservas / "+pan+" paneles";const b=document.querySelector("#alTrackModalBody");b.innerHTML=rows.map(r=>`<tr><td>${alEsc(r.semana_prog)}</td><td>${alEsc(r.id)}</td><td>${alEsc(r.produccion)}</td><td>${alEsc(r.reserva)}</td><td>${alEsc(r.estado_reserva_fuente||r.estado_reserva)}</td><td>${alEsc(r.estado_entrega_corte)}</td><td>${alEsc(r.proyecto)}</td><td>${alEsc(r.sistema)}</td></tr>`).join("");document.querySelector("#alTrackModal").hidden=false}
function renderAlPicker(){const p=document.querySelector("#alTrackColumnPicker");if(!p)return;p.innerHTML=alTrackCols.map(([k,l])=>`<label><input type="checkbox" data-altvisible="${k}" ${alHidden.has(k)?"":"checked"}> ${l}</label>`).join("");p.querySelectorAll("[data-altvisible]").forEach(x=>x.addEventListener("change",()=>{x.checked?alHidden.delete(x.dataset.altvisible):alHidden.add(x.dataset.altvisible);localStorage.setItem("sgp_alt_hidden_cols",JSON.stringify([...alHidden]));renderAlTrackRows(alTrackRows)}))}
document.querySelector('[data-view="seguimiento-aluminio"]')?.addEventListener("click",loadAlTrack);document.querySelector("#loadAlTrack")?.addEventListener("click",loadAlTrack);document.querySelector("#alTrackWeek")?.addEventListener("change",loadAlTrack);document.querySelector("#alTrackSummary")?.addEventListener("click",e=>{const c=e.target.closest("[data-alstate]");if(c)openAlTrackState(c.dataset.alstate)});document.querySelector("#closeAlTrackModal")?.addEventListener("click",()=>document.querySelector("#alTrackModal").hidden=true);document.querySelector("#alTrackChooseColumns")?.addEventListener("click",()=>{const p=document.querySelector("#alTrackColumnPicker");renderAlPicker();p.hidden=!p.hidden});

let repoRows=[],repoWeekSort='asc';
function repoRole(){return String(currentAuth?.rol||'').toUpperCase()}
function repoCanPatinadorEdit(){return ['PATINADOR','ADMINISTRADOR'].includes(repoRole())}
function repoCanSolution(){return ['COORDINADOR','ADMINISTRADOR'].includes(repoRole())}
function repoCanValidate(){return ['COORDINADOR','LIDER LINEA','SUPERVISOR DE PICKING','ADMINISTRADOR'].includes(repoRole())}
function repoCanState(){return ['COORDINADOR','LIDER MECANIZADO','LIDER','ADMINISTRADOR'].includes(repoRole())}
function repoIsActive(r){return r?.estado==='PENDIENTE'&&String(r?.estado_repo||'PENDIENTE')!=='PICKING'}
function repoIsValidated(r){return String(r?.validacion_estado||'POR_VALIDAR')==='VALIDADO'}
function repoValidationBadgeHtml(r,resolved=false){if(resolved&&!repoIsValidated(r))return '<span class="repo-validation-badge historical">HISTÓRICO</span>';return repoIsValidated(r)?'<span class="repo-validation-badge validated">✓ VALIDADO</span>':'<span class="repo-validation-badge pending">⚠ POR VALIDAR</span>'}
function repoStateBadgeHtml(r,resolved=false){const state=resolved?'PICKING':String(r?.estado_repo||'PENDIENTE'),label=state==='REPO_OK'?'REPO OK':state;return '<span class="repo-list-state '+String(state).toLowerCase()+'">'+escapeHtml(label)+'</span>'}
function repoFormatDate(v){if(!v)return'—';return String(v).replace('T',' ').slice(0,16)}
function repoSharedPairs(r){if(!r?.es_reserva_compartida)return [];const meta=sharedMetaForOrder({key_produccion:r.key_produccion,produccion:r.produccion},r.reserva_principal||r.reserva),rows=(meta?.reservas||[]).filter(x=>x?.reserva),seen=new Set(),out=[];rows.forEach(x=>{const reserva=String(x.reserva||'').trim(),acabado=String(x.acabado||'').trim(),k=reserva+'|'+acabado;if(reserva&&!seen.has(k)){seen.add(k);out.push({reserva,acabado})}});if(r.reserva&&!out.some(x=>x.reserva===String(r.reserva)&&x.acabado===String(r.acabado||'')))out.push({reserva:String(r.reserva),acabado:String(r.acabado||'')});return out}
function repoPairOptionsHtml(r){return repoSharedPairs(r).map(x=>{const value=encodeURIComponent(JSON.stringify(x)),sel=x.reserva===String(r.reserva||'')&&x.acabado===String(r.acabado||'');return '<option value="'+escapeHtml(value)+'" '+(sel?'selected':'')+'>'+escapeHtml(x.reserva)+' · '+escapeHtml(x.acabado||'ACABADO POR CONFIRMAR')+'</option>'}).join('')}
function repoReadPair(value,fallback){try{return JSON.parse(decodeURIComponent(value||''))}catch(_){return fallback||{}}}
function repoEncodePiece(p){return encodeURIComponent(JSON.stringify({marca:p.marca||'',fabricacion:p.fabricacion||'',longitud:p.longitud??null,acabado:p.acabado||'',cantidad:p.cantidad??0}))}
function repoDecodePiece(v){try{return JSON.parse(decodeURIComponent(v||''))}catch(_){return null}}
async function repoFetchPieces(r){const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_aluminio_pendiente_piezas',{p_token:getAppToken(),p_id:r.id_pendiente});if(error)throw error;return Array.isArray(data)?data:[]}
async function repoFetchHistory(r){const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_aluminio_pendiente_historial',{p_token:getAppToken(),p_id:r.id_pendiente});if(error)throw error;return Array.isArray(data)?data:[]}
function repoEnsureWorkModal(){let m=document.querySelector('#repoWorkModal');if(m)return m;m=document.createElement('div');m.id='repoWorkModal';m.className='piece-modal';m.hidden=true;m.innerHTML='<div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true"><div class="piece-modal-head"><div><span id="repoWorkEyebrow" class="eyebrow">Pendientes de aluminio</span><h2 id="repoWorkTitle">Pendiente</h2></div><button id="repoWorkClose" type="button">✕</button></div><div id="repoWorkMeta" class="piece-modal-meta"></div><div id="repoWorkBody" class="repo-work-body"></div><div id="repoWorkFooter" class="repo-work-footer"></div></div>';document.body.appendChild(m);m.querySelector('#repoWorkClose').onclick=()=>m.hidden=true;m.addEventListener('click',e=>{if(e.target===m)m.hidden=true});return m}
function repoShowWorkModal(title,meta,body,footer='',eyebrow='PENDIENTES DE ALUMINIO'){const m=repoEnsureWorkModal();m.querySelector('#repoWorkEyebrow').textContent=eyebrow;m.querySelector('#repoWorkTitle').textContent=title;m.querySelector('#repoWorkMeta').innerHTML=meta;m.querySelector('#repoWorkBody').innerHTML=body;m.querySelector('#repoWorkFooter').innerHTML=footer;m.hidden=false;return m}
function repoCloseWorkModal(){const m=document.querySelector('#repoWorkModal');if(m)m.hidden=true}
function repoPieceTableHtml(pieces,r){if(!pieces.length)return '<div class="repo-source-empty"><b>Sin piezas de referencia en la fuente de la orden</b><span>Se conserva el modo de captura manual para no bloquear registros históricos.</span></div>';let selected=pieces.findIndex(x=>String(x.fabricacion||'').toLowerCase()===String(r.fabricacion||'').toLowerCase()&&Number(x.longitud)===Number(r.longitud)&&(!r.acabado||String(x.acabado||'').toUpperCase()===String(r.acabado||'').toUpperCase()));if(selected<0)selected=pieces.findIndex(x=>x.seleccion_actual);if(selected<0&&pieces.length===1)selected=0;return '<div class="repo-piece-source"><div class="repo-piece-source-head"><div><b>Piezas de la orden</b><span>Selecciona la fabricación y longitud registradas para esta referencia.</span></div><strong>'+pieces.length+' opciones</strong></div><div class="repo-piece-table"><div class="repo-piece-head"><span>Sel.</span><span>Fabricación</span><span>Longitud (in)</span><span>Acabado</span><span>Cant.</span></div>'+pieces.map((p,i)=>'<label class="repo-piece-row '+(i===selected?'selected':'')+'"><span><input type="radio" name="repoPieceChoice" value="'+escapeHtml(repoEncodePiece(p))+'" '+(i===selected?'checked':'')+'></span><b>'+escapeHtml(p.fabricacion||'—')+'</b><span>'+escapeHtml(p.longitud??'—')+'</span><span>'+escapeHtml(p.acabado||'—')+'</span><span>'+escapeHtml(p.cantidad??0)+'</span></label>').join('')+'</div></div>'}
function repoBindPieceRows(m){m.querySelectorAll('.repo-piece-row input').forEach(inp=>inp.onchange=()=>{m.querySelectorAll('.repo-piece-row').forEach(x=>x.classList.remove('selected'));inp.closest('.repo-piece-row')?.classList.add('selected')})}
function repoSelectedPiece(m,r,pieces){const inp=m.querySelector('input[name="repoPieceChoice"]:checked');if(inp)return repoDecodePiece(inp.value);if(!pieces.length)return {fabricacion:r.fabricacion||'',longitud:r.longitud??null,acabado:r.acabado||'',marca:r.marca||''};return null}
function repoHistoryDetail(e){if(e.tipo_evento==='EDICION_PDT'&&e.datos_nuevos){const n=e.datos_nuevos;return ['NC '+(n.nc||'—'),'Fabricación '+(n.fabricacion||'—'),'Longitud '+(n.longitud??'—')].join(' · ')}if(e.tipo_evento==='VALIDACION_PDT'&&e.datos_nuevos){const n=e.datos_nuevos;return 'Validado · '+(n.fabricacion||'—')+' · '+(n.longitud??'—')+' · '+(n.acabado||'—')}if(e.tipo_evento==='RESERVA_SOLUCION'&&e.datos_nuevos)return 'Reserva solución '+(e.datos_nuevos.reserva_solucion_manual||'—');if(e.tipo_evento==='ESTADO_REPO')return (e.estado_anterior||'—')+' → '+(e.estado_nuevo||'—');return e.detalle||'—'}
function repoHistoryTableHtml(rows,limit=0){const list=limit?rows.slice(-limit):rows;if(!list.length)return '<div class="repo-source-empty"><b>Sin movimientos registrados</b></div>';return '<div class="repo-history-table"><div class="repo-history-head"><span>Fecha</span><span>Usuario</span><span>Acción</span><span>Detalle</span></div>'+list.map(e=>'<div class="repo-history-row"><span>'+escapeHtml(repoFormatDate(e.fecha))+'</span><b>'+escapeHtml(e.usuario||'—')+'</b><span>'+escapeHtml(e.accion||e.tipo_evento||'—')+'</span><span>'+escapeHtml(repoHistoryDetail(e))+'</span></div>').join('')+'</div>'}
function repoStateControlHtml(r,resolved=false){if(resolved)return '<span class="repo-resolved-badge">PICKING</span>';const state=String(r.estado_repo||'PENDIENTE');if(!repoCanState())return '<span class="repo-state-static">'+escapeHtml(state==='REPO_OK'?'REPO OK':state)+'</span>';if(!repoIsValidated(r))return '<span class="repo-state-static locked">🔒 '+escapeHtml(state==='REPO_OK'?'REPO OK':state)+'</span>';return '<select data-repo-window-state="'+r.id_pendiente+'">'+['PENDIENTE','REPO_OK','CORTE','MECANIZADO','PROCESADO','PICKING'].map(x=>'<option value="'+x+'" '+(state===x?'selected':'')+'>'+(x==='REPO_OK'?'REPO OK':x)+'</option>').join('')+'</select>'}
function repoActionItemsHtml(r,resolved=false){const active=!resolved&&repoIsActive(r),validated=repoIsValidated(r),items=[];if(active&&!validated&&(repoCanPatinadorEdit()||(repoCanSolution()&&!String(r.nc||'').trim())))items.push('<button type="button" data-repo-action="modify" data-repo-id="'+r.id_pendiente+'">✎ <span>Modificar</span></button>');if(active&&!validated&&repoCanValidate())items.push('<button type="button" data-repo-action="validate" data-repo-id="'+r.id_pendiente+'">✓ <span>Validar</span></button>');items.push('<button type="button" data-repo-action="detail" data-repo-id="'+r.id_pendiente+'">◉ <span>Ver detalle</span></button>','<button type="button" data-repo-action="history" data-repo-id="'+r.id_pendiente+'">◷ <span>Historial</span></button>');return items.join('')}
function repoActionMenuHtml(r,resolved=false){return '<button type="button" class="repo-action-toggle" data-repo-action-toggle="'+r.id_pendiente+'" data-repo-resolved="'+(resolved?'1':'0')+'">Acciones⌄</button>'}
function repoCloseActionPortal(){document.querySelector('#repoActionPortal')?.remove()}
function repoRunAction(action,id){const r=repoRows.find(x=>String(x.id_pendiente)===String(id));if(!r)return;repoCloseActionPortal();if(action==='modify')openRepoModify(r);else if(action==='validate')openRepoValidate(r);else if(action==='detail')openRepoPendingDetail(r);else if(action==='history')openRepoHistory(r)}
function repoOpenActionPortal(btn){repoCloseActionPortal();const r=repoRows.find(x=>String(x.id_pendiente)===String(btn.dataset.repoActionToggle));if(!r)return;const portal=document.createElement('div');portal.id='repoActionPortal';portal.className='repo-action-menu repo-action-portal';portal.innerHTML=repoActionItemsHtml(r,btn.dataset.repoResolved==='1');document.body.appendChild(portal);const rect=btn.getBoundingClientRect(),width=180;portal.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width))+'px';portal.style.top=(rect.bottom+5)+'px';requestAnimationFrame(()=>{const pr=portal.getBoundingClientRect();if(pr.bottom>window.innerHeight-8)portal.style.top=Math.max(8,rect.top-pr.height-5)+'px'});portal.querySelectorAll('[data-repo-action]').forEach(x=>x.onclick=e=>{e.stopPropagation();repoRunAction(x.dataset.repoAction,x.dataset.repoId)})}
async function loadRepoPending(){const body=document.querySelector('#repoBody'),resolved=document.querySelector('#repoResolvedBody');if(!body||!getAppToken())return;body.innerHTML='<tr><td colspan="16">Cargando pendientes…</td></tr>';if(resolved)resolved.innerHTML='<tr><td colspan="16">Cargando resueltos…</td></tr>';try{const db=await getSupabaseClient();await ensureSharedReservations();const {data,error}=await db.rpc('sgp_aluminio_pendientes_listar',{p_token:getAppToken(),p_solo_abiertos:false});if(error)throw error;repoRows=data||[];const ws=document.querySelector('#repoWeek'),keep=ws?.value||'';if(ws){const weeks=[...new Set(repoRows.map(r=>Number(r.semana)).filter(Number.isFinite))].sort((x,y)=>y-x);ws.innerHTML='<option value="">Todas las semanas</option>'+weeks.map(w=>'<option value="'+w+'">Semana '+w+'</option>').join('');ws.value=keep}renderRepoPending()}catch(e){body.innerHTML='<tr><td colspan="16">No fue posible cargar: '+escapeHtml(e.message)+'</td></tr>';if(resolved)resolved.innerHTML=''}}
function repoRowHtml(r,resolved=false){const meta=r.es_reserva_compartida?sharedMetaForOrder({key_produccion:r.key_produccion,produccion:r.produccion},r.reserva_principal||r.reserva):null;const shared=r.es_reserva_compartida?'<div class="shared-cell-note">'+sharedBadgeHtml(meta||{es_reserva_compartida:true,reservas:[{reserva:r.reserva_principal||r.reserva,tipo:'PRINCIPAL'},{reserva:r.reserva,tipo:'ASOCIADA',acabado:r.acabado,es_principal_compartida:true}]})+'<small>Principal: '+escapeHtml(r.reserva_principal||r.reserva||'—')+' · Pendiente asociado a: '+escapeHtml(r.reserva||'—')+'</small></div>':'';return '<tr data-repo-id="'+escapeHtml(r.id_pendiente)+'" class="repo-row repo-'+String(r.estado_repo||'PENDIENTE').toLowerCase()+' '+(r.es_reserva_compartida?'shared-row':'')+'"><td><b class="pending-week-badge">SEM '+escapeHtml(r.semana||'—')+'</b></td><td><b>'+escapeHtml(r.produccion||'—')+'</b>'+shared+'</td><td>'+escapeHtml(r.reserva||'—')+'</td><td><b>'+escapeHtml(r.perfil||'—')+'</b></td><td>'+escapeHtml(r.acabado||'—')+'</td><td>'+escapeHtml(r.marca||'—')+'</td><td>'+escapeHtml(r.fabricacion||'—')+'</td><td>'+escapeHtml(r.longitud??'—')+'</td><td>'+escapeHtml(r.cantidad??0)+'</td><td>'+escapeHtml(r.nc||'—')+'</td><td>'+(r.nc_enlazada?'<span class="nc-linked">✓ ENLAZADA</span>':'<span class="nc-unlinked">SIN ENLACE</span>')+'</td><td><span class="nc-status nc-'+String(r.estado_nc||'sin').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'">'+escapeHtml(r.estado_nc||'—')+'</span></td><td>'+repoValidationBadgeHtml(r,resolved)+'</td><td>'+escapeHtml(r.observacion||'—')+'</td><td>'+repoStateControlHtml(r,resolved)+'</td><td>'+repoActionMenuHtml(r,resolved)+'</td></tr>'}
function renderRepoPending(){const body=document.querySelector('#repoBody'),resolvedBody=document.querySelector('#repoResolvedBody'),q=(document.querySelector('#repoSearch')?.value||'').toLowerCase(),st=document.querySelector('#repoState')?.value||'',wk=document.querySelector('#repoWeek')?.value||'';if(!body)return;repoCloseActionPortal();let filtered=repoRows.filter(r=>(!wk||String(r.semana||'')===wk)&&(!st||r.estado_repo===st)&&(!q||[r.produccion,r.reserva,r.reserva_solucion,r.acabado,r.perfil,r.nc,r.marca,r.fabricacion].some(v=>String(v||'').toLowerCase().includes(q))));filtered=[...filtered].sort((a,b)=>{const aw=Number(a.semana),bw=Number(b.semana),av=Number.isFinite(aw)?aw:9999,bv=Number.isFinite(bw)?bw:9999;if(av!==bv)return repoWeekSort==='asc'?av-bv:bv-av;return String(a.produccion||'').localeCompare(String(b.produccion||''),undefined,{numeric:true})});const active=filtered.filter(r=>r.estado==='PENDIENTE'&&r.estado_repo!=='PICKING'),resolved=filtered.filter(r=>r.estado==='RESUELTO'||r.estado_repo==='PICKING');const sm=document.querySelector('#repoSummary');if(sm)sm.innerHTML='<div><span>Abiertos</span><b>'+active.length+'</b></div><div><span>Por validar</span><b>'+active.filter(r=>!repoIsValidated(r)).length+'</b></div><div><span>Repo OK</span><b>'+active.filter(r=>r.estado_repo==='REPO_OK').length+'</b></div><div><span>En proceso</span><b>'+active.filter(r=>['CORTE','MECANIZADO','PROCESADO'].includes(r.estado_repo)).length+'</b></div><div><span>Resueltos</span><b>'+resolved.length+'</b></div>';body.innerHTML=active.length?active.map(r=>repoRowHtml(r,false)).join(''):'<tr><td colspan="16" class="empty">Sin pendientes activos con estos filtros.</td></tr>';if(resolvedBody)resolvedBody.innerHTML=resolved.length?resolved.map(r=>repoRowHtml(r,true)).join(''):'<tr><td colspan="16" class="empty">Sin pendientes resueltos con estos filtros.</td></tr>';document.querySelectorAll('#repoBody .repo-row,#repoResolvedBody .repo-row').forEach(tr=>{tr.style.cursor='pointer';tr.onclick=e=>{if(e.target.closest('select,button,a,input,textarea'))return;const r=repoRows.find(x=>String(x.id_pendiente)===String(tr.dataset.repoId));if(r)openRepoPendingDetail(r)}});document.querySelectorAll('[data-repo-action-toggle]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();repoOpenActionPortal(btn)});document.querySelectorAll('[data-repo-window-state]').forEach(sel=>sel.onchange=async()=>{const previous=repoRows.find(x=>String(x.id_pendiente)===String(sel.dataset.repoWindowState))?.estado_repo||'PENDIENTE';try{const db=await getSupabaseClient(),{error}=await db.rpc('sgp_aluminio_pendiente_estado',{p_token:getAppToken(),p_id:sel.dataset.repoWindowState,p_estado:sel.value,p_observacion:null});if(error)throw error;await loadRepoPending()}catch(e){alert(e.message);sel.value=previous}})}
document.addEventListener('click',e=>{if(!e.target.closest('#repoActionPortal,[data-repo-action-toggle]'))repoCloseActionPortal()});
window.addEventListener('resize',repoCloseActionPortal);
window.addEventListener('scroll',repoCloseActionPortal,true);

async function openRepoModify(r){if(!repoIsActive(r)||repoIsValidated(r))return;let pieces=[];try{pieces=await repoFetchPieces(r)}catch(e){alert('No fue posible cargar las piezas de la orden: '+e.message);return}const canEdit=repoCanPatinadorEdit(),canSolution=repoCanSolution()&&!String(r.nc||'').trim();const ncBox=canEdit?'<div class="repo-compact-field"><label>NC asociada</label><div class="repo-inline-input"><input id="repoEditNc" value="'+escapeHtml(r.nc||'')+'" placeholder="Escribir NC"><button id="repoNcSearch" type="button">⌕ Buscar NC</button></div><div id="repoNcSearchResult" class="repo-field-note">'+(r.nc_enlazada?'<span class="ok">✓ NC enlazada · '+escapeHtml(r.estado_nc||'')+'</span>':'Escribe una NC y pulsa Buscar NC para verificarla.')+'</div></div>':'<div class="repo-compact-field"><label>NC asociada</label><b>'+escapeHtml(r.nc||'—')+'</b></div>';let solBox;if(String(r.nc||'').trim())solBox='<div class="repo-compact-field"><label>Reserva solución</label><b>'+escapeHtml(r.reserva_solucion||'—')+'</b><div class="repo-field-note">'+(r.origen_reserva_solucion==='NC'?'Proviene de la NC enlazada.':'Se gestionará desde la NC asociada.')+'</div></div>';else if(canSolution)solBox='<div class="repo-compact-field"><label>Reserva solución · Coordinación</label><input id="repoSolutionInput" value="'+escapeHtml(r.reserva_solucion_manual||'')+'" placeholder="Escribir reserva solución"><div class="repo-field-note">Disponible porque el pendiente no tiene NC.</div></div>';else solBox='<div class="repo-compact-field"><label>Reserva solución</label><b>'+escapeHtml(r.reserva_solucion||'—')+'</b><div class="repo-field-note">Asignación disponible para Coordinación cuando no exista NC.</div></div>';const editSection=canEdit?'<section class="repo-modal-section"><div class="repo-section-head"><div><span>PATINADOR</span><h3>Datos del pendiente</h3></div><b>EDITABLE HASTA VALIDAR</b></div>'+(r.es_reserva_compartida?'<label class="repo-pair-field">Reserva + acabado · RESERVA COMPARTIDA<select id="repoEditPair">'+repoPairOptionsHtml(r)+'</select></label>':'')+repoPieceTableHtml(pieces,r)+(pieces.length?'':'<div class="repo-fallback-grid"><label>Fabricación<input id="repoFallbackFab" value="'+escapeHtml(r.fabricacion||'')+'"></label><label>Longitud<input id="repoFallbackLength" type="number" step="0.0001" value="'+escapeHtml(r.longitud??'')+'"></label></div>')+'<label class="repo-observation-field">Observación de corrección (opcional)<textarea id="repoEditObservation" rows="2" placeholder="Detalle de la corrección…"></textarea></label></section>':'<section class="repo-modal-section readonly"><div class="repo-section-head"><div><span>DATOS DEL PDT</span><h3>'+escapeHtml(r.fabricacion||'—')+' · '+escapeHtml(r.longitud??'—')+' in · '+escapeHtml(r.acabado||'—')+'</h3></div></div></section>';const meta='Semana '+escapeHtml(r.semana||'—')+' · Reserva '+escapeHtml(r.reserva||'—')+' · PDT '+escapeHtml(r.cantidad||0)+' '+repoValidationBadgeHtml(r,false);const m=repoShowWorkModal('Modificar pendiente · '+(r.produccion||r.reserva||'—'),meta,'<div class="repo-compact-top">'+ncBox+solBox+'</div>'+editSection,'<button type="button" data-repo-cancel>Cancelar</button><button id="repoModifySave" class="primary" type="button">Guardar cambios</button>');repoBindPieceRows(m);m.querySelector('[data-repo-cancel]').onclick=repoCloseWorkModal;m.querySelector('#repoNcSearch')?.addEventListener('click',async()=>{const nc=m.querySelector('#repoEditNc')?.value.trim(),out=m.querySelector('#repoNcSearchResult');if(!nc){out.textContent='Escribe una NC para buscar.';return}out.textContent='Buscando…';try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_aluminio_nc_buscar',{p_token:getAppToken(),p_nc:nc});if(error)throw error;out.innerHTML=data?.encontrada?'<span class="ok">✓ '+escapeHtml(data.consecutivo||data.cod_nc||nc)+' · '+escapeHtml(data.estado||'—')+(data.reserva_solucion?' · Reserva solución '+escapeHtml(data.reserva_solucion):'')+'</span>':'<span class="warn">NC no encontrada en la carga actual. Se puede guardar, pero quedará SIN ENLACE.</span>'}catch(e){out.textContent=e.message}});m.querySelector('#repoModifySave').onclick=async()=>{const btn=m.querySelector('#repoModifySave');btn.disabled=true;try{const db=await getSupabaseClient();if(canEdit){let piece=repoSelectedPiece(m,r,pieces);if(!piece&&pieces.length)throw new Error('Selecciona una fabricación y longitud de la orden.');if(!pieces.length)piece={fabricacion:m.querySelector('#repoFallbackFab')?.value||r.fabricacion,longitud:Number(m.querySelector('#repoFallbackLength')?.value)||r.longitud,acabado:r.acabado};let pair={reserva:r.reserva,acabado:r.acabado};if(r.es_reserva_compartida)pair=repoReadPair(m.querySelector('#repoEditPair')?.value,pair);const nc=m.querySelector('#repoEditNc')?.value||null,{error}=await db.rpc('sgp_aluminio_pendiente_editar_v2',{p_token:getAppToken(),p_id:r.id_pendiente,p_nc:nc,p_fabricacion:piece.fabricacion||null,p_longitud:Number(piece.longitud)||null,p_reserva:pair.reserva||r.reserva,p_acabado:r.es_reserva_compartida?(pair.acabado||piece.acabado||null):null,p_observacion:m.querySelector('#repoEditObservation')?.value||null});if(error)throw error;if(repoCanSolution()&&!String(nc||'').trim()&&m.querySelector('#repoSolutionInput')){const {error:se}=await db.rpc('sgp_aluminio_pendiente_reserva_solucion',{p_token:getAppToken(),p_id:r.id_pendiente,p_reserva_solucion:m.querySelector('#repoSolutionInput').value||null});if(se)throw se}}else if(canSolution){const {error}=await db.rpc('sgp_aluminio_pendiente_reserva_solucion',{p_token:getAppToken(),p_id:r.id_pendiente,p_reserva_solucion:m.querySelector('#repoSolutionInput')?.value||null});if(error)throw error}repoCloseWorkModal();await loadRepoPending()}catch(e){alert(e.message);btn.disabled=false}}}

async function openRepoValidate(r){if(!repoCanValidate()||!repoIsActive(r)||repoIsValidated(r))return;let pieces=[];try{pieces=await repoFetchPieces(r)}catch(e){alert('No fue posible cargar las piezas de la orden: '+e.message);return}const meta='Semana '+escapeHtml(r.semana||'—')+' · Reserva '+escapeHtml(r.reserva||'—')+' · PDT '+escapeHtml(r.cantidad||0)+' '+repoValidationBadgeHtml(r,false);const nc='<div><span>NC</span><b>'+escapeHtml(r.nc||'—')+'</b>'+(r.nc_enlazada?'<small class="repo-inline-ok">✓ ENLAZADA</small>':'')+'</div><div><span>Estado NC</span><b>'+escapeHtml(r.estado_nc||'—')+'</b></div><div><span>Reserva solución</span><b>'+escapeHtml(r.reserva_solucion||'—')+'</b><small>'+escapeHtml(r.origen_reserva_solucion==='NC'?'Proviene de NC':r.origen_reserva_solucion==='MANUAL'?'Manual':'Sin asignar')+'</small></div><div><span>Referencia</span><b>'+escapeHtml(r.perfil||'—')+'</b></div>';const pair=r.es_reserva_compartida?'<label class="repo-pair-field">Reserva + acabado<select id="repoValidatePair">'+repoPairOptionsHtml(r)+'</select></label>':'';const fallback=pieces.length?'':'<div class="repo-fallback-grid"><label>Fabricación<input id="repoFallbackFab" value="'+escapeHtml(r.fabricacion||'')+'"></label><label>Longitud<input id="repoFallbackLength" type="number" step="0.0001" value="'+escapeHtml(r.longitud??'')+'"></label><label>Acabado<input id="repoFallbackFinish" value="'+escapeHtml(r.acabado||'')+'"></label></div>';const body='<div class="repo-validate-summary">'+nc+'</div><section class="repo-modal-section validation"><div class="repo-section-head"><div><span>DATOS A CONFIRMAR</span><h3>Confirma la pieza correcta antes de mecanizado</h3></div><b>REQUERIDO</b></div>'+pair+repoPieceTableHtml(pieces,r)+fallback+'<div class="repo-validation-note">Confirma que fabricación, longitud y acabado corresponden al pendiente. Una vez validado, Mecanizado podrá continuar el flujo físico.</div><label class="repo-observation-field">Observación de validación (opcional)<textarea id="repoValidateObservation" rows="2" placeholder="Ingrese observación…"></textarea></label></section>';const m=repoShowWorkModal('Validar pendiente · '+(r.produccion||r.reserva||'—'),meta,body,'<button type="button" data-repo-cancel>Cancelar</button><button id="repoValidateSave" class="success" type="button">✓ Validar pendiente</button>');repoBindPieceRows(m);m.querySelector('[data-repo-cancel]').onclick=repoCloseWorkModal;m.querySelector('#repoValidateSave').onclick=async()=>{const btn=m.querySelector('#repoValidateSave');btn.disabled=true;try{let piece=repoSelectedPiece(m,r,pieces);if(!piece&&pieces.length)throw new Error('Selecciona la fabricación y longitud que vas a validar.');if(!pieces.length)piece={fabricacion:m.querySelector('#repoFallbackFab')?.value||r.fabricacion,longitud:Number(m.querySelector('#repoFallbackLength')?.value)||r.longitud,acabado:m.querySelector('#repoFallbackFinish')?.value||r.acabado};let pair={reserva:r.reserva,acabado:piece.acabado||r.acabado};if(r.es_reserva_compartida)pair=repoReadPair(m.querySelector('#repoValidatePair')?.value,pair);if(r.es_reserva_compartida&&pair.acabado&&piece.acabado&&String(pair.acabado).toUpperCase()!==String(piece.acabado).toUpperCase())throw new Error('La pieza seleccionada no corresponde al acabado de la reserva compartida elegida.');const db=await getSupabaseClient(),{error}=await db.rpc('sgp_aluminio_pendiente_validar',{p_token:getAppToken(),p_id:r.id_pendiente,p_fabricacion:piece.fabricacion||null,p_longitud:Number(piece.longitud)||null,p_reserva:pair.reserva||r.reserva,p_acabado:pair.acabado||piece.acabado||r.acabado||null,p_observacion:m.querySelector('#repoValidateObservation')?.value||null});if(error)throw error;repoCloseWorkModal();await loadRepoPending()}catch(e){alert(e.message);btn.disabled=false}}}

async function openRepoPendingDetail(r){let history=[];try{history=await repoFetchHistory(r)}catch(e){console.warn('Historial PDT',e)}const resolved=!repoIsActive(r),validated=repoIsValidated(r),meta='Semana '+escapeHtml(r.semana||'—')+' · Reserva '+escapeHtml(r.reserva||'—')+' · PDT '+escapeHtml(r.cantidad||0)+' '+repoValidationBadgeHtml(r,resolved);const body='<div class="repo-detail-grid compact"><div><span>Referencia</span><b>'+escapeHtml(r.perfil||'—')+'</b></div><div><span>NC</span><b>'+escapeHtml(r.nc||'—')+'</b>'+(r.nc_enlazada?'<small class="repo-inline-ok">✓ ENLAZADA</small>':'')+'</div><div><span>Reserva solución</span><b>'+escapeHtml(r.reserva_solucion||'—')+'</b><small>'+escapeHtml(r.origen_reserva_solucion==='NC'?'Proviene de NC':r.origen_reserva_solucion==='MANUAL'?'Manual':'Sin asignar')+'</small></div><div><span>Estado NC</span><b>'+escapeHtml(r.estado_nc||'—')+'</b></div><div><span>Fabricación</span><b>'+escapeHtml(r.fabricacion||'—')+'</b></div><div><span>Longitud (in)</span><b>'+escapeHtml(r.longitud??'—')+'</b></div><div><span>Acabado</span><b>'+escapeHtml(r.acabado||'—')+'</b></div><div><span>Cantidad</span><b>'+escapeHtml(r.cantidad??0)+'</b></div><div><span>Origen</span><b>'+escapeHtml(r.origen||'—')+'</b></div><div><span>Estado PDT</span><b>'+escapeHtml(r.estado_repo||'PENDIENTE')+'</b></div><div><span>Reportado por</span><b>'+escapeHtml(r.reportado_por||'—')+'</b></div><div><span>Fecha reporte</span><b>'+escapeHtml(repoFormatDate(r.fecha_reporte))+'</b></div>'+(validated?'<div><span>Validado por</span><b>'+escapeHtml(r.validado_por||'—')+'</b></div><div><span>Fecha validación</span><b>'+escapeHtml(repoFormatDate(r.fecha_validacion))+'</b></div>':'')+'<div class="repo-detail-wide"><span>Observación</span><b>'+escapeHtml(r.observacion||'—')+'</b></div>'+(validated&&r.observacion_validacion?'<div class="repo-detail-wide"><span>Observación de validación</span><b>'+escapeHtml(r.observacion_validacion)+'</b></div>':'')+'</div><section class="repo-modal-section history-preview"><div class="repo-section-head"><div><span>TRAZABILIDAD</span><h3>Últimos movimientos</h3></div></div>'+repoHistoryTableHtml(history,5)+'</section>';const m=repoShowWorkModal('Detalle del pendiente · '+(r.produccion||r.reserva||'—'),meta,body,'<button type="button" data-repo-history>Ver historial completo</button><button type="button" class="primary" data-repo-cancel>Cerrar</button>');m.querySelector('[data-repo-cancel]').onclick=repoCloseWorkModal;m.querySelector('[data-repo-history]').onclick=()=>openRepoHistory(r)}
async function openRepoHistory(r){let history;try{history=await repoFetchHistory(r)}catch(e){alert('No fue posible cargar el historial: '+e.message);return}const m=repoShowWorkModal('Historial · '+(r.produccion||r.reserva||'—'),'Reserva '+escapeHtml(r.reserva||'—')+' · '+escapeHtml(r.perfil||'—'),'<section class="repo-modal-section"><div class="repo-section-head"><div><span>TRAZABILIDAD DEL PDT</span><h3>'+history.length+' movimientos registrados</h3></div></div>'+repoHistoryTableHtml(history)+'</section>','<button type="button" class="primary" data-repo-cancel>Cerrar</button>');m.querySelector('[data-repo-cancel]').onclick=repoCloseWorkModal}
function openRepoState(r){if(!repoCanState()||!repoIsActive(r)||!repoIsValidated(r))return;const states=['PENDIENTE','REPO_OK','CORTE','MECANIZADO','PROCESADO','PICKING'];const m=repoShowWorkModal('Actualizar estado · '+(r.produccion||r.reserva||'—'),'PDT VALIDADO · Estado actual '+escapeHtml(r.estado_repo||'PENDIENTE'),'<section class="repo-modal-section"><div class="repo-section-head"><div><span>FLUJO FÍSICO</span><h3>Estado de la reposición</h3></div></div><label class="repo-pair-field">Nuevo estado<select id="repoStateSelect">'+states.map(x=>'<option value="'+x+'" '+(String(r.estado_repo||'PENDIENTE')===x?'selected':'')+'>'+(x==='REPO_OK'?'REPO OK':x)+'</option>').join('')+'</select></label><label class="repo-observation-field">Observación (opcional)<textarea id="repoStateObservation" rows="2"></textarea></label></section>','<button type="button" data-repo-cancel>Cancelar</button><button id="repoStateSave" class="primary" type="button">Guardar estado</button>');m.querySelector('[data-repo-cancel]').onclick=repoCloseWorkModal;m.querySelector('#repoStateSave').onclick=async()=>{const btn=m.querySelector('#repoStateSave');btn.disabled=true;try{const db=await getSupabaseClient(),{error}=await db.rpc('sgp_aluminio_pendiente_estado',{p_token:getAppToken(),p_id:r.id_pendiente,p_estado:m.querySelector('#repoStateSelect').value,p_observacion:m.querySelector('#repoStateObservation').value||null});if(error)throw error;repoCloseWorkModal();await loadRepoPending()}catch(e){alert(e.message);btn.disabled=false}}}
document.querySelector('[data-view="pendientes-aluminio"]')?.addEventListener('click',loadRepoPending);
document.querySelector('#repoRefresh')?.addEventListener('click',loadRepoPending);
document.querySelector('#repoSearch')?.addEventListener('input',renderRepoPending);
document.querySelector('#repoState')?.addEventListener('change',renderRepoPending);
document.querySelector('#repoWeek')?.addEventListener('change',renderRepoPending);
document.querySelectorAll('[data-repo-week-sort]').forEach(b=>b.addEventListener('click',()=>{repoWeekSort=repoWeekSort==='asc'?'desc':'asc';document.querySelectorAll('[data-repo-week-sort]').forEach(x=>x.textContent='Sem. '+(repoWeekSort==='asc'?'↑':'↓'));renderRepoPending()}));
let prRows=[],prReservations=[],prCurrent=null,prNumber=1,prParts=1,prActivePart="",prAssign={},prChildren=[],prEditParent=null,prOriginal={};
const prE=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
async function openPriorityWizard(){const year=Number(document.querySelector("#queryYear").value),week=Number(document.querySelector("#queryWeek").value),line=document.querySelector("#queryLine").value||"PANELES_2";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_datos_asignacion_prioridades",{p_token:token,p_anio:year,p_semana:week,p_linea:line});if(error){alert(error.message);return}prRows=data.rows||[];const m=new Map;prRows.forEach(r=>{(()=>{const res=String(r.reserva||"").split(",")[0].trim();if(res){if(!m.has(res))m.set(res,[]);m.get(res).push(r)}})()});prReservations=[...m].map(([reserva,rows])=>({reserva,rows,tipo:rows[0]?.tipo||"",sistema:[...new Set(rows.map(x=>x.sistema).filter(Boolean))].join(", "),acabado:[...new Set(rows.map(x=>x.acabado).filter(Boolean))].join(", "),paneles:rows.reduce((n,x)=>n+(Number(x.cantidad)||0),0),assigned:rows.some(x=>x.prioridad&&x.prioridad_reserva===reserva)}));prNumber=getNextPriorityNumber();document.querySelector("#priorityModal").hidden=false;renderPrList()}
function getNextPriorityNumber(){const nums=prReservations.flatMap(x=>x.rows.filter(r=>r.prioridad&&r.prioridad_reserva===x.reserva).map(r=>Number(String(r.prioridad).split(".")[0]))).filter(Number.isFinite);return nums.length?Math.max(...nums)+1:1}
function renderPrList(){const el=document.querySelector("#priorityReservationList"),done=document.querySelector("#priorityAssignedList");document.querySelector("#priorityWorkModal").hidden=true;el.hidden=false;done.hidden=false;const pending=prReservations.map((x,i)=>({...x,_i:i})).filter(x=>!x.assigned),assigned=prReservations.filter(x=>x.assigned);document.querySelector("#priorityStatus").textContent=prReservations.length+" reservas · Prioridad "+prNumber+" · "+assigned.length+" asignadas · "+pending.length+" pendientes";const ruleNote="Reserva principal: en producciones con varias reservas, las unidades se contabilizan únicamente en la primera reserva del campo Export.";el.innerHTML='<h3>Reservas pendientes</h3><p class="priority-main-reservation-note">'+prE(ruleNote)+'</p><div class="table-wrap"><table class="nc-operational-table"><thead><tr><th>Tipo</th><th>Sistema</th><th>Acabado</th><th>Reserva AL</th><th>Paneles</th><th></th></tr></thead><tbody>'+pending.map(x=>`<tr><td>${prE(x.tipo)}</td><td>${prE(x.sistema)}</td><td>${prE(x.acabado)}</td><td>${prE(x.reserva)}</td><td>${x.paneles}</td><td><button data-prres="${x._i}">Asignar ${prNumber}</button></td></tr>`).join("")+"</tbody></table></div>";el.querySelectorAll("[data-prres]").forEach(b=>b.onclick=()=>startPr(Number(b.dataset.prres)));done.innerHTML='<h3>Prioridades asignadas</h3><div class="table-wrap"><table class="nc-operational-table"><thead><tr><th>Prioridad</th><th>Tipo</th><th>Reserva AL</th><th>Sistema</th><th>Acabado</th><th>Paneles</th><th>Producciones</th></tr></thead><tbody>'+assigned.sort((a,b)=>String(a.rows.map(r=>r.prioridad).sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}))[0]).localeCompare(String(b.rows.map(r=>r.prioridad).sort((x,y)=>String(x).localeCompare(String(y),undefined,{numeric:true}))[0]),undefined,{numeric:true})).map(x=>{const ps=[...new Set(x.rows.filter(r=>r.prioridad_reserva===x.reserva).map(r=>r.prioridad).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));return `<tr><td><strong>${ps.join(", ")}</strong></td><td>${prE(x.tipo)}</td><td>${prE(x.reserva)}</td><td>${prE(x.sistema)}</td><td>${prE(x.acabado)}</td><td>${x.paneles}</td><td>${x.rows.length}</td></tr>`}).join("")+"</tbody></table></div>";enhancePrAssignedList()}function startPr(i){prCurrent=prReservations[i];prAssign={};prChildren=[];prEditParent=null;prOriginal={};prParts=1;prActivePart=String(prNumber);document.querySelector("#priorityParts").innerHTML="";document.querySelector("#priorityPartSummary").innerHTML="";document.querySelector("#priorityProductionBody").innerHTML="";document.querySelector("#priorityWorkModal").hidden=false;document.querySelector("#priorityWorkTitle").textContent="Prioridad "+prNumber+" · Reserva "+prCurrent.reserva;const project=/proyecto/i.test(prCurrent.tipo);document.querySelector("#priorityQuestion").innerHTML=`<h3>Prioridad ${prNumber} · Reserva ${prE(prCurrent.reserva)}</h3><p>${prE(prCurrent.tipo)} · ${prCurrent.paneles} paneles</p>`+(project?'<p><strong>Proyecto:</strong> la reserva se asignará completa y no puede dividirse.</p>':'<p>¿Deseas dividir esta reserva?</p>');const existingRule=document.querySelector("#priorityMainReservationRule");if(existingRule)existingRule.remove();const rule=document.createElement("p");rule.id="priorityMainReservationRule";rule.className="priority-main-reservation-note";rule.textContent="Las producciones con reservas múltiples se asignan solo a la primera reserva indicada en el Export. No se duplican unidades en otras reservas.";document.querySelector("#priorityQuestion").appendChild(rule);const a=document.querySelector("#priorityActions");a.innerHTML=project?'<button data-div="1">Asignar completa</button>':'<button data-div="1">No dividir</button><button data-div="ask">Sí, dividir</button>';a.querySelectorAll("[data-div]").forEach(b=>b.onclick=()=>b.dataset.div==="ask"?askPrParts():setPrParts(1));if(project)setPrParts(1);else renderPrUnassigned()}
function renderPrUnassigned(){const b=document.querySelector("#priorityProductionBody");b.innerHTML=[...prCurrent.rows].map(r=>`<tr><td>—</td><td>${prE(r.id)}</td><td>${prE(r.produccion)}</td><td>${prE(r.cantidad)}</td><td>${prE(r.tipo_vidrio)}</td><td>${prE(r.sistema)}</td><td>${prE(r.acabado)}</td></tr>`).join("")}
function askPrParts(){const n=Number(prompt("¿En cuántas partes deseas dividir la prioridad "+prNumber+"?","2"));if(n>=2&&n<=20)setPrParts(n)}
function setPrParts(n){prParts=n;prAssign={};prChildren=[];prEditParent=null;prOriginal={};if(n===1){prCurrent.rows.forEach(r=>prAssign[r.key_produccion]=String(prNumber));prActivePart=String(prNumber)}else prActivePart=prNumber+".1";renderPrParts();renderPrProductions()}
function renderPrParts(){const e=document.querySelector("#priorityParts");e.innerHTML=prParts===1?"":Array.from({length:prParts},(_,i)=>`<button class="${prActivePart===prNumber+"."+(i+1)?"active":""}" data-prpart="${prNumber}.${i+1}">${prNumber}.${i+1}</button>`).join("");e.querySelectorAll("[data-prpart]").forEach(b=>b.onclick=()=>{prActivePart=b.dataset.prpart;renderPrParts();renderPrProductions()});enhancePrParts()}
function renderPrPartSummary(){const e=document.querySelector("#priorityPartSummary");if(!e)return;const parts=prParts===1?[String(prNumber)]:Array.from({length:prParts},(_,i)=>prNumber+"."+(i+1));e.innerHTML=parts.map(p=>{const rows=prCurrent.rows.filter(r=>prAssign[r.key_produccion]===p),pan=rows.reduce((n,r)=>n+(Number(r.cantidad)||0),0);return `<div class="daily-metric-card"><small>Prioridad ${p}</small><strong>${pan}</strong><span>ventanas · ${rows.length} producciones</span></div>`}).join("");enhancePrSummary()}function renderPrProductions(){renderPrPartSummary();const b=document.querySelector("#priorityProductionBody");b.innerHTML=[...prCurrent.rows].sort((a,z)=>String(prAssign[a.key_produccion]||"999").localeCompare(String(prAssign[z.key_produccion]||"999"),undefined,{numeric:true})).map(r=>`<tr data-prprod="${prE(r.key_produccion)}" data-part-index="${String(prAssign[r.key_produccion]||"").includes(".")?String(prAssign[r.key_produccion]).split(".")[1]:""}"><td>${prE(prAssign[r.key_produccion]||"—")}</td><td>${prE(r.id)}</td><td>${prE(r.produccion)}</td><td>${prE(r.cantidad)}</td><td>${prE(r.tipo_vidrio)}</td><td>${prE(r.sistema)}</td><td>${prE(r.acabado)}</td></tr>`).join("");if(prParts>1)b.querySelectorAll("[data-prprod]").forEach(tr=>tr.onclick=()=>{if(prEditParent&&prOriginal[tr.dataset.prprod]!==prEditParent)return;prAssign[tr.dataset.prprod]=prActivePart;renderPrParts();renderPrProductions()});enhancePrRows()}
async function savePr(){
 if(!prCurrent)return;
 const root=prEditParent?Number(prEditParent.split(".")[0]):prNumber;
 const validation=validatePriorityAssignments(prCurrent.rows,prAssign,{project:/proyecto/i.test(prCurrent.tipo),root,requireNonempty:prChildren});
 if(validation){alert(validation);return}
 if(prEditParent){
  const changed=prCurrent.rows.filter(r=>String(prAssign[r.key_produccion])!==String(prOriginal[r.key_produccion]));
  if(!changed.length){alert("No hay cambios por guardar.");return}
  if(changed.some(r=>String(prOriginal[r.key_produccion])!==prEditParent)){alert("No se permite modificar otra parte.");return}
  if(!confirm("Subdividir "+prEditParent+" modificará "+changed.length+" producciones de la reserva "+prCurrent.reserva+". ¿Continuar?"))return;
 }
 const button=document.querySelector("#prioritySave");button.disabled=true;
 try{
  const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),year=Number(document.querySelector("#queryYear").value),week=Number(document.querySelector("#queryWeek").value),line=document.querySelector("#queryLine").value||"PANELES_2";
  if(prEditParent){
   const {data:coverage,error:coverageError}=await client.rpc("sgp_mecanizado_cobertura_programacion",{p_token:token,p_semana:week});
   if(coverageError)throw coverageError;
   if(hasScheduledPriority(coverage,prCurrent.reserva,[prEditParent]))throw new Error("La parte ya tiene programación; no se puede modificar.");
  }
  const asign=prCurrent.rows.map(r=>({key_produccion:r.key_produccion,prioridad:prAssign[r.key_produccion]}));
  const {error}=await client.rpc("sgp_guardar_prioridad",{p_token:token,p_anio:year,p_semana:week,p_linea:line,p_reserva:prCurrent.reserva,p_asignaciones:asign});
  if(error)throw error;
  const {data:fresh,error:refreshError}=await client.rpc("sgp_datos_asignacion_prioridades",{p_token:token,p_anio:year,p_semana:week,p_linea:line});
  if(refreshError)throw refreshError;
  prRows=fresh.rows||[];
  const m=new Map();prRows.forEach(r=>{const res=String(r.reserva||"").split(",")[0].trim();if(res){if(!m.has(res))m.set(res,[]);m.get(res).push(r)}});
  prReservations=[...m].map(([reserva,rows])=>({reserva,rows,tipo:rows[0]?.tipo||"",sistema:[...new Set(rows.map(x=>x.sistema).filter(Boolean))].join(", "),acabado:[...new Set(rows.map(x=>x.acabado).filter(Boolean))].join(", "),paneles:rows.reduce((n,x)=>n+(Number(x.cantidad)||0),0),assigned:rows.some(x=>x.prioridad&&x.prioridad_reserva===reserva)}));
  prNumber=getNextPriorityNumber();document.querySelector("#priorityWorkModal").hidden=true;renderPrList();
 }catch(e){alert("No fue posible guardar: "+e.message)}
 finally{button.disabled=false}
}

/* LAB v310: la misma selección de producciones, con un tercer nivel opcional.
   Nunca se modifican otras partes de una reserva ya asignada. */
function enhancePrAssignedList(){
 const table=document.querySelector("#priorityAssignedList table");if(!table)return;
 const head=table.querySelector("thead tr");if(head&&!head.querySelector("[data-pr-action-head]")){const th=document.createElement("th");th.dataset.prActionHead="";th.textContent="Subdividir";head.appendChild(th)}
 table.querySelectorAll("tbody tr").forEach(tr=>{
  const reserve=tr.cells[2]?.textContent?.trim();
  const index=prReservations.findIndex(r=>r.reserva===reserve),r=prReservations[index];
  const cell=document.createElement("td");
  if(r&&!/proyecto/i.test(r.tipo)){
   const priorities=[...new Set(r.rows.map(x=>x.prioridad).filter(Boolean))].sort(comparePriority);
   priorities.filter(p=>priorityDepth(p)===2&&r.rows.filter(x=>String(x.prioridad)===String(p)).length>=2).forEach(p=>{
    const btn=document.createElement("button");btn.type="button";btn.className="priority-subdivide-button";btn.textContent="Subdividir "+p;btn.onclick=()=>startPrSplit(index,p);cell.appendChild(btn);
   });
  }
  if(!cell.childNodes.length)cell.textContent="—";
  tr.appendChild(cell);
 });
}
async function startPrSplit(i,parent){
 if((document.querySelector("#queryLine")?.value||"PANELES_2")!=="PANELES_2"){alert("El tercer nivel está habilitado únicamente para PANELES_2 hasta validar la cobertura de otras líneas.");return}
 const reserve=prReservations[i];
 if(!reserve||/proyecto/i.test(reserve.tipo)||priorityDepth(parent)!==2)return;
 if(reserve.rows.filter(r=>String(r.prioridad)===parent).length<2)return;
 try{
  const db=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),week=Number(document.querySelector("#queryWeek").value);
  const {data,error}=await db.rpc("sgp_mecanizado_cobertura_programacion",{p_token:token,p_semana:week});
  if(error)throw error;
  if(hasScheduledPriority(data,reserve.reserva,[parent])){alert("La parte "+parent+" ya está programada. No se puede subdividir sin afectar la trazabilidad.");return}
  startPr(i);
  prEditParent=parent;prChildren=[];prOriginal=Object.fromEntries(reserve.rows.map(r=>[r.key_produccion,String(r.prioridad||"")]));
  prAssign={...prOriginal};prParts=2;prActivePart=parent;
  document.querySelector("#priorityWorkTitle").textContent="Subdividir "+parent+" · Reserva "+reserve.reserva;
  document.querySelector("#priorityQuestion").innerHTML="<h3>Subdividir "+prE(parent)+"</h3><p>Solo se modificarán las producciones de esta parte. Las demás permanecerán bloqueadas.</p><p class='priority-help'>La programación activa se verifica antes de abrir y antes de guardar. El control transaccional definitivo está pendiente de aplicar en Supabase.</p>";
  document.querySelector("#priorityActions").innerHTML="";
  renderPrParts();renderPrProductions();askPrSubparts(parent);
 }catch(e){alert("No se pudo comprobar la programación; se impide modificar la parte: "+e.message)}
}
function askPrSubparts(parent){
 if((document.querySelector("#queryLine")?.value||"PANELES_2")!=="PANELES_2"){alert("El tercer nivel está habilitado únicamente para PANELES_2 hasta validar las demás líneas.");return}
 const n=Number(prompt("¿En cuántos subniveles dividir "+parent+"? (2 a 20)","2"));
 if(!Number.isInteger(n)||n<2||n>20)return;
 try{
  const plan=splitPriorityPart(prCurrent.rows,prAssign,parent,n);
  prAssign=plan.assignments;prChildren=plan.children;prActivePart=prChildren[0];
  renderPrParts();renderPrProductions();
 }catch(e){alert(e.message)}
}
function enhancePrParts(){
 const host=document.querySelector("#priorityParts");if(!host||!prCurrent)return;
 const existing=[...host.querySelectorAll("[data-prpart]")];
 const splitParent=prChildren[0]?.split(".").slice(0,2).join(".");
 if(prEditParent)existing.forEach(b=>b.hidden=true);
 else if(splitParent)existing.forEach(b=>{if(b.dataset.prpart===splitParent)b.hidden=true});
 const options=prEditParent?(prChildren.length?prChildren:[prEditParent]):prChildren;
 for(const p of options){
  const b=document.createElement("button");b.type="button";b.dataset.prsubpart=p;b.textContent=p;b.className=prActivePart===p?"active":"";
  b.onclick=()=>{prActivePart=p;renderPrParts();renderPrProductions()};host.appendChild(b);
 }
 const active=prActivePart;
 const eligible=priorityDepth(active)===2&&!prChildren.length&&!/proyecto/i.test(prCurrent.tipo)&&prCurrent.rows.filter(r=>prAssign[r.key_produccion]===active).length>=2;
 if(eligible){
  const b=document.createElement("button");b.type="button";b.className="priority-subdivide-button";
  b.textContent="↳ Crear subniveles de "+active;b.onclick=()=>askPrSubparts(active);host.appendChild(b);
 }
}
function enhancePrSummary(){
 const host=document.querySelector("#priorityPartSummary");if(!host||!prCurrent)return;
 const groups=groupPriorityRows(prCurrent.rows,prAssign).filter(x=>x.priority);
 host.replaceChildren();
 for(const g of groups){
  const card=document.createElement("div");card.className="daily-metric-card";
  const small=document.createElement("small");small.textContent="Prioridad "+g.priority;
  const strong=document.createElement("strong");strong.textContent=String(g.cantidad);
  const caption=document.createElement("span");caption.textContent="ventanas · "+g.rows.length+" producciones";
  card.append(small,strong,caption);host.appendChild(card);
 }
}
function enhancePrRows(){
 const body=document.querySelector("#priorityProductionBody");if(!body)return;
 body.querySelectorAll("[data-prprod]").forEach(tr=>{
  const key=tr.dataset.prprod,priority=String(prAssign[key]||"");
  tr.dataset.priority=priority;
  if(priorityDepth(priority)===3)tr.classList.add("priority-row-level3");
  if(prEditParent&&prOriginal[key]!==prEditParent){tr.classList.add("priority-row-locked");tr.title="Otra parte: no se puede modificar";tr.setAttribute("aria-disabled","true")}
 });
}

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
let recRows=[],recCurrent=null,recMissingDraft=[],recAluminumStateIndex=new Map(),recLoadSequence=0;
async function loadReception(){
 const token=getAppToken();if(!token)return;
 const sequence=++recLoadSequence;
 const client=await getSupabaseClient(),week=Number(document.querySelector('#recWeek')?.value)||null;
 // El tablero y Recepción consultan la misma fuente, con la misma semana.
 // Un fallo de Seguimiento no debe impedir auditar una recepción.
 const [reception,tracking]=await Promise.all([
  client.rpc('sgp_recepcion_listar',{p_token:token,p_semana:week}),
  Promise.resolve(client.rpc('sgp_consultar_seguimiento_aluminio',{p_token:token,p_semana:week})).catch(error=>({error}))
 ]);
 if(sequence!==recLoadSequence)return;
 if(reception.error)throw reception.error;
 recRows=Array.isArray(reception.data)?reception.data:[];
 const trackingOk=!tracking.error&&Array.isArray(tracking.data?.rows);
 recAluminumStateIndex=indexReceptionAluminumStates(trackingOk?tracking.data.rows:[]);
 // Tipo de reserva: usar la misma fuente autorizada de Seguimiento de Aluminio.
 // Si una reserva contiene tipos diferentes, no atribuir uno arbitrariamente.
 const typesByReservation=new Map();
 for(const row of trackingOk?tracking.data.rows:[]){
  const key=String(row.reserva??'').trim();if(!key)continue;
  const raw=String(row.tipo_orden??'').trim().toUpperCase();
  const type=raw.includes('RETAIL')?'RETAIL':raw.includes('PROYECTO')?'PROYECTO':'';
  if(!typesByReservation.has(key))typesByReservation.set(key,new Set());
  if(type)typesByReservation.get(key).add(type);
 }
 recRows=recRows.map(row=>{
  const types=typesByReservation.get(String(row.reserva??'').trim());
  const tipo_reserva=types?.size>1?'MIXTO':types?.size===1?[...types][0]:'';
  return {...row,tipo_reserva};
 });
 const notice=document.querySelector('#recTrackingStatus');
 if(notice){
  notice.hidden=trackingOk;
  notice.textContent=trackingOk?'':'No se pudo consultar el seguimiento de aluminio. Los estados se muestran como SIN DATO; pulsa Actualizar para reintentar.';
 }
 renderReception();
}
function receptionAluminumBadge(reserva){
 const state=recAluminumStateIndex.get(String(reserva??'').trim());
 const meta=receptionAluminumStateMeta(state);
 return '<span class="rec-aluminum-badge '+meta.css+'" title="Estado según tablero de seguimiento de aluminio">'+meta.label+'</span>';
}
function receptionTypeBadge(r){
 const raw=String(r.tipo_reserva??r.tipo??'').trim().toUpperCase();
 const tipo=raw==='PROYECTO'?'PROYECTO':raw==='RETAIL'?'RETAIL':raw==='MIXTO'?'MIXTO':'SIN DATO';
 return '<span class="rec-type-badge rec-type-'+tipo.toLowerCase().replace(' ','-')+'">'+tipo+'</span>';
}
function renderReception(){
 const q=(document.querySelector('#recSearch')?.value||'').toLowerCase(),
 rows=recRows.filter(r=>!q||String(r.reserva).toLowerCase().includes(q)),
 pending=rows.filter(r=>r.estado!=='RECIBIDA'),
 received=rows.filter(r=>r.estado==='RECIBIDA');
 document.querySelector('#recPending').textContent=pending.length;
 document.querySelector('#recReceived').textContent=received.length;
 document.querySelector('#recIncomplete').textContent=received.filter(r=>r.completa===false).length;
 document.querySelector('#recUnlegalized').textContent=received.filter(r=>!r.legalizada).length;
 document.querySelector('#recMissing').textContent=rows.reduce((a,r)=>a+Number(r.faltantes_abiertos||0),0);
 document.querySelector('#recPendingLabel').textContent=pending.length;
 document.querySelector('#recReceivedLabel').textContent=received.length;
 document.querySelector('#recBody').innerHTML=pending.length?pending.map(r=>
  '<tr><td>'+escapeHtml(r.semana_prog??'')+'</td><td>'+escapeHtml(r.reserva)+'</td><td>'+escapeHtml(r.sistema||'')+'</td><td>'+escapeHtml(r.acabado||'')+'</td><td>'+receptionTypeBadge(r)+'</td><td>'+escapeHtml(r.cantidad??'')+'</td><td><span class="state-badge state-warn">PENDIENTE POR RECIBIR</span></td><td>'+receptionAluminumBadge(r.reserva)+'</td><td>'+Number(r.faltantes_abiertos||0)+'</td><td>'+Number(r.dias_pendiente||0).toFixed(1)+'</td><td><button data-receive="'+escapeHtml(r.reserva)+'">Auditar</button></td></tr>'
 ).join(''):'<tr><td colspan="11" class="empty-state">No hay reservas pendientes por recibir.</td></tr>';
 document.querySelector('#recReceivedBody').innerHTML=received.length?received.map(r=>
  '<tr><td>'+escapeHtml(r.semana_prog??'')+'</td><td>'+escapeHtml(r.reserva)+'</td><td>'+escapeHtml(r.sistema||'')+'</td><td>'+escapeHtml(r.acabado||'')+'</td><td>'+receptionTypeBadge(r)+'</td><td>'+escapeHtml(r.cantidad??'')+'</td><td><span class="state-badge state-ok">RECIBIDA</span></td><td>'+receptionAluminumBadge(r.reserva)+'</td><td><span class="legal-badge '+(r.legalizada?'legal-ok':'legal-pending')+'">'+(r.legalizada?'LEGALIZADA':'RECIBIDA SIN LEGALIZAR')+'</span></td><td>'+Number(r.faltantes_abiertos||0)+'</td><td><button data-receive="'+escapeHtml(r.reserva)+'">Revisar</button></td></tr>'
 ).join(''):'<tr><td colspan="11" class="empty-state">Aún no hay reservas recibidas.</td></tr>';
 document.querySelectorAll('[data-receive]').forEach(b=>b.onclick=()=>openReception(b.dataset.receive));
}
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
async function loadMissing(){const token=getAppToken();if(!token)return;const client=await getSupabaseClient(),{data,error}=await client.rpc('sgp_recepcion_faltantes_listar',{p_token:token,p_solo_abiertos:false});if(error){console.error(error);return}const rows=data||[],open=rows.filter(x=>x.estado!=='CERRADO').sort((a,b)=>String(a.fecha_recepcion_reserva||'').localeCompare(String(b.fecha_recepcion_reserva||''))),resolved=rows.filter(x=>x.estado==='CERRADO');missingReportRows=open;document.querySelector('#missReservations').textContent=new Set(open.map(x=>x.reserva)).size;document.querySelector('#missOpen').textContent=open.length;document.querySelector('#missResolved').textContent=resolved.length;document.querySelector('#missGreen').textContent=open.filter(x=>missingTraffic(x.dias)==='green').length;document.querySelector('#missAmber').textContent=open.filter(x=>missingTraffic(x.dias)==='amber').length;document.querySelector('#missRed').textContent=open.filter(x=>missingTraffic(x.dias)==='red').length;document.querySelector('#missingBody').innerHTML=open.length?open.map(x=>'<tr class="traffic-row '+missingTraffic(x.dias)+'"><td>'+escapeHtml(x.reserva)+'</td><td>'+escapeHtml(x.perfil)+'</td><td>'+x.cantidad+'</td><td>'+escapeHtml(x.longitud??'')+'</td><td>'+escapeHtml(x.observacion||'')+'</td><td>'+missingDate(x.fecha_recepcion_reserva)+'</td><td>'+escapeHtml(x.turno_recepcion_reserva||'—')+'</td><td>'+Number(x.dias||0).toFixed(1)+'</td><td><span class="traffic-label '+missingTraffic(x.dias)+'">'+trafficLabel(x.dias)+'</span></td><td><button class="action-success" data-receive-missing="'+x.id_faltante+'" data-label="'+escapeHtml(x.reserva+' · '+x.perfil)+'">Registrar recibido</button></td></tr>').join(''):'<tr><td colspan="11" class="empty-state">No hay pendientes por resolver.</td></tr>';document.querySelector('#missingResolvedBody').innerHTML=resolved.length?resolved.sort((a,b)=>String(b.fecha_recibido||'').localeCompare(String(a.fecha_recibido||''))).map(x=>'<tr><td>'+escapeHtml(x.reserva)+'</td><td>'+escapeHtml(x.perfil)+'</td><td>'+x.cantidad+'</td><td>'+escapeHtml(x.longitud??'')+'</td><td>'+escapeHtml(String(x.nombre_reporte||x.usuario_reporte||x.usuario_creacion||'—').toUpperCase())+'</td><td>'+escapeHtml(String(x.nombre_cierre||x.usuario_cierre||'—').toUpperCase())+'</td><td>'+missingDate(x.fecha_recibido_operativa||x.fecha_recibido)+'</td><td>'+escapeHtml(x.turno_recibido||'—')+'</td><td><span class="missing-status closed">RECIBIDO</span></td></tr>').join(''):'<tr><td colspan="9" class="empty-state">Aún no hay pendientes resueltos.</td></tr>';document.querySelectorAll('[data-receive-missing]').forEach(b=>b.onclick=()=>openMissingReceive(b.dataset.receiveMissing,b.dataset.label))}
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
let progRows=[],progSchedule=[],progCoverage=[],progOrderCoverage=[],progConfirmations=[],progSelection=null,progCalendarAnchor=null;
const progGroupName={1:'OK / Entregadas en sistema',2:'Recibidas sin legalizar',3:'Pendientes por Bodega',4:'Pendientes por Abastecimiento'};
async function loadProgramming(){const c=await getSupabaseClient(),token=getAppToken();if(!token)return;await ensureSharedReservations();const week=Number(document.querySelector('#progWeek')?.value)||null;const [a,b,cv,oc]=await Promise.all([c.rpc('sgp_mecanizado_disponibles',{p_token:token,p_semana:week}),c.rpc('sgp_mecanizado_programacion_listar',{p_token:token}),c.rpc('sgp_mecanizado_cobertura_programacion',{p_token:token,p_semana:week}),c.rpc('sgp_mecanizado_cobertura_ordenes',{p_token:token,p_semana:week})]);if(a.error||b.error||cv.error||oc.error){console.error(a.error||b.error||cv.error||oc.error);return}progRows=a.data||[];progSchedule=b.data||[];progCoverage=cv.data||[];progOrderCoverage=oc.data||[];const cf=await c.rpc('sgp_mecanizado_conciliaciones_listar',{p_token:token});progConfirmations=cf.error?[]:(cf.data||[]);renderProgramming()}
function glassClass(p){p=Number(p||0);return p>=100?'good':p>=70?'mid':'low'}
function progDateISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function progWeekStart(value){const d=value?new Date(value+'T12:00:00'):new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d}
function progDayRowHtml(x){
 const row=progRows.find(r=>r.reserva===x.reserva),ord=x.produccion?(row?.ordenes||[]).find(o=>o.produccion===x.produccion):null;
 const part=x.prioridad_semanal?(row?.partes||[]).find(p=>String(p.prioridad)===String(x.prioridad_semanal)):null;
 let orders=x.produccion?(ord?[ord]:[]):(part?.ordenes||row?.ordenes||[]);
 const obs=[x.observacion?'<div><b>Observación general:</b> '+escapeHtml(x.observacion)+'</div>':'',x.observacion_orden?'<div><b>Observación de orden:</b> '+escapeHtml(x.observacion_orden)+'</div>':''].filter(Boolean).join('');
 const orderDetail=orders.length?'<div class="prog-orders-detail"><div class="prog-orders-title"><b>Órdenes programadas</b><span>'+orders.length+' orden'+(orders.length===1?'':'es')+'</span></div><div class="prog-orders-table-wrap"><table><thead><tr><th>Producción / orden</th><th>Tipo de vidrio</th><th>Ventanas</th><th>Vidrio</th></tr></thead><tbody>'+orders.map(o=>{const meta=sharedMetaFromEmbedded(o,x.reserva);return '<tr class="'+(isSharedMeta(meta)?'shared-row':'')+'"><td><b>'+escapeHtml(o.produccion||'—')+'</b>'+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'')+'</td><td><span class="glass-type-badge">'+escapeHtml(o.tipo_vidrio||'—')+'</span></td><td>'+Number(o.cantidad||0)+'</td><td><span class="glass-mini '+glassClass(o.vidrio_pct)+'"><b>'+Number(o.vidrio_pct||0).toFixed(0)+'%</b></span></td></tr>'}).join('')+'</tbody></table></div></div>':'<div class="prog-day-notes muted">No hay detalle de órdenes disponible.</div>';
 return '<details class="prog-day-item" data-prog-id="'+escapeHtml(x.id_programacion)+'"><summary><span class="prog-day-priority">'+escapeHtml(String(x.prioridad))+'</span><div><div class="prog-row-main"><b>'+escapeHtml(x.reserva)+' <span class="prog-type-badge">'+escapeHtml(x._tipo_reserva||'—')+'</span></b><small>'+(x.prioridad_semanal?'Parte '+escapeHtml(String(x.prioridad_semanal)):'Reserva / parte')+' · '+escapeHtml(x.turno||'')+'</small>'+sharedReserveNoticeHtml(x.reserva)+'<span class="prog-row-system"><strong>'+escapeHtml(x.sistema||'—')+'</strong><em>'+escapeHtml(x.acabado||row?.acabado||'—')+'</em></span></div></div><strong>'+x.cantidad_programada+' <small>ventanas</small></strong><span class="prod-state '+prodStateClass(x._estado_produccion||'PROGRAMADA')+'">'+escapeHtml(x._estado_produccion||'PROGRAMADA')+'</span><span class="glass-mini '+glassClass(x.porc_vidrio_snapshot)+'"><b>'+Number(x.porc_vidrio_snapshot||0).toFixed(0)+'%</b><small>vidrio</small></span><span class="prog-expand">⌄</span></summary><div class="prog-day-expanded"><div class="prog-detail-grid"><div><span>Sistema</span><b>'+escapeHtml(x.sistema||'—')+'</b></div><div><span>Acabado</span><b>'+escapeHtml(x.acabado||row?.acabado||'—')+'</b></div><div><span>Parte semanal</span><b>'+escapeHtml(x.prioridad_semanal||'—')+'</b></div><div><span>Producción / orden</span><b>'+escapeHtml(x.produccion||'Reserva completa')+'</b></div></div>'+orderDetail+(obs?'<div class="prog-day-notes">'+obs+'</div>':'<div class="prog-day-notes muted">Sin observaciones registradas.</div>')+((x._estado_produccion||'PROGRAMADA')!=='PROCESADO'?'<div class="prog-day-actions"><button type="button" data-day-reprogram="'+escapeHtml(x.id_programacion)+'">↪ Reprogramar '+(x.produccion?'orden':'reserva')+'</button></div>':'')+'</div></details>'
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
async function openProgDay(date){
 const arr=progSchedule.filter(x=>x.fecha_programacion===date&&x.estado!=='CANCELADA').sort((a,b)=>String(a.turno).localeCompare(String(b.turno))||Number(a.prioridad)-Number(b.prioridad)||String(a.fecha_creacion).localeCompare(String(b.fecha_creacion)));
 const db=await getSupabaseClient(),ids=arr.map(x=>x.id_programacion);await ensureSharedReservations();let ex=[],ordStates=[];if(ids.length){const er=await db.from('sgp_mecanizado_ejecucion').select('id_programacion,estado').in('id_programacion',ids);if(!er.error)ex=er.data||[];const or=await db.from('sgp_mecanizado_ejecucion_orden').select('id_programacion,produccion,estado').in('id_programacion',ids);if(!or.error)ordStates=or.data||[]}arr.forEach(x=>{const oe=ordStates.filter(e=>e.id_programacion===x.id_programacion),re=ex.find(e=>e.id_programacion===x.id_programacion);x._estado_produccion=oe.length?(oe.every(e=>e.estado==='PROCESADO')?'PROCESADO':oe.some(e=>e.estado==='MECANIZADO')?'MECANIZADO':oe.some(e=>e.estado==='CORTE')?'CORTE':oe[0].estado):(re?.estado||'PROGRAMADA');const row=progRows.find(r=>String(r.reserva)===String(x.reserva)),pool=x.produccion?(row?.ordenes||[]).filter(o=>String(o.produccion)===String(x.produccion)):(row?.ordenes||[]),tt=[...new Set(pool.map(z=>String(z.tipo||'').toUpperCase()).filter(Boolean))];x._tipo_reserva=tt.length===1?tt[0]:(tt.length>1?'MIXTA':'—')});
 const sys={};arr.forEach(x=>sys[x.sistema||'SIN SISTEMA']=(sys[x.sistema||'SIN SISTEMA']||0)+Number(x.cantidad_programada||0));
 let m=document.querySelector('#progDayModal');if(!m){m=document.createElement('div');m.id='progDayModal';m.className='rec-overlay prog-day-overlay';document.body.appendChild(m)}
 const total=arr.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),res=new Set(arr.map(x=>x.reserva)).size,turnos=[...new Set(arr.map(x=>x.turno).filter(Boolean))];
 m.innerHTML='<div class="prog-day-card"><div class="prog-day-head"><div class="prog-day-title"><small>PROGRAMACIÓN DE MECANIZADO</small><div class="prog-day-date-nav"><button type="button" data-day-prev aria-label="Día anterior">‹</button><button type="button" class="prog-day-date-button" data-day-calendar aria-label="Abrir calendario"><span data-day-date-label>'+escapeHtml(date)+'</span><span class="prog-cal-icon">▣</span></button><div class="prog-mini-calendar" data-day-calendar-pop hidden></div><button type="button" data-day-next aria-label="Día siguiente">›</button></div><span>'+res+' reservas · '+total+' ventanas</span></div><div class="prog-report-actions"><button type="button" data-report-pdf>PDF</button><button type="button" data-report-image>Imagen</button><button type="button" class="modal-close" data-close-day>×</button></div></div><div class="prog-day-systems">'+Object.entries(sys).map(([s,n])=>'<div><span>'+escapeHtml(s)+'</span><b>'+n+'</b><small>ventanas</small></div>').join('')+'<div class="prog-day-total"><span>TOTAL DÍA</span><b>'+total+'</b><small>ventanas</small></div></div><div class="prog-day-detail">'+(arr.length?turnos.map(t=>{const ta=arr.filter(x=>x.turno===t),ts={};ta.forEach(x=>{const k=x.sistema||'SIN SISTEMA';ts[k]=(ts[k]||0)+Number(x.cantidad_programada||0)});const tt=ta.reduce((n,x)=>n+Number(x.cantidad_programada||0),0);return '<section class="prog-day-turn" data-turno="'+escapeHtml(t)+'"><div class="prog-turn-head"><div class="prog-turn-title"><b>'+escapeHtml(t)+'</b><span class="prog-turn-total">'+tt+' ventanas</span><div class="prog-turn-systems">'+Object.entries(ts).map(([s,n])=>'<span><strong>'+escapeHtml(s)+'</strong><b>'+n+' ventanas</b></span>').join('')+'</div></div><span>Arrastre las filas para cambiar el orden de prioridad</span></div>'+ta.map(progDayRowHtml).join('')+'</section>'}).join(''):'<div class="empty-state">No hay programación para este día.</div>')+'</div></div>';
 m.hidden=false;m.scrollTop=0;
 const moveDay=delta=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+delta);openProgDay(progDateISO(d))};
 m.querySelector('[data-close-day]').onclick=()=>m.hidden=true;
 m.querySelector('[data-day-prev]').onclick=e=>{e.preventDefault();e.stopPropagation();moveDay(-1)};
 m.querySelector('[data-day-next]').onclick=e=>{e.preventDefault();e.stopPropagation();moveDay(1)};
 const calBtn=m.querySelector('[data-day-calendar]'),calPop=m.querySelector('[data-day-calendar-pop]');
 const renderMiniCalendar=(anchorIso)=>{
  const anchor=new Date(anchorIso+'T12:00:00'),year=anchor.getFullYear(),month=anchor.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0),startDay=(first.getDay()+6)%7,names=['L','M','X','J','V','S','D'],monthName=anchor.toLocaleDateString('es-CO',{month:'long',year:'numeric'}).toUpperCase();
  let cells='';for(let i=0;i<startDay;i++)cells+='<span class="empty"></span>';for(let d=1;d<=last.getDate();d++){const dt=new Date(year,month,d,12),iso=progDateISO(dt);cells+='<button type="button" data-mini-date="'+iso+'" class="'+(iso===date?'selected':'')+'">'+d+'</button>'}
  calPop.dataset.anchor=progDateISO(first);calPop.innerHTML='<div class="mini-cal-head"><button type="button" data-mini-prev>‹</button><b>'+monthName+'</b><button type="button" data-mini-next>›</button></div><div class="mini-cal-week">'+names.map(n=>'<span>'+n+'</span>').join('')+'</div><div class="mini-cal-grid">'+cells+'</div>';
  calPop.querySelector('[data-mini-prev]').onclick=e=>{e.stopPropagation();const d=new Date(calPop.dataset.anchor+'T12:00:00');d.setMonth(d.getMonth()-1);renderMiniCalendar(progDateISO(d))};
  calPop.querySelector('[data-mini-next]').onclick=e=>{e.stopPropagation();const d=new Date(calPop.dataset.anchor+'T12:00:00');d.setMonth(d.getMonth()+1);renderMiniCalendar(progDateISO(d))};
  calPop.querySelectorAll('[data-mini-date]').forEach(b=>b.onclick=e=>{e.stopPropagation();openProgDay(b.dataset.miniDate)});
 };
 renderMiniCalendar(date);
 calBtn.onclick=e=>{e.preventDefault();e.stopPropagation();calPop.hidden=!calPop.hidden};
 calPop.onclick=e=>e.stopPropagation();
 m.querySelector('[data-report-pdf]')?.addEventListener('click',()=>generateProgPdf(date,arr));
 m.querySelector('[data-report-image]')?.addEventListener('click',()=>generateProgImage(date,arr));
 m.querySelectorAll('[data-day-reprogram]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const x=arr.find(r=>String(r.id_programacion)===String(b.dataset.dayReprogram));if(!x)return alert('No fue posible identificar la programación a reprogramar.');if((x._estado_produccion||'PROGRAMADA')==='PROCESADO')return alert('Esta programación ya fue procesada y no puede reprogramarse.');openMecanizadoReprogram(x.id_programacion,x.produccion||null)});
 m.onclick=e=>{if(e.target===m){m.hidden=true;return}const b=e.target.closest('[data-day-reprogram]');if(!b)return;e.preventDefault();e.stopPropagation();const x=arr.find(r=>String(r.id_programacion)===String(b.dataset.dayReprogram));if(x&&(x._estado_produccion||'PROGRAMADA')!=='PROCESADO')openMecanizadoReprogram(x.id_programacion,x.produccion||null)};m.querySelectorAll('.prog-day-item').forEach(el=>{el.draggable=true;el.addEventListener('dragstart',e=>{el.classList.add('dragging');e.dataTransfer.effectAllowed='move'});el.addEventListener('dragend',()=>el.classList.remove('dragging'))});
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
 const coverageFor=(res,part=null)=>progCoverage.find(x=>String(x.reserva)===String(res)&&(part==null||String(x.prioridad_semanal||'')===String(part)))||null;
 const programmedFor=(res,prod=null)=>{if(prod){const oc=progOrderCoverage.filter(x=>String(x.reserva)===String(res)&&String(x.produccion)===String(prod));if(oc.length&&!oc.some(x=>x.estado_orden==='REVISAR'))return oc.some(x=>x.estado_orden==='PROGRAMADA')?Number(oc[0].cantidad||0):0;const row=progRows.find(r=>String(r.reserva)===String(res)),order=(row?.ordenes||[]).find(o=>String(o.produccion)===String(prod));if(order){const parts=(row?.partes||[]).filter(p=>(p.ordenes||[]).some(o=>String(o.produccion)===String(prod))),covered=parts.reduce((n,p)=>n+Number(coverageFor(res,p.prioridad)?.cantidad_cubierta||0),0),canonical=parts.reduce((n,p)=>n+Number((p.ordenes||[]).find(o=>String(o.produccion)===String(prod))?.cantidad||0),0);if(parts.length&&covered>=parts.reduce((n,p)=>n+Number(p.cantidad||0),0))return Number(order.cantidad||canonical||0)}}return progSchedule.filter(x=>x.estado!=='CANCELADA'&&x.reserva===res&&(!prod||x.produccion===prod)).reduce((n,x)=>n+Number(x.cantidad_programada||0),0)};
 const reserveCoverage=res=>{const cs=progCoverage.filter(x=>String(x.reserva)===String(res));return cs.length?cs.reduce((n,x)=>n+Number(x.cantidad_cubierta||0),0):programmedFor(res)};
 const wk=document.querySelector('#progWeek');if(wk&&!wk.dataset.ready){const weeks=[...new Set(progRows.map(r=>Number(r.semana)).filter(Boolean))].sort((a,b)=>b-a);wk.innerHTML='<option value="">Todas las semanas</option>'+weeks.map(w=>'<option value="'+w+'">Semana '+w+'</option>').join('');wk.dataset.ready='1'}
 const q=(document.querySelector('#progSearch')?.value||'').toLowerCase(),rows=progRows.filter(r=>!q||[r.reserva,r.sistema,r.acabado,JSON.stringify(r.ordenes)].join(' ').toLowerCase().includes(q));
 const enriched=rows.map(r=>{const done=reserveCoverage(r.reserva),left=Math.max(0,Number(r.cantidad)-done),confirmation=progConfirmations.find(c=>String(c.reserva)===String(r.reserva)&&c.estado==='CONFIRMADA_OPERACION'&&Number(c.cantidad_canonica)===Number(r.cantidad));return {...r,_done:done,_left:left,_confirmation:confirmation,_progress:Number(r.cantidad)?Math.min(100,done/Number(r.cantidad)*100):0}});
 const complete=enriched.filter(r=>(r._left<=0&&r._done>0)||r._confirmation),pending=enriched.filter(r=>r._left>0&&!r._confirmation);
 // Vista separada sin alterar la cobertura existente: una reserva parcial permanece arriba por sus órdenes pendientes.
 const unprogrammed=pending.filter(r=>r._done<=0),partial=pending.filter(r=>r._done>0);
 const programmed=enriched.filter(r=>r._done>0||r._confirmation);
 document.querySelector('#progAvailable').textContent=pending.length;document.querySelector('#progScheduled').textContent=new Set(progSchedule.filter(x=>x.estado!=='CANCELADA').map(x=>x.reserva)).size;document.querySelector('#progWindows').textContent=progSchedule.filter(x=>x.estado!=='CANCELADA').reduce((a,x)=>a+Number(x.cantidad_programada||0),0);document.querySelector('#progGlassAvg').textContent=(rows.length?rows.reduce((a,x)=>a+Number(x.vidrio_pct||0),0)/rows.length:0).toFixed(0)+'%';
 const card=r=>'<details class="prog-res '+(r._done?'prog-res-partial':'')+'"><summary><div><b>'+escapeHtml(r.reserva)+'</b>'+sharedReserveNoticeHtml(r.reserva)+'<span>'+escapeHtml(r.sistema||'')+' · '+escapeHtml(r.acabado||'')+' · '+r.cantidad+' ventanas</span><span class="prog-balance">'+(r._confirmation?'<b>'+r.cantidad+' confirmadas por operación</b> · 0 pendientes operativos':'<b>'+r._done+' programadas</b> · '+r._left+' sin programar')+'</span>'+(r._confirmation?'<span class="prog-balance"><b>Confirmada por operación</b> · cobertura por orden pendiente de conciliar</span>':'')+'<span class="prog-progress"><i style="width:'+r._progress+'%"></i></span></div><button type="button" data-prog-res="'+escapeHtml(r.reserva)+'" data-prog-qty="'+r._left+'" '+(r._confirmation?'disabled':'')+'>'+(r._confirmation?'Confirmada':r._done?'Continuar':'Programar')+'</button><div class="glass-mini '+glassClass(r.vidrio_pct)+'"><b>'+Number(r.vidrio_pct||0).toFixed(0)+'%</b><span>Vidrio '+r.vidrio_cant+'/'+r.cantidad+'</span></div></summary><div class="prog-orders">'+(r.ordenes||[]).map(o=>{const op=programmedFor(r.reserva,o.produccion),orem=Math.max(0,Number(o.cantidad)-op),meta=sharedMetaFromEmbedded(o,r.reserva);return '<div class="prog-order '+(isSharedMeta(meta)?'shared-row':'')+'"><div><b>'+escapeHtml(o.produccion||'Orden')+'</b>'+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'')+'<span>'+o.cantidad+' ventanas · <strong class="'+(orem===0?'done-text':'pending-text')+'">'+op+' programadas · '+orem+' pendientes</strong></span></div><div class="glass-mini '+glassClass(o.vidrio_pct)+'"><b>'+Number(o.vidrio_pct||0).toFixed(0)+'%</b><span>'+Number(o.vidrio_cant||0)+'/'+o.cantidad+'</span></div><button type="button" data-prog-order="'+escapeHtml(r.reserva)+'" data-prod="'+escapeHtml(o.produccion||'')+'" data-prog-qty="'+orem+'" '+(orem<=0?'disabled':'')+'>'+(orem<=0?'Programada':'Programar orden')+'</button></div>'}).join('')+'</div></details>';
 document.querySelector('#progPool').innerHTML='<section class="prog-group"><div class="prog-group-title"><b>Reservas no programadas · Programada: NO</b><span>'+unprogrammed.length+'</span></div><div class="empty-state">Las reservas con programación parcial continúan disponibles en la sección de pendientes por completar.</div></section>'+[1,2,3,4].map(g=>{const rr=unprogrammed.filter(x=>Number(x.grupo)===g);return '<section class="prog-group"><div class="prog-group-title"><b>'+progGroupName[g]+'</b><span>'+rr.length+'</span></div>'+(rr.length?rr.map(card).join(''):'<div class="empty-state">Sin reservas en esta condición.</div>')+'</section>'}).join('')+'<section class="prog-group"><div class="prog-group-title"><b>Reservas con programación parcial · Programada: SÍ</b><span>'+partial.length+'</span></div>'+(partial.length?partial.map(card).join(''):'<div class="empty-state">Sin programaciones parciales.</div>')+'</section>'+'<section class="prog-group prog-complete-group"><div class="prog-group-title"><b>✓ Reservas completamente programadas · Programada: SÍ</b><span>'+complete.length+'</span></div>'+(complete.length?complete.map(r=>'<details class="prog-res prog-res-complete"><summary><div><b>'+escapeHtml(r.reserva)+'</b>'+sharedReserveNoticeHtml(r.reserva)+'<span>'+escapeHtml(r.sistema||'')+' · '+escapeHtml(r.acabado||'')+' · '+r.cantidad+' ventanas</span><span class="prog-balance"><b>'+r._done+' programadas</b> · 0 pendientes</span><span class="prog-progress"><i style="width:100%"></i></span></div><span class="prog-done-badge">PROGRAMADA</span><div class="glass-mini '+glassClass(r.vidrio_pct)+'"><b>'+Number(r.vidrio_pct||0).toFixed(0)+'%</b><span>Vidrio '+r.vidrio_cant+'/'+r.cantidad+'</span></div></summary></details>').join(''):'<div class="empty-state">Aún no hay reservas completamente programadas.</div>')+'</section>';
 renderProgCalendar();
 document.querySelectorAll('[data-prog-res],[data-prog-order]').forEach(b=>b.onclick=e=>{e.preventDefault();if(Number(b.dataset.progQty||0)<=0)return;openProgModal(b.dataset.progRes||b.dataset.progOrder,b.dataset.prod||null,Number(b.dataset.progQty||1))})
}
function renderProgParts(parts,produccion){
 let host=document.querySelector('#progPartsBox');if(!host)return;
 if(produccion||!parts.length){host.hidden=true;host.innerHTML='';return}
 const covFor=p=>progOrderCoverage.filter(x=>String(x.reserva)===String(progSelection?.reserva)&&String(x.prioridad_semanal||'')===String(p.prioridad));
 const orderCov=(p,o)=>{const rows=covFor(p);return rows.find(x=>String(x.key_produccion||'')===String(o.key_produccion||''))||rows.find(x=>String(x.produccion||'')===String(o.produccion||''))||null};
 const glassSummary=p=>{const g={};(p.ordenes||[]).forEach(o=>{String(o.tipo_vidrio||'—').split('/').map(x=>x.trim()).filter(Boolean).forEach(t=>g[t]=(g[t]||0)+Number(o.cantidad||0))});return Object.entries(g).map(([t,n])=>'<span class="part-glass-chip"><b>'+escapeHtml(t)+'</b><strong>'+n+' und</strong></span>').join('')};
 const partStats=p=>{const rows=covFor(p),review=rows.some(x=>x.estado_orden==='REVISAR'),done=(p.ordenes||[]).reduce((n,o)=>n+(orderCov(p,o)?.estado_orden==='PROGRAMADA'?Number(o.cantidad||0):0),0);return {rows,review,done,left:review?null:Math.max(0,Number(p.cantidad)-done)}};
 const legacyTarget=p=>Number(progCoverage.find(x=>String(x.reserva)===String(progSelection?.reserva)&&String(x.prioridad_semanal||'')===String(p.prioridad))?.cantidad_cubierta||0);
 host.hidden=false;host.innerHTML='<label>Parte / prioridad semanal</label><div class="prog-part-list">'+parts.map(p=>{const st=partStats(p),left=st.left,legacy=st.review,legacyId=st.rows.find(x=>x.id_programacion_legacy)?.id_programacion_legacy||'',target=legacyTarget(p);return '<details class="prog-part '+(!legacy&&left<=0?'prog-part-done':!legacy&&st.done>0?'prog-part-partial':'')+'" '+(legacy?'open':'')+'><summary><label class="prog-part-choice"><input type="radio" name="progPartChoice" value="'+escapeHtml(p.prioridad)+'" '+(legacy||left<=0?'disabled':'')+'><span class="part-radio-ui"></span><span class="part-main"><b>Parte '+escapeHtml(p.prioridad)+'</b>'+(legacy?'<em class="part-status-badge partial">REVISAR HISTÓRICO</em>':left<=0?'<em class="part-status-badge">✓ PROGRAMADA</em>':st.done>0?'<em class="part-status-badge partial">PARCIAL</em>':'')+'<span>'+p.cantidad+' ventanas · '+(legacy?'<strong class="pending-text">identificar '+target+' ventanas ya programadas</strong>':'<strong class="'+(left===0?'done-text':'pending-text')+'">'+st.done+' programadas · '+left+' pendientes</strong>')+' · Vidrio '+Number(p.vidrio_pct||0).toFixed(0)+'%</span><span class="part-glass-summary">'+glassSummary(p)+'</span></span></label></summary><div class="prog-part-orders">'+(p.ordenes||[]).map(o=>{const oc=orderCov(p,o),state=oc?.estado_orden||'PENDIENTE';return '<div class="prog-order-coverage" data-order-row="'+escapeHtml(o.key_produccion||o.produccion||'')+'" data-order-qty="'+Number(o.cantidad||0)+'"><div><b>'+escapeHtml(o.produccion||'Orden')+'</b><span>'+o.cantidad+' ventanas · <strong class="glass-type-inline">Vidrio: '+escapeHtml(o.tipo_vidrio||'—')+'</strong></span></div>'+(legacy?'<label class="legacy-cover-check"><input type="checkbox" data-legacy-key="'+escapeHtml(o.key_produccion||'')+'" data-legacy-part="'+escapeHtml(p.prioridad)+'" data-legacy-qty="'+Number(o.cantidad||0)+'"> Ya estaba programada</label><em class="legacy-live-state">POR DEFINIR</em>':'<div class="prog-order-actions"><em class="part-status-badge '+(state==='PROGRAMADA'?'':'partial')+'">'+(state==='PROGRAMADA'?'✓ PROGRAMADA':'PENDIENTE')+'</em>'+(state==='PENDIENTE'?'<button type="button" class="program-pending-order" data-program-order="'+escapeHtml(o.produccion||'')+'" data-program-part="'+escapeHtml(p.prioridad)+'" data-program-qty="'+Number(o.cantidad||0)+'">Programar esta orden</button>':'')+'</div>')+'<textarea data-part-order="'+escapeHtml(o.produccion||'')+'" placeholder="Comentario específico de esta orden (opcional)"></textarea></div>'}).join('')+(legacy?'<div class="legacy-reconcile-box" data-legacy-summary="'+escapeHtml(p.prioridad)+'" data-legacy-target="'+target+'"><strong>Histórico identificado: <span data-legacy-selected>0</span> / '+target+' ventanas</strong><small data-legacy-help>Marca las órdenes que componen las '+target+' ventanas ya programadas. Al completar exactamente esa cantidad, las restantes se identificarán como pendientes.</small><button type="button" data-reconcile-part="'+escapeHtml(p.prioridad)+'" data-legacy-id="'+escapeHtml(legacyId)+'" disabled>Confirmar y mostrar faltantes</button></div>':'')+'</div></details>'}).join('')+'</div>';
 // Presenta las órdenes por estado sin alterar la reconciliación histórica.
 host.querySelectorAll('.prog-part').forEach(section=>{
  const rows=[...section.querySelectorAll('.prog-order-coverage')];
  if(!rows.length)return;
  const legacy=!!section.querySelector('[data-legacy-summary]');
  const parent=rows[0].parentElement;
  const heading=document.createElement('div');
  heading.className='prog-order-section-title';
  heading.style.cssText='font-weight:800;margin:12px 0 8px;color:#103b70';
  heading.textContent=legacy?'Identificar órdenes ya programadas (histórico)':'Órdenes pendientes por programar';
  parent.insertBefore(heading,rows[0]);
  if(legacy){
   const note=document.createElement('p');
   note.textContent='Marca primero las órdenes históricamente programadas. Al confirmar, el sistema identificará las pendientes.';
   note.style.cssText='font-size:12px;margin:0 0 12px';
   heading.after(note);
   return;
  }
  const done=rows.filter(row=>row.querySelector('.part-status-badge')?.textContent.includes('PROGRAMADA'));
  const pending=rows.filter(row=>!done.includes(row));
  heading.textContent='Órdenes pendientes por programar · '+pending.length;
  if(pending.length){
   const controls=document.createElement('div');
   controls.className='prog-batch-controls';
   controls.style.cssText='padding:10px 0 14px;display:flex;flex-wrap:wrap;align-items:center;gap:12px';
   const count=document.createElement('strong');
   count.textContent='0 ventanas seleccionadas';
   const btn=document.createElement('button');
   btn.type='button';btn.className='primary';btn.textContent='Programar órdenes seleccionadas';btn.disabled=true;
   const choices=[];
   pending.forEach(row=>{
    const action=row.querySelector('[data-program-order]');
    if(!action)return;
    const qty=Number(action.dataset.programQty||0);
    if(qty<=0)return;
    const check=document.createElement('input');check.type='checkbox';check.className='prog-batch-check';
    check.setAttribute('aria-label','Seleccionar '+action.dataset.programOrder);
    check.style.cssText='width:19px;height:19px;margin-right:10px;vertical-align:middle';
    row.firstElementChild?.prepend(check);
    choices.push({check,order:action.dataset.programOrder,qty,part:action.dataset.programPart,row});
   });
   const update=()=>{const selected=choices.filter(x=>x.check.checked),total=selected.reduce((n,x)=>n+x.qty,0);count.textContent=total+' ventanas seleccionadas ('+selected.length+' órdenes)';btn.disabled=!selected.length};
   choices.forEach(x=>x.check.addEventListener('change',update));
   let saving=false;
   btn.onclick=async()=>{
    if(saving)return;
    const selected=choices.filter(x=>x.check.checked);
    if(!selected.length)return;
    const total=selected.reduce((n,x)=>n+x.qty,0);
    const date=document.querySelector('#progDate').value,shift=document.querySelector('#progShift').value;
    const priority=Number(document.querySelector('#progPriority').value);
    const reserva=progSelection?.reserva;
    if(!reserva||!date||!shift||!Number.isFinite(priority)||priority<0){alert('Complete fecha, turno y prioridad válida.');return}
    if(selected.some(x=>!x.order||!x.part||!Number.isInteger(x.qty)||x.qty<=0)){alert('Hay órdenes sin identidad, parte o cantidad válida.');return}
    if(new Set(selected.map(x=>x.part+'|'+x.order)).size!==selected.length){alert('Hay órdenes repetidas en la selección.');return}
    if(!confirm('¿Programar '+selected.length+' órdenes con '+total+' ventanas para '+date+' / '+shift+'?'))return;
    saving=true;btn.disabled=true;btn.textContent='Guardando programación…';
    let completed=0,failed=null;
    try{
     const c=await getSupabaseClient(),token=getAppToken();
     for(const item of selected){
      const args={p_token:token,p_reserva:reserva,p_produccion:item.order,p_cantidad:item.qty,p_fecha:date,p_turno:shift,p_prioridad:priority+completed,p_prioridad_semanal:String(item.part),p_observacion:document.querySelector('#progObs').value,p_observacion_orden:item.row.querySelector('textarea')?.value||''};
      const {error}=await c.rpc('sgp_mecanizado_programar',args);
      if(error){failed={order:item.order,message:error.message};break}
      completed++;
     }
    }catch(error){failed={order:selected[completed]?.order||'desconocida',message:error?.message||String(error)}}
    finally{
     saving=false;
     if(completed){closeProgModal();try{await loadProgramming()}catch(error){alert('Se guardaron '+completed+' órdenes, pero falló la actualización del listado: '+(error?.message||error))}}
     else{btn.textContent='Programar órdenes seleccionadas';update()}
    }
    if(failed)alert('Se guardaron '+completed+' de '+selected.length+' órdenes. Se detuvo en '+failed.order+': '+failed.message+'. Verifique el listado antes de reintentar.');
    else alert('Se programaron '+completed+' órdenes correctamente.');
   };
   controls.append(count,btn);heading.after(controls);
  }
  const details=document.createElement('details');
  details.className='prog-completed-orders';
  details.style.cssText='margin:12px 0;border-top:1px solid #d7e2f0;padding-top:12px';
  const summary=document.createElement('summary');
  summary.textContent='Órdenes ya programadas · '+done.length+' (consultar)';
  summary.style.cssText='font-weight:700;cursor:pointer;color:#176345';
  details.appendChild(summary);
  done.forEach(row=>{row.querySelectorAll('textarea').forEach(el=>el.remove());details.appendChild(row)});
  parent.appendChild(details);
  if(!pending.length)heading.textContent='Sin órdenes pendientes por programar';
 });
 host.querySelectorAll('input[name="progPartChoice"]').forEach(r=>r.onchange=()=>{const p=parts.find(x=>String(x.prioridad)===r.value);if(!p)return;const st=partStats(p);if(st.review)return;progSelection.part=p;progSelection.maxQty=st.left;document.querySelector('#progQty').value=st.left;document.querySelector('#progQty').readOnly=true});
 const refreshLegacy=part=>{const box=host.querySelector('[data-legacy-summary="'+CSS.escape(part)+'"]');if(!box)return;const target=Number(box.dataset.legacyTarget||0),checks=[...host.querySelectorAll('input[data-legacy-part="'+CSS.escape(part)+'"]')],selected=checks.filter(x=>x.checked).reduce((n,x)=>n+Number(x.dataset.legacyQty||0),0),exact=target>0&&selected===target;box.querySelector('[data-legacy-selected]').textContent=selected;const help=box.querySelector('[data-legacy-help]');help.textContent=selected>target?'La selección supera el histórico por '+(selected-target)+' ventanas. Desmarca órdenes.':selected<target?'Faltan '+(target-selected)+' ventanas por identificar del histórico.':'Cobertura histórica completa. Las órdenes no marcadas son las pendientes por programar.';const btn=box.querySelector('[data-reconcile-part]');btn.disabled=!exact||!btn.dataset.legacyId;checks.forEach(x=>{const row=x.closest('.prog-order-coverage'),badge=row?.querySelector('.legacy-live-state');if(!badge)return;badge.textContent=x.checked?'✓ PROGRAMADA':exact?'PENDIENTE':'POR DEFINIR';badge.className='legacy-live-state '+(x.checked?'is-programmed':exact?'is-pending':'')});};
 host.querySelectorAll('input[data-legacy-part]').forEach(x=>x.onchange=()=>refreshLegacy(x.dataset.legacyPart));
 host.querySelectorAll('[data-legacy-summary]').forEach(x=>refreshLegacy(x.dataset.legacySummary));
 host.querySelectorAll('[data-program-order]').forEach(b=>b.onclick=()=>openProgModal(progSelection.reserva,b.dataset.programOrder,Number(b.dataset.programQty||0),b.dataset.programPart));
 host.querySelectorAll('[data-reconcile-part]').forEach(b=>b.onclick=async()=>{const part=b.dataset.reconcilePart,id=b.dataset.legacyId,box=host.querySelector('[data-legacy-summary="'+CSS.escape(part)+'"]'),target=Number(box?.dataset.legacyTarget||0),checks=[...host.querySelectorAll('input[data-legacy-part="'+CSS.escape(part)+'"]')],selected=checks.filter(x=>x.checked).reduce((n,x)=>n+Number(x.dataset.legacyQty||0),0),keys=checks.filter(x=>x.checked).map(x=>x.dataset.legacyKey).filter(Boolean);if(!id||!keys.length||selected!==target){alert('La selección debe sumar exactamente '+target+' ventanas históricas antes de continuar.');return}if(!confirm('Se confirmarán '+selected+' ventanas como ya programadas. Las órdenes no seleccionadas quedarán identificadas como pendientes y podrán programarse directamente. ¿Continuar?'))return;const reservaActual=progSelection?.reserva;const c=await getSupabaseClient();const {error}=await c.rpc('sgp_mecanizado_reconciliar_programacion_legacy',{p_token:getAppToken(),p_id_programacion:id,p_keys_programadas:keys});if(error){alert(error.message);return}closeProgModal();await loadProgramming();const pending=progOrderCoverage.filter(x=>String(x.reserva)===String(reservaActual)&&String(x.prioridad_semanal||'')===String(part)&&x.estado_orden==='PENDIENTE');if(pending.length){openProgModal(reservaActual,null,pending.reduce((n,x)=>n+Number(x.cantidad||0),0));const radio=document.querySelector('input[name="progPartChoice"][value="'+CSS.escape(part)+'"]');if(radio){radio.checked=true;radio.dispatchEvent(new Event('change'))}}});
}
function openProgModal(reserva,produccion,qty,partPriority=null){if(qty<=0)return;const row=progRows.find(x=>x.reserva===reserva),parts=row?.partes||[],selectedPart=partPriority!=null?parts.find(p=>String(p.prioridad)===String(partPriority)):null;progSelection={reserva,produccion,maxQty:qty,part:selectedPart||null};document.querySelector('#progModalTitle').textContent='Programar '+reserva;document.querySelector('#progModalMeta').textContent=produccion?produccion+(selectedPart?' · Parte '+selectedPart.prioridad:''):partPriority?'Parte '+partPriority:'Reserva / cantidad parcial';document.querySelector('#progShift').value='TURNO 1';document.querySelector('#progPriority').value=Math.max(0,...progSchedule.filter(x=>x.estado!=='CANCELADA'&&x.fecha_programacion===new Date().toISOString().slice(0,10)&&x.turno==='TURNO 1').map(x=>Number(x.prioridad)||0))+1;document.querySelector('#progObs').value='';document.querySelector('#progOrderObs').value='';document.querySelector('#progQty').readOnly=!!produccion;renderProgParts(parts,produccion);document.querySelector('#progQty').value=qty;document.querySelector('#progDate').value=new Date().toISOString().slice(0,10);const recalcPriority=()=>{const d=document.querySelector('#progDate').value,t=document.querySelector('#progShift').value;document.querySelector('#progPriority').value=Math.max(0,...progSchedule.filter(x=>x.estado!=='CANCELADA'&&x.fecha_programacion===d&&x.turno===t).map(x=>Number(x.prioridad)||0))+1};document.querySelector('#progDate').onchange=recalcPriority;document.querySelector('#progShift').onchange=recalcPriority;recalcPriority();document.querySelector('#progModal').hidden=false}

function closeProgModal(){document.querySelector('#progModal').hidden=true;document.querySelector('#progQty').readOnly=false;progSelection=null}
async function saveProgramming(){if(!progSelection)return;const args={p_token:getAppToken(),p_reserva:progSelection.reserva,p_produccion:progSelection.produccion,p_cantidad:Number(document.querySelector('#progQty').value),p_fecha:document.querySelector('#progDate').value,p_turno:document.querySelector('#progShift').value,p_prioridad:Number(document.querySelector('#progPriority').value),p_prioridad_semanal:progSelection.part?String(progSelection.part.prioridad):null,p_observacion:document.querySelector('#progObs').value,p_observacion_orden:[document.querySelector('#progOrderObs').value,...[...document.querySelectorAll('#progPartsBox textarea')].filter(x=>x.value.trim()).map(x=>x.dataset.partOrder+': '+x.value.trim())].filter(Boolean).join(' | ')};if(!args.p_fecha||!args.p_cantidad){alert('Complete fecha y cantidad.');return}if(args.p_cantidad>progSelection.maxQty){alert('Solo quedan '+progSelection.maxQty+' ventanas pendientes por programar.');return}const c=await getSupabaseClient();let {error}=await c.rpc('sgp_mecanizado_programar',args);if(error&&/schema cache|Could not find the function/i.test(error.message||'')){await new Promise(r=>setTimeout(r,700));({error}=await c.rpc('sgp_mecanizado_programar',args))}if(error){alert(error.message);return}closeProgModal();await loadProgramming()}
document.querySelector('#progRefresh')?.addEventListener('click',loadProgramming);document.querySelector('#progWeek')?.addEventListener('change',loadProgramming);document.querySelector('#progSearch')?.addEventListener('input',renderProgramming);document.querySelector('#progModalClose')?.addEventListener('click',closeProgModal);document.querySelector('#progCancel')?.addEventListener('click',closeProgModal);document.querySelector('#progSave')?.addEventListener('click',saveProgramming);

document.querySelectorAll('[data-mach-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mach-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-mach-panel]').forEach(x=>x.hidden=x.dataset.machPanel!==b.dataset.machTab);if(b.dataset.machTab==='recepcion')loadReception();if(b.dataset.machTab==='faltantes')loadMissing();if(b.dataset.machTab==='programacion')loadProgramming();if(b.dataset.machTab==='novedades')loadNovelties()});
document.querySelectorAll('input[name="recCompleteChoice"]').forEach(x=>x.addEventListener('change',()=>{const incomplete=x.checked&&x.value==='NO';document.querySelector('#recMissingSection').hidden=!incomplete;if(incomplete&&recMissingDraft.length===0){recMissingDraft.push({perfil:'',cantidad:1,longitud:'',observacion:''});renderMissingEditor()}if(!incomplete){recMissingDraft=[];renderMissingEditor()}}));
document.querySelector('#recRefresh')?.addEventListener('click',loadReception);document.querySelector('#recSearch')?.addEventListener('input',renderReception);document.querySelector('#addMissing')?.addEventListener('click',()=>{recMissingDraft.push({perfil:'',cantidad:1,longitud:'',observacion:''});const no=document.querySelector('input[name="recCompleteChoice"][value="NO"]');if(no)no.checked=true;document.querySelector('#recMissingSection').hidden=false;renderMissingEditor()});document.querySelector('#recClose')?.addEventListener('click',()=>document.querySelector('#recModal').hidden=true);document.querySelector('#recCancel')?.addEventListener('click',()=>document.querySelector('#recModal').hidden=true);document.querySelector('#recSave')?.addEventListener('click',saveReception);

document.querySelector('#saveShiftConfig')?.addEventListener('click',async()=>{const v={lunes_sabado:{turno1:{inicio:document.querySelector('#cfgWeekT1Start').value,fin:document.querySelector('#cfgWeekT1End').value},turno2:{inicio:document.querySelector('#cfgWeekT2Start').value,fin:document.querySelector('#cfgWeekT2End').value}},domingo:{turno1:{inicio:document.querySelector('#cfgSunT1Start').value,fin:document.querySelector('#cfgSunT1End').value},turno2:{inicio:document.querySelector('#cfgSunT2Start').value,fin:document.querySelector('#cfgSunT2End').value}}};try{const c=await getSupabaseClient(),{error}=await c.rpc('sgp_configuracion_general_guardar',{p_token:getAppToken(),p_clave:'HORARIOS_TURNOS',p_valor:v});if(error)throw error;sgpGeneralConfig.HORARIOS_TURNOS=v;alert('Horarios guardados correctamente')}catch(e){alert('No fue posible guardar los horarios: '+(e?.message||e))}});



let pickingRows=[];

let pickingReceptionRows=[],pickAuditTarget=null,pickAuditDifferences=[],pickingReceptionLoadId=0;
async function loadPickingReception(){
 const host=document.querySelector('#pickReceptionBoard');
 if(!host||!getAppToken())return;
 const requestId=++pickingReceptionLoadId;
 host.innerHTML='<div class="empty-state">Cargando órdenes por auditar…</div>';
 const warning=document.querySelector('#pickReceptionWeekWarning');
 if(warning){warning.hidden=true;warning.textContent=''}
 try{
  const db=await getSupabaseClient(),token=getAppToken();
  // La RPC de recepción no devuelve semana. La cola de Picking ya contiene
  // la semana operativa por id_programacion (sin tocar funciones de Supabase).
  const [reception,programming]=await Promise.all([
   db.rpc('sgp_picking_recepcion_cola',{p_token:token}),
   db.rpc('sgp_picking_cola',{p_token:token})
  ]);
  if(requestId!==pickingReceptionLoadId)return;
  if(reception.error)throw reception.error;
  pickingReceptionRows=attachReceptionWeeks(reception.data||[],programming.error?[]:(programming.data||[]));
  const ct=document.querySelector('#pickReceptionCount');
  if(ct)ct.textContent=pickingReceptionRows.length;
  const select=document.querySelector('#pickReceptionWeek');
  if(select){
   const previous=select.value,options=receptionWeekOptions(pickingReceptionRows);
   select.innerHTML='<option value="">Todas las semanas</option>'+options.map(o=>'<option value="'+o.value+'">'+o.label+'</option>').join('');
   select.value=options.some(o=>o.value===previous)?previous:'';
  }
  if(warning&&programming.error){
   warning.textContent='No fue posible consultar la semana de programación. Puedes continuar auditando y volver a intentar con «Actualizar recepción».';
   warning.hidden=false;
  }
  renderPickingReception();
 }catch(e){
  if(requestId!==pickingReceptionLoadId)return;
  pickingReceptionRows=[];
  const ct=document.querySelector('#pickReceptionCount');
  if(ct)ct.textContent='0';
  const status=document.querySelector('#pickReceptionFilterStatus');
  if(status)status.textContent='';
  host.innerHTML='<div class="empty-state">No fue posible cargar recepción: '+escapeHtml(e.message||String(e))+'</div>';
 }
}
function renderPickingReception(){
 const host=document.querySelector('#pickReceptionBoard');if(!host)return;
 const q=document.querySelector('#pickReceptionSearch')?.value||'';
 const week=document.querySelector('#pickReceptionWeek')?.value||'';
 const rows=filterReceptionRows(pickingReceptionRows,{week,search:q});
 const status=document.querySelector('#pickReceptionFilterStatus');
 if(status)status.textContent=(week||q.trim()?'Mostrando '+rows.length+' de '+pickingReceptionRows.length:'Total: '+pickingReceptionRows.length)+' órdenes pendientes de auditoría';
 const groups=new Map();
 rows.forEach(x=>{
  const semana=normalizeReceptionWeek(x.semana);
  const key=JSON.stringify([x.reserva??'—',x.parte??'—',semana]);
  if(!groups.has(key))groups.set(key,{reserva:x.reserva||'—',parte:x.parte||'—',semana,sistema:x.sistema||'—',acabado:x.acabado||'—',rows:[]});
  groups.get(key).rows.push(x);
 });
 host.innerHTML=groups.size?[...groups.values()].map(g=>
  '<section class="pick-reception-group"><header><div class="pick-reception-group-head"><span class="pick-week-badge">SEM '+escapeHtml(g.semana||'—')+'</span><div><b>Reserva '+escapeHtml(g.reserva)+'</b><span> · Parte '+escapeHtml(g.parte)+'</span><small>'+escapeHtml(g.sistema)+' · '+escapeHtml(g.acabado)+'</small>'+sharedReserveNoticeHtml(g.reserva)+'</div></div><strong>'+g.rows.length+' orden'+(g.rows.length===1?'':'es')+'</strong></header>'+
  g.rows.map(x=>{
   const meta=sharedMetaFromEmbedded(x,x.reserva),semana=normalizeReceptionWeek(x.semana);
   return '<div class="pick-reception-card grouped '+(isSharedMeta(meta)?'shared-row':'')+'"><div><strong>'+escapeHtml(x.produccion||'—')+' · '+escapeHtml(x.proyecto||'')+'</strong>'+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'')+'<small>Semana '+escapeHtml(semana||'sin identificar')+' · '+escapeHtml(x.cantidad_ventanas||0)+' ventanas</small></div><div><span class="prod-state pick-status-yellow">PICKING</span><span class="pick-delivery-state">'+(x.completa?'COMPLETA · POR VALIDAR':'CON PENDIENTES · POR VALIDAR')+'</span></div><div><small>Entrega '+escapeHtml(x.fecha_entrega||'—')+' · '+escapeHtml(x.turno_entrega||'—')+'</small><small>Por '+escapeHtml(x.usuario_entrega||'—')+'</small></div><div class="pick-reception-actions"><button data-audit-pieces="'+x.id_programacion+'" data-production="'+escapeHtml(x.produccion||'')+'">Ver piezas</button><button class="primary" data-audit="'+x.id_entrega+'">Auditar</button></div></div>';
  }).join('')+'</section>'
 ).join(''):'<div class="empty-state">'+(pickingReceptionRows.length?'No hay órdenes pendientes de auditoría para los filtros seleccionados.':'No hay órdenes pendientes de auditoría.')+'</div>';
 host.querySelectorAll('[data-audit-pieces]').forEach(b=>b.onclick=()=>openPickingPieces(b.dataset.auditPieces,b.dataset.production));
 host.querySelectorAll('[data-audit]').forEach(b=>b.onclick=()=>openPickingAudit(b.dataset.audit));
}
function openPickingAudit(id){
 const x=pickingReceptionRows.find(r=>r.id_entrega===id);if(!x)return;
 pickAuditTarget=x;pickAuditDifferences=[];
 const meta=sharedMetaFromEmbedded(x,x.reserva);
 document.querySelector('#pickAuditTitle').textContent='Auditoría · '+(x.produccion||'—');
 document.querySelector('#pickAuditMeta').innerHTML='Reserva '+escapeHtml(x.reserva||'—')+' · Parte '+escapeHtml(x.parte||'—')+' · '+escapeHtml(x.sistema||'—')+' · '+escapeHtml(x.acabado||'—')+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'');
 document.querySelector('#pickAuditDeliveryInfo').innerHTML='<div class="pick-audit-status"><span class="prod-state pick-status-yellow">PICKING</span><b>'+(x.completa?'COMPLETA':'CON PENDIENTES')+'</b><span>Entrega '+escapeHtml(x.fecha_entrega||'—')+' · '+escapeHtml(x.turno_entrega||'—')+'</span></div>';
 document.querySelector('#pickAuditMissing').innerHTML=(x.faltantes||[]).length?'<h4>Faltantes reportados por entrega</h4>'+(x.faltantes||[]).map(f=>'<div class="pick-audit-missing" data-fid="'+f.id_faltante+'"><div><b>'+escapeHtml(f.perfil||'—')+'</b><span>Reserva: '+escapeHtml(f.reserva||x.reserva||'—')+' · Acabado: '+escapeHtml(f.acabado||x.acabado||'—')+'</span><span>Marca: '+escapeHtml(f.marca||'—')+' · Fabricación: '+escapeHtml(f.fabricacion||'—')+' · Longitud: '+escapeHtml(f.longitud??'—')+' · Cant: '+escapeHtml(f.cantidad||1)+'</span><small>'+escapeHtml(f.observacion||'Sin observación')+'</small></div><label>Ventanas afectadas<input type="number" min="1" max="'+escapeHtml(x.cantidad_ventanas||999)+'" value="'+escapeHtml(f.ventanas_afectadas||1)+'" data-audit-windows></label></div>').join(''):'<div class="empty-state">La entrega fue reportada completa.</div>';
 document.querySelector('#pickAuditObs').value='';
 const dh=document.querySelector('#pickAuditDifferences');if(dh){dh.innerHTML='';dh.hidden=true}
 document.querySelector('#pickAuditModal').hidden=false
}
async function openAuditDifferenceEditor(){
 if(!pickAuditTarget)return;
 const host=document.querySelector('#pickAuditDifferences');host.hidden=false;
 if(!pickAuditDifferences.length){
  try{
   const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_picking_piezas_panel',{p_token:getAppToken(),p_id_programacion:pickAuditTarget.id_programacion,p_produccion:pickAuditTarget.produccion});if(error)throw error;
   const meta=sharedMetaFromEmbedded(pickAuditTarget,pickAuditTarget.reserva),opts=sharedReserveOptions(meta,pickAuditTarget.reserva,pickAuditTarget.acabado),first=opts[0]||{};
   pickAuditDifferences.push({id_pieza:'',perfil:'',marca:'',fabricacion:'',longitud:'',cantidad:1,ventanas_afectadas:1,observacion:'',reserva:first.reserva||'',acabado:first.acabado||'',pieces:data||[],collapsed:false});
   renderAuditDifferences()
  }catch(e){alert('No fue posible cargar las piezas de la orden: '+e.message)}
 }else renderAuditDifferences()
}
function auditDiffRefs(d){return [...new Set((d.pieces||[]).map(p=>p.perfil||p.codigo_sap).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function renderAuditDifferences(){
 const host=document.querySelector('#pickAuditDifferences');if(!host)return;host.hidden=false;
 const meta=sharedMetaFromEmbedded(pickAuditTarget,pickAuditTarget?.reserva),opts=sharedReserveOptions(meta,pickAuditTarget?.reserva||'',pickAuditTarget?.acabado||'');
 const reserveSelect=(d,i)=>'<div class="shared-pending-choice"><label>Reserva del pendiente<select data-diff-reserve="'+i+'">'+opts.map(x=>'<option value="'+escapeHtml(x.reserva)+'" data-finish="'+escapeHtml(x.acabado||'')+'" '+(String(x.reserva)===String(d.reserva)?'selected':'')+'>'+escapeHtml(x.reserva)+' · '+escapeHtml(reserveRelationLabel(x))+' · '+escapeHtml(x.acabado||'ACABADO POR CONFIRMAR')+'</option>').join('')+'</select></label><label>Acabado<input data-diff-finish="'+i+'" value="'+escapeHtml(d.acabado||'')+'" placeholder="Indica el acabado real"></label></div>';
 host.innerHTML='<h4>Diferencias encontradas en auditoría</h4><p class="pick-delivery-help">Agrega cada faltante y selecciona la reserva/acabado del material. Cuando la orden tiene varias reservas asociadas, selecciona la combinación reserva/acabado correcta.</p>'+pickAuditDifferences.map((d,i)=>'<div class="pick-missing-card '+(d.collapsed?'pick-missing-collapsed':'')+'" data-audit-diff="'+i+'"><div class="pick-missing-card-head"><b>Faltante '+(i+1)+'</b><span class="pick-missing-summary">'+(d.perfil?escapeHtml(d.perfil)+' · '+escapeHtml(d.reserva||'—')+' · '+escapeHtml(d.acabado||'—'):'')+'</span><button type="button" data-diff-toggle="'+i+'">'+(d.collapsed?'Editar':'Contraer')+'</button>'+(i?'<button type="button" class="pick-remove-missing" data-diff-del="'+i+'">Eliminar</button>':'')+'</div><div class="pick-missing-body">'+reserveSelect(d,i)+'<div class="pick-missing-ref"><label>Referencia<select data-diff-ref="'+i+'"><option value="">Seleccionar…</option>'+auditDiffRefs(d).map(v=>'<option '+(v===d.perfil?'selected':'')+'>'+escapeHtml(v)+'</option>').join('')+'</select></label></div><div data-diff-choices="'+i+'" class="pick-piece-choices" '+(d.perfil?'':'hidden')+'></div><div class="pick-missing-entry" '+(d.id_pieza?'':'hidden')+' data-diff-entry="'+i+'"><div class="pick-selected-piece" data-diff-selected="'+i+'"></div><div class="pick-missing-inputs"><label>Cantidad faltante<input data-diff-k="cantidad" data-diff-i="'+i+'" type="number" min="1" value="'+escapeHtml(d.cantidad||1)+'"></label><label>Ventanas afectadas<input data-diff-k="ventanas_afectadas" data-diff-i="'+i+'" type="number" min="1" max="'+escapeHtml(pickAuditTarget.cantidad_ventanas||999)+'" value="'+escapeHtml(d.ventanas_afectadas||1)+'"></label></div><label>Observación<textarea data-diff-k="observacion" data-diff-i="'+i+'" rows="2" placeholder="Detalle del faltante…">'+escapeHtml(d.observacion||'')+'</textarea></label></div></div></div>').join('')+'<button type="button" class="pick-add-missing" id="pickAuditAddDifference">+ Agregar otro faltante</button>';
 pickAuditDifferences.forEach((d,i)=>renderAuditDiffChoices(i,d.perfil));
 host.querySelectorAll('[data-diff-reserve]').forEach(el=>el.onchange=()=>{const i=+el.dataset.diffReserve,d=pickAuditDifferences[i],op=el.selectedOptions[0];d.reserva=el.value;d.acabado=op?.dataset.finish||'';renderAuditDifferences()});
 host.querySelectorAll('[data-diff-finish]').forEach(el=>el.oninput=()=>{pickAuditDifferences[+el.dataset.diffFinish].acabado=el.value});
 host.querySelectorAll('[data-diff-ref]').forEach(el=>el.onchange=()=>{const i=+el.dataset.diffRef,d=pickAuditDifferences[i];Object.assign(d,{id_pieza:'',perfil:el.value,marca:'',fabricacion:'',longitud:''});renderAuditDifferences()});
 host.querySelectorAll('[data-diff-k]').forEach(el=>el.oninput=()=>{pickAuditDifferences[+el.dataset.diffI][el.dataset.diffK]=el.type==='number'?Number(el.value):el.value});
 host.querySelectorAll('[data-diff-toggle]').forEach(el=>el.onclick=()=>{const d=pickAuditDifferences[+el.dataset.diffToggle];d.collapsed=!d.collapsed;renderAuditDifferences()});
 host.querySelectorAll('[data-diff-del]').forEach(el=>el.onclick=()=>{pickAuditDifferences.splice(+el.dataset.diffDel,1);renderAuditDifferences()});
 document.querySelector('#pickAuditAddDifference')?.addEventListener('click',()=>{pickAuditDifferences.forEach(d=>d.collapsed=!!d.id_pieza);const pieces=pickAuditDifferences[0]?.pieces||[],first=opts[0]||{};pickAuditDifferences.push({id_pieza:'',perfil:'',marca:'',fabricacion:'',longitud:'',cantidad:1,ventanas_afectadas:1,observacion:'',reserva:first.reserva||'',acabado:first.acabado||'',pieces,collapsed:false});renderAuditDifferences()})
}
function renderAuditDiffChoices(i,ref){const d=pickAuditDifferences[i],box=document.querySelector('[data-diff-choices="'+i+'"]'),entry=document.querySelector('[data-diff-entry="'+i+'"]'),sel=document.querySelector('[data-diff-selected="'+i+'"]');if(!box)return;if(!ref){box.hidden=true;return}const rows=(d.pieces||[]).map((p,idx)=>({p,idx})).filter(x=>(x.p.perfil||x.p.codigo_sap)===ref);box.hidden=false;box.innerHTML='<div class="pick-choice-title">Selecciona la pieza faltante</div><div class="pick-choice-head"><span>Marca</span><span>Fabricación</span><span>Longitud</span><span>Cant.</span></div>'+rows.map(x=>'<button type="button" class="pick-choice-row '+(String(x.p.id_pieza)===String(d.id_pieza)?'selected':'')+'" data-audit-piece="'+x.idx+'"><span>'+escapeHtml(x.p.marca||'—')+'</span><span>'+escapeHtml(x.p.fabricacion||'—')+'</span><span>'+escapeHtml(x.p.longitud??'—')+'</span><span>'+escapeHtml(x.p.cantidad??0)+'</span></button>').join('');box.querySelectorAll('[data-audit-piece]').forEach(b=>b.onclick=()=>{const p=d.pieces[+b.dataset.auditPiece];Object.assign(d,{id_pieza:p.id_pieza,perfil:p.perfil||p.codigo_sap,marca:p.marca||'',fabricacion:p.fabricacion||'',longitud:p.longitud??'',cantidad:1});renderAuditDifferences()});if(d.id_pieza&&entry&&sel){entry.hidden=false;sel.innerHTML='<b>'+escapeHtml(d.perfil)+'</b><span>Marca: '+escapeHtml(d.marca||'—')+'</span><span>Fabricación: '+escapeHtml(d.fabricacion||'—')+'</span><span>Longitud: '+escapeHtml(d.longitud??'—')+'</span>'}}
async function savePickingAudit(){
 if(!pickAuditTarget)return;
 const faltantes=[...document.querySelectorAll('.pick-audit-missing')].map(w=>({id_faltante:w.dataset.fid,id_pieza:(pickAuditTarget.faltantes||[]).find(f=>f.id_faltante===w.dataset.fid)?.id_pieza||'',ventanas_afectadas:Number(w.querySelector('[data-audit-windows]').value||0)}));
 if(faltantes.some(f=>f.ventanas_afectadas<1)){alert('Indica cuántas ventanas afecta cada faltante.');return}
 if(pickAuditDifferences.some(d=>!d.reserva||!String(d.acabado||'').trim())){alert('Cada diferencia debe indicar la reserva y el acabado correspondiente.');return}
 try{const db=await getSupabaseClient(),{error}=await db.rpc('sgp_picking_validar_recepcion',{p_token:getAppToken(),p_id_entrega:pickAuditTarget.id_entrega,p_faltantes:faltantes,p_diferencias:pickAuditDifferences,p_observacion:document.querySelector('#pickAuditObs').value||null});if(error)throw error;document.querySelector('#pickAuditModal').hidden=true;await Promise.all([loadPickingReception(),loadPicking()])}catch(e){alert('No fue posible validar la recepción: '+e.message)}
}
async function loadPicking(){
 const host=document.querySelector('#pickBoard');if(!host||!getAppToken())return;host.innerHTML='<div class="empty-state">Cargando cola de Picking…</div>';
 try{
  const db=await getSupabaseClient();await ensureSharedReservations();
  const [{data,error},{data:weeks,error:weekError}]=await Promise.all([db.rpc('sgp_picking_cola',{p_token:getAppToken()}),db.rpc('sgp_picking_semanas',{p_token:getAppToken()})]);
  if(error)throw error;if(weekError)throw weekError;pickingRows=data||[];
  const pw=document.querySelector('#pickWeek'),pc=pw?.value||'';if(pw){const ws=(weeks||[]).map(String);pw.innerHTML='<option value="">Todas las semanas</option>'+ws.map(v=>'<option value="'+v+'">Semana '+v+'</option>').join('');pw.value=ws.includes(pc)?pc:''}
  renderPicking()
 }catch(e){host.innerHTML='<div class="empty-state">No fue posible cargar Picking: '+escapeHtml(e.message||String(e))+'</div>'}
}
function renderOpenPickingDeliveries(){
 const host=document.querySelector('#pickOpenBoard'),count=document.querySelector('#pickOpenCount');if(!host)return;
 const groups=new Map();
 pickingRows.forEach(x=>{const key=String(x.reserva||'—')+'|'+String(x.parte||'—');if(!groups.has(key))groups.set(key,{reserva:x.reserva||'—',parte:x.parte||'—',semana:x.semana||'—',sistema:x.sistema||'—',acabado:x.acabado||'—',rows:[]});groups.get(key).rows.push(x)});
 const open=[...groups.values()].map(g=>{const orders=g.rows.flatMap(x=>(x.ordenes||[]).map(o=>({row:x,order:o})));const started=orders.filter(z=>!!z.order.entrega_estado),completed=orders.filter(z=>z.order.entrega_estado==='ENTREGADA'),pending=orders.filter(z=>!z.order.entrega_estado);const dates=started.map(z=>z.order.fecha_entrega).filter(Boolean).sort();const firstDate=dates[0]||null;const daysOpen=firstDate?Math.max(0,Math.floor((new Date(new Date().toLocaleString('en-US',{timeZone:'America/Bogota'})).setHours(0,0,0,0)-new Date(firstDate+'T00:00:00').getTime())/86400000)):0;return {...g,orders,started,completed,pending,firstDate,daysOpen}}).filter(g=>g.started.length&&g.pending.length);
 if(count)count.textContent=open.length;
 host.innerHTML=open.length?open.map(g=>'<details class="pick-open-card"><summary><div class="pick-open-main"><div class="pick-week-badge">SEM '+escapeHtml(g.semana)+'</div><div><b>Reserva '+escapeHtml(g.reserva)+'</b><span> · Parte '+escapeHtml(g.parte)+'</span>'+sharedReserveNoticeHtml(g.reserva)+'<small style="display:block;margin-top:4px"><b>'+escapeHtml(g.sistema)+'</b> · '+escapeHtml(g.acabado)+'</small><small style="display:block;margin-top:3px">Primera entrega: <b>'+escapeHtml(g.firstDate||'—')+'</b> · <b>'+g.daysOpen+' día'+(g.daysOpen===1?'':'s')+' abierta</b></small></div></div><div class="pick-open-progress"><strong>'+g.started.length+' iniciada'+(g.started.length===1?'':'s')+'</strong><span>'+g.pending.length+' pendiente'+(g.pending.length===1?'':'s')+'</span></div></summary><div class="pick-open-orders">'+g.pending.map(z=>{const meta=sharedMetaFromEmbedded(z.order,z.row.reserva);return '<div class="pick-open-order '+(isSharedMeta(meta)?'shared-row':'')+'"><div><strong>'+escapeHtml(z.order.produccion||'—')+'</strong>'+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'')+'<small>'+escapeHtml(z.order.proyecto||z.row.sistema||'')+'</small></div><div><span class="prod-state '+prodStateClass(z.order.entrega_estado?'PICKING':(z.order.estado_mecanizado||z.row.estado||'PROGRAMADA'))+'">'+escapeHtml(z.order.entrega_estado?'PICKING':(z.order.estado_mecanizado||z.row.estado||'PROGRAMADA'))+'</span></div><b>'+escapeHtml(z.order.cantidad||0)+' und</b><button class="primary" data-open-delivery="'+z.row.id_programacion+'" data-production="'+escapeHtml(z.order.produccion||'')+'">Entregar</button></div>'}).join('')+'</div></details>').join(''):'<div class="empty-state">Sin partidas abiertas de entrega.</div>';
 host.querySelectorAll('[data-open-delivery]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();deliverPickingOrder(b.dataset.openDelivery,b.dataset.production)})
}
function renderPicking(){
 const host=document.querySelector('#pickBoard'),sum=document.querySelector('#pickSummary');if(!host)return;
 renderOpenPickingDeliveries();
 const q=(document.querySelector('#pickSearch')?.value||'').toLowerCase(),st=document.querySelector('#pickState')?.value||'',wk=document.querySelector('#pickWeek')?.value||'';
 const partCompare=(a,b)=>comparePriority(a,b);
 const deliveryGroupInfo=x=>{const sameReserve=pickingRows.filter(r=>String(r.reserva||'')===String(x.reserva||'')),samePart=sameReserve.filter(r=>String(r.parte||'')===String(x.parte||'')),orderStates=(samePart.length?samePart:[x]).flatMap(r=>(r.ordenes||[]).map(o=>o.entrega_estado||'')),reserveStates=sameReserve.flatMap(r=>(r.ordenes||[]).map(o=>o.entrega_estado||''));return {partStarted:orderStates.some(Boolean),partPending:orderStates.some(s=>!s),reserveStarted:reserveStates.some(Boolean),reservePending:reserveStates.some(s=>!s)}};
 const rows=pickingRows.filter(x=>(!wk||String(x.semana||'')===wk)&&(!st||x.estado===st)&&(!q||[x.reserva,x.produccion,x.sistema,x.acabado,JSON.stringify(x.ordenes||[])].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>{const eo={PROCESADO:0,MECANIZADO:1,CORTE:2,PROGRAMADA:3},ea=eo[a.estado]??9,eb=eo[b.estado]??9;if(ea!==eb)return ea-eb;const rr=String(a.reserva||'').localeCompare(String(b.reserva||''),undefined,{numeric:true});if(rr)return rr;return partCompare(a.parte,b.parte)||Number(a.prioridad||999)-Number(b.prioridad||999)});
 sum.innerHTML='<div><span>En cola</span><b>'+pickingRows.length+'</b></div><div><span>Procesadas</span><b>'+pickingRows.filter(x=>x.estado==='PROCESADO').length+'</b></div><div><span>Pend. validación</span><b>'+pickingRows.filter(x=>x.estado_entrega==='PENDIENTE_VALIDACION').length+'</b></div><div><span>Pend. corrección</span><b>'+pickingRows.filter(x=>x.estado_entrega==='PENDIENTE_CORRECCION').length+'</b></div>';
 host.innerHTML=rows.length?rows.map(x=>{const info=deliveryGroupInfo(x);return '<details class="pick-card '+(((info.partStarted&&info.partPending)||(info.reserveStarted&&info.reservePending))?'pick-partial-delivery':'')+'"><summary><div class="pick-res"><div class="pick-week-badge">SEM '+escapeHtml(x.semana||'—')+'</div><div class="pick-res-copy"><b>Reserva '+escapeHtml(x.reserva||'—')+'</b><span><strong>Prioridad '+escapeHtml(x.prioridad||'—')+'</strong> · Parte '+escapeHtml(x.parte||'—')+(priorityDepth(x.parte)===3?' <span class="priority-level3-chip">Nivel 3</span>':'')+' · '+escapeHtml(x.turno||'—')+'</span>'+sharedReserveNoticeHtml(x.reserva)+'</div></div><div class="pick-product"><b>'+escapeHtml(x.sistema||'—')+'</b><span>'+escapeHtml(x.acabado||'—')+'</span><small>'+(x.ordenes?.length?x.ordenes.length+' órdenes asociadas':'Sin órdenes asociadas')+'</small>'+((info.partStarted&&info.partPending)?'<span class="pick-delivery-alert">⚠ ENTREGA PARCIAL DE LA PARTE</span>':(info.reserveStarted&&info.reservePending)?'<span class="pick-delivery-alert">⚠ RESERVA CON ENTREGA PARCIAL</span>':'')+'</div><span class="prod-state '+prodStateClass(x.estado||'PROGRAMADA')+'">'+escapeHtml(x.estado||'PROGRAMADA')+'</span><strong>'+escapeHtml(x.cantidad_ventanas||0)+' und</strong></summary><div class="pick-detail"><div class="pick-part-actions"><button data-pick-pieces="'+x.id_programacion+'">Ver piezas de toda la parte</button></div><div class="pick-orders"><b>Órdenes de esta parte</b><div class="pick-order-head"><span>Orden / Proyecto</span><span>Cant.</span><span>Observaciones de Mecanizado</span><span>Novedad Mec.</span></div><div class="pick-order-list">'+(x.ordenes?.length?x.ordenes.map(o=>{const meta=sharedMetaFromEmbedded(o,x.reserva);return '<div class="pick-order-row '+(isSharedMeta(meta)?'shared-row':'')+'"><div class="pick-order-name"><strong>'+escapeHtml(o.produccion||'—')+'</strong>'+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'')+'</div><div class="pick-order-qty"><b>'+escapeHtml(o.cantidad||0)+'</b></div><div class="pick-order-obs">'+escapeHtml(o.observacion_mecanizado||'Sin observación de mecanizado')+'</div><div class="pick-order-nov">'+(Number(o.novedades||0)>0?'<button class="pick-nov-yes" data-pick-nov="'+x.id_programacion+'" data-production="'+escapeHtml(o.produccion||'')+'">SÍ · '+o.novedades+'</button>':'<span class="pick-nov-no">NO</span>')+'</div><div class="pick-order-state"><span class="prod-state '+prodStateClass(o.entrega_estado?'PICKING':(o.estado_mecanizado||x.estado||'PROGRAMADA'))+'">'+escapeHtml(o.entrega_estado?'PICKING':(o.estado_mecanizado||x.estado||'PROGRAMADA'))+'</span>'+(o.entrega_estado?'<span class="pick-delivery-state delivery-'+String(o.entrega_estado).toLowerCase()+'">'+escapeHtml(o.entrega_estado==='ENTREGADA'?'ENTREGADA':o.entrega_estado==='PENDIENTE_VALIDACION'?(o.entrega_completa===false?'CON PENDIENTES · POR VALIDAR':'POR VALIDAR'):o.entrega_estado==='PENDIENTE_CORRECCION'?'PDT CORRECCIÓN':o.entrega_estado)+'</span>':'')+'</div><button data-pick-order-pieces="'+x.id_programacion+'" data-production="'+escapeHtml(o.produccion||'')+'">Ver piezas</button><button class="primary" data-pick-order-delivery="'+x.id_programacion+'" data-production="'+escapeHtml(o.produccion||'')+'" '+(o.entrega_estado==='ENTREGADA'?'disabled':'')+'>'+(o.entrega_estado==='ENTREGADA'?'Entregada':'Entrega')+'</button></div>'}).join(''):'<em>Sin órdenes asociadas</em>')+'</div></div><div class="pick-notes"><b>Observaciones de Producción</b><p>'+escapeHtml(x.observacion||'Sin observación de reserva')+'</p><p>'+escapeHtml(x.observacion_orden||'Sin observación de orden')+'</p><span>'+escapeHtml(x.novedades||0)+' novedades abiertas</span></div><div class="pick-actions"><button class="primary" data-pick-delivery="'+x.id_programacion+'">Entrega</button></div></div></details>'}).join(''):'<div class="empty-state">No hay producciones para los filtros seleccionados.</div>';
 host.querySelectorAll('[data-pick-pieces]').forEach(b=>b.onclick=()=>openPickingPieces(b.dataset.pickPieces,null));
 host.querySelectorAll('[data-pick-order-pieces]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openPickingPieces(b.dataset.pickOrderPieces,b.dataset.production)});
 host.querySelectorAll('[data-pick-nov]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openPickingOrderNovelties(b.dataset.pickNov,b.dataset.production)});
 host.querySelectorAll('[data-pick-order-delivery]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();deliverPickingOrder(b.dataset.pickOrderDelivery,b.dataset.production)});
 host.querySelectorAll('[data-pick-delivery]').forEach(b=>b.onclick=()=>alert('La entrega ahora se realiza por cada orden.'))
}
async function openPickingPieces(id,production=null){const x=pickingRows.find(r=>r.id_programacion===id);if(!x)return;try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_picking_piezas_panel',{p_token:getAppToken(),p_id_programacion:id,p_produccion:production||null});if(error)throw error;currentPieceRows=(data||[]).map(p=>({...p,codigo_sap:p.codigo_sap||p.perfil,perfil:p.perfil||p.codigo_sap}));currentPieceContext=production?'order':'picking-part';currentPieceView=production?'summary':'pickorders';els.pieceModalTitle.textContent=production?'Orden '+production:'Reserva '+(x.reserva||'—')+' · Parte '+(x.parte||'—');const ord=production?(x.ordenes||[]).find(o=>String(o.produccion||'')===String(production||'')):null;els.pieceModalMeta.innerHTML='<strong>Línea:</strong> PANEL &nbsp; <strong>Sistema:</strong> '+escapeHtml(x.sistema||'—')+' &nbsp; <strong>Acabado:</strong> '+escapeHtml(x.acabado||'—')+(production?' &nbsp; <strong>Ventanas:</strong> '+escapeHtml(ord?.cantidad??'—'):'');els.pieceModal.hidden=false;renderPieceModal()}catch(e){console.error('Picking despiece:',e);alert('No fue posible cargar el despiece: '+(e?.message||e))}}
function renderPickingPartPieces(){const rows=currentPieceRows||[],body=els.pieceProfileBody,head=els.pieceProfileHead,foot=els.pieceProfileFoot;if(!body)return;const grouped=new Map();rows.forEach(r=>{const op=String(r.produccion||'—'),key=op+'|'+String(r.perfil||r.codigo_sap||'—');if(!grouped.has(key))grouped.set(key,{op,perfil:r.perfil||r.codigo_sap||'—',cantidad:0});grouped.get(key).cantidad+=Number(r.cantidad||0)});const out=[...grouped.values()].sort((a,b)=>a.op.localeCompare(b.op,undefined,{numeric:true})||a.perfil.localeCompare(b.perfil,undefined,{numeric:true}));if(els.pieceDetailedOptions)els.pieceDetailedOptions.hidden=true;head.innerHTML='<tr><th>OP</th><th>Referencia</th><th>Cantidad</th></tr>';let last='',block=-1;body.innerHTML=out.length?out.map(r=>{const first=r.op!==last;if(first){last=r.op;block++}return '<tr class="pick-piece-block-'+(block%2)+'"><td>'+(first?'<strong>'+escapeHtml(r.op)+'</strong>':'')+'</td><td><strong>'+escapeHtml(r.perfil)+'</strong></td><td><strong>'+escapeHtml(r.cantidad)+'</strong></td></tr>'}).join(''):'<tr><td colspan="3" class="empty">Sin piezas tipo PANEL para esta parte.</td></tr>';foot.innerHTML='<tr><td colspan="2"><strong>Total general</strong></td><td><strong>'+out.reduce((n,r)=>n+r.cantidad,0)+'</strong></td></tr>'}
async function openPickingOrderNovelties(id,production){try{if(!noveltyRows.length)await loadNovelties();const rows=noveltyRows.filter(n=>n.id_programacion===id&&n.produccion===production&&n.estado!=='RESUELTA');if(!rows.length){alert('No hay novedades abiertas para esta orden.');return}if(rows.length===1){openNoveltyDetail(rows[0].id_novedad);return}const choice=rows.map((n,i)=>(i+1)+'. '+(n.tipo||'Novedad')+' · '+(n.perfil||'—')+' · '+(n.observacion||'Sin observación')).join('\n');alert('Novedades de '+production+'\n\n'+choice)}catch(e){alert('No fue posible consultar novedades: '+e.message)}}
let pickDeliveryTarget=null,pickDeliveryPieces=[],pickDeliveryComplete=null,pickMissingCount=0;
async function deliverPickingOrder(id,production){
 const x=pickingRows.find(r=>r.id_programacion===id);if(!x)return;
 const ord=(x.ordenes||[]).find(o=>String(o.produccion||'')===String(production||'')),meta=sharedMetaFromEmbedded(ord,x.reserva),reserveOptions=sharedReserveOptions(meta,x.reserva,x.acabado);
 pickDeliveryTarget={id,production,reserva:x.reserva,acabado:x.acabado,key_produccion:ord?.key_produccion||meta?.key_produccion||null,sharedMeta:meta,reserveOptions};
 pickDeliveryComplete=null;pickDeliveryPieces=[];pickMissingCount=0;
 document.querySelector('#pickDeliveryTitle').textContent='Entrega · '+production;
 document.querySelector('#pickDeliveryMeta').innerHTML='Reserva '+escapeHtml(x.reserva||'—')+' · Parte '+escapeHtml(x.parte||'—')+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'');
 document.querySelector('#pickDeliveryObs').value='';
 const fd=document.querySelector('#pickDeliveryDate'),ts=document.querySelector('#pickDeliveryShift');if(fd)fd.value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);if(ts)ts.value=x.turno||'';
 document.querySelector('#pickDeliveryMissing').hidden=true;document.querySelector('#pickMissingForms').innerHTML='';document.querySelector('#pickDeliverySave').disabled=true;document.querySelector('#pickDeliveryModal').hidden=false;document.querySelectorAll('[data-pick-complete]').forEach(b=>b.classList.remove('active'))
}
async function pickDeliverySetComplete(value,btn){pickDeliveryComplete=value;document.querySelectorAll('[data-pick-complete]').forEach(b=>b.classList.toggle('active',b===btn));const miss=document.querySelector('#pickDeliveryMissing'),save=document.querySelector('#pickDeliverySave');if(value){miss.hidden=true;save.disabled=false;return}miss.hidden=false;save.disabled=true;if(!pickDeliveryPieces.length){try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_picking_piezas_panel',{p_token:getAppToken(),p_id_programacion:pickDeliveryTarget.id,p_produccion:pickDeliveryTarget.production});if(error)throw error;pickDeliveryPieces=data||[]}catch(e){alert('No fue posible cargar las piezas: '+e.message);return}}document.querySelector('#pickMissingForms').innerHTML='';pickMissingCount=0;addPickMissingForm()}
function pickRefs(){return [...new Set(pickDeliveryPieces.map(p=>p.perfil||p.codigo_sap).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function addPickMissingForm(){
 document.querySelectorAll('.pick-missing-card').forEach(w=>{if(w.dataset.pieceIndex!==undefined)w.classList.add('pick-missing-collapsed')});
 const id=++pickMissingCount,wrap=document.createElement('div'),opts=pickDeliveryTarget?.reserveOptions||[],first=opts[0]||{};
 wrap.className='pick-missing-card';wrap.dataset.missingId=id;
 wrap.innerHTML='<div class="pick-missing-card-head"><b>Faltante '+id+'</b><span class="pick-missing-summary"></span><button type="button" class="pick-missing-toggle">Contraer</button>'+(id>1?'<button type="button" class="pick-remove-missing">Eliminar</button>':'')+'</div><div class="pick-missing-body"><div class="shared-pending-choice"><label>Reserva del pendiente<select data-mf="reserve">'+opts.map(x=>'<option value="'+escapeHtml(x.reserva)+'" data-finish="'+escapeHtml(x.acabado||'')+'">'+escapeHtml(x.reserva)+' · '+escapeHtml(reserveRelationLabel(x))+' · '+escapeHtml(x.acabado||'ACABADO POR CONFIRMAR')+'</option>').join('')+'</select></label><label>Acabado<input data-mf="finish" value="'+escapeHtml(first.acabado||'')+'" placeholder="Indica el acabado real"></label></div><div class="pick-missing-ref"><label>Referencia<select data-mf="ref"><option value="">Seleccionar…</option>'+pickRefs().map(v=>'<option>'+escapeHtml(v)+'</option>').join('')+'</select></label></div><div data-mf="choices" class="pick-piece-choices" hidden></div><div class="pick-missing-entry" hidden><div class="pick-selected-piece" data-mf="selected"></div><div class="pick-missing-inputs"><label>Cantidad faltante<input data-mf="qty" type="number" min="1" value="1"></label><label>NC<input data-mf="nc" placeholder="Número de NC"></label></div><label>Observación<textarea data-mf="obs" rows="2" placeholder="Detalle del faltante…"></textarea></label></div></div></div>';
 document.querySelector('#pickMissingForms').appendChild(wrap);
 const reserve=wrap.querySelector('[data-mf="reserve"]'),finish=wrap.querySelector('[data-mf="finish"]'),ref=wrap.querySelector('[data-mf="ref"]'),choices=wrap.querySelector('[data-mf="choices"]'),entry=wrap.querySelector('.pick-missing-entry');
 const syncFinish=()=>{const fin=reserve?.selectedOptions?.[0]?.dataset.finish||'';finish.value=fin;finish.readOnly=!!fin;finish.placeholder=fin?'':'Escribe el acabado real';validatePickMissing()};if(reserve){reserve.onchange=syncFinish;syncFinish()}
 ref.onchange=()=>{delete wrap.dataset.pieceIndex;entry.hidden=true;if(!ref.value){choices.hidden=true;choices.innerHTML='';validatePickMissing();return}const rows=pickDeliveryPieces.map((p,i)=>({p,i})).filter(x=>(x.p.perfil||x.p.codigo_sap)===ref.value);choices.hidden=false;choices.innerHTML='<div class="pick-choice-title">Selecciona la pieza faltante</div><div class="pick-choice-head"><span>Marca</span><span>Fabricación</span><span>Longitud</span><span>Cant.</span></div>'+rows.map(x=>'<button type="button" class="pick-choice-row" data-piece-index="'+x.i+'"><span>'+escapeHtml(x.p.marca||'—')+'</span><span>'+escapeHtml(x.p.fabricacion||'—')+'</span><span>'+escapeHtml(x.p.longitud??'—')+'</span><span>'+escapeHtml(x.p.cantidad??0)+'</span></button>').join('');choices.querySelectorAll('[data-piece-index]').forEach(b=>b.onclick=()=>{choices.querySelectorAll('.pick-choice-row').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');wrap.dataset.pieceIndex=b.dataset.pieceIndex;const p=pickDeliveryPieces[Number(b.dataset.pieceIndex)];wrap.querySelector('[data-mf="selected"]').innerHTML='<b>'+escapeHtml(ref.value)+'</b><span>Marca: '+escapeHtml(p.marca||'—')+'</span><span>Fabricación: '+escapeHtml(p.fabricacion||'—')+'</span><span>Longitud: '+escapeHtml(p.longitud??'—')+'</span>';const qty=wrap.querySelector('[data-mf="qty"]');qty.max=Number(p.cantidad||1);qty.value=1;entry.hidden=false;const summary=wrap.querySelector('.pick-missing-summary');if(summary)summary.textContent=ref.value+' · '+reserve.value+' · '+(finish.value||'ACABADO POR CONFIRMAR');validatePickMissing()})};
 wrap.querySelector('.pick-missing-toggle')?.addEventListener('click',()=>{const collapsed=wrap.classList.toggle('pick-missing-collapsed');wrap.querySelector('.pick-missing-toggle').textContent=collapsed?'Editar':'Contraer'});
 wrap.querySelector('[data-mf="qty"]').oninput=validatePickMissing;finish.oninput=validatePickMissing;
 wrap.querySelector('.pick-remove-missing')?.addEventListener('click',()=>{wrap.remove();validatePickMissing()});validatePickMissing()
}
function validatePickMissing(){
 if(pickDeliveryComplete!==false)return;
 const cards=[...document.querySelectorAll('.pick-missing-card')],ok=cards.length>0&&cards.every(w=>w.dataset.pieceIndex!==undefined&&Number(w.querySelector('[data-mf="qty"]').value)>0&&w.querySelector('[data-mf="reserve"]')?.value&&w.querySelector('[data-mf="finish"]')?.value.trim());
 document.querySelector('#pickDeliverySave').disabled=!ok
}
async function savePickingDelivery(){
 if(!pickDeliveryTarget||pickDeliveryComplete===null)return;
 const faltantes=[];
 if(!pickDeliveryComplete){
  for(const w of document.querySelectorAll('.pick-missing-card')){
   const idx=Number(w.dataset.pieceIndex),p=pickDeliveryPieces[idx],qty=Number(w.querySelector('[data-mf="qty"]').value||0),reserva=w.querySelector('[data-mf="reserve"]')?.value||'',acabado=w.querySelector('[data-mf="finish"]')?.value.trim()||'';
   if(!p||qty<=0){alert('Selecciona la pieza y completa la cantidad de cada faltante.');return}
   if(!reserva||!acabado){alert('Selecciona la reserva e indica el acabado correspondiente a cada faltante.');return}
   faltantes.push({id_pieza:p.id_pieza,perfil:p.perfil||p.codigo_sap,marca:p.marca||'',fabricacion:p.fabricacion||'',longitud:p.longitud??'',cantidad:qty,reserva,acabado,nc:w.querySelector('[data-mf="nc"]').value||'',observacion:w.querySelector('[data-mf="obs"]').value||''})
  }
 }
 const save=document.querySelector('#pickDeliverySave');save.disabled=true;
 try{const db=await getSupabaseClient(),{error}=await db.rpc('sgp_picking_entrega_orden',{p_token:getAppToken(),p_id_programacion:pickDeliveryTarget.id,p_produccion:pickDeliveryTarget.production,p_completa:pickDeliveryComplete,p_observacion:document.querySelector('#pickDeliveryObs').value||null,p_faltantes:faltantes,p_fecha_entrega:document.querySelector('#pickDeliveryDate')?.value||null,p_turno:document.querySelector('#pickDeliveryShift')?.value||null});if(error)throw error;document.querySelector('#pickDeliveryModal').hidden=true;await loadPicking()}catch(e){alert('No fue posible guardar la entrega: '+e.message);save.disabled=false}
}
document.querySelectorAll('[data-pick-complete]').forEach(b=>b.addEventListener('click',()=>pickDeliverySetComplete(b.dataset.pickComplete==='true',b)));document.querySelector('#pickAddMissing')?.addEventListener('click',addPickMissingForm);document.querySelector('#pickDeliverySave')?.addEventListener('click',savePickingDelivery);document.querySelector('#pickDeliveryClose')?.addEventListener('click',()=>document.querySelector('#pickDeliveryModal').hidden=true);document.querySelector('#pickDeliveryCancel')?.addEventListener('click',()=>document.querySelector('#pickDeliveryModal').hidden=true);
document.querySelector('#pickRefresh')?.addEventListener('click',loadPicking);document.querySelector('#pickSearch')?.addEventListener('input',renderPicking);document.querySelector('#pickState')?.addEventListener('change',renderPicking);document.querySelector('#pickWeek')?.addEventListener('change',renderPicking);
let noveltyRows=[];
async function loadNovelties(){const body=document.querySelector('#novBody');if(!body||!getAppToken())return;body.innerHTML='<tr><td colspan="11" class="empty-state">Cargando novedades…</td></tr>';try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_mecanizado_novedades_listar',{p_token:getAppToken(),p_desde:null,p_hasta:null});if(error)throw error;noveltyRows=data||[];const w=document.querySelector('#novWeek'),cur=w?.value||'';if(w){const weeks=[...new Set(noveltyRows.map(x=>String(x.semana||'')).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));w.innerHTML='<option value="">Todas las semanas</option>'+weeks.map(v=>'<option value="'+escapeHtml(v)+'">Semana '+escapeHtml(v)+'</option>').join('');w.value=cur}renderNovelties()}catch(e){body.innerHTML='<tr><td colspan="11" class="empty-state">No fue posible cargar novedades: '+escapeHtml(e.message||String(e))+'</td></tr>'}}
function renderNovelties(){const body=document.querySelector('#novBody'),sum=document.querySelector('#novSummary');if(!body)return;const q=(document.querySelector('#novSearch')?.value||'').trim().toLowerCase(),st=document.querySelector('#novState')?.value||'',org=document.querySelector('#novOrigin')?.value||'',wk=document.querySelector('#novWeek')?.value||'';const rows=noveltyRows.filter(x=>(!wk||String(x.semana||'')===wk)&&(!st||x.estado===st)&&(!org||x.origen===org)&&(!q||[x.reserva,x.parte,x.produccion,x.perfil,x.numero_nc,x.ticket_mtto,x.tipo,x.reportado_por].some(v=>String(v||'').toLowerCase().includes(q))));const pending=noveltyRows.filter(x=>x.estado==='PENDIENTE_RESOLVER').length;sum.innerHTML='<div><span>Total novedades</span><b>'+noveltyRows.length+'</b></div><div class="nov-kpi-attention"><span>Por definir</span><b>'+pending+'</b></div><div><span>Reportadas</span><b>'+noveltyRows.filter(x=>x.estado==='REPORTADA').length+'</b></div><div><span>Visibles</span><b>'+rows.length+'</b></div>';body.innerHTML=rows.length?rows.map(x=>{const ref=x.numero_nc||x.ticket_mtto||x.numero_novedad||'POR DEFINIR',att=x.estado==='PENDIENTE_RESOLVER';return '<tr class="nov-row '+(att?'nov-attention':'')+'" data-nov-open="'+x.id_novedad+'"><td><b>'+escapeHtml(x.semana||'—')+'</b></td><td>'+escapeHtml(String(x.creado_en||'').slice(0,16).replace('T',' '))+'</td><td><b>'+escapeHtml(x.reserva||'—')+'</b><small>Parte '+escapeHtml(x.parte||'—')+' · '+escapeHtml(x.turno||'—')+'</small></td><td>'+escapeHtml(x.produccion||'—')+'</td><td>'+escapeHtml(x.perfil||'—')+(x.longitud?'<small>'+escapeHtml(String(x.longitud))+' pulg</small>':'')+'</td><td>'+escapeHtml(x.cantidad??'—')+'</td><td><b>'+escapeHtml(String(x.origen||'').replaceAll('_',' '))+'</b><small>'+escapeHtml(x.tipo||'')+'</small></td><td><b class="'+(ref==='POR DEFINIR'?'nov-ref-pending':'')+'">'+escapeHtml(ref)+'</b></td><td><span class="nov-state '+(att?'pending':'reported')+'">'+(att?'POR DEFINIR':escapeHtml(x.estado||'REPORTADA'))+'</span></td><td><b>'+escapeHtml(String(x.reportado_por||'—').toUpperCase())+'</b></td><td>'+escapeHtml(x.observacion||'—')+'</td></tr>'}).join(''):'<tr><td colspan="11" class="empty-state">No hay novedades para los filtros seleccionados.</td></tr>';body.querySelectorAll('[data-nov-open]').forEach(row=>row.onclick=()=>openNoveltyDetail(row.dataset.novOpen))}

function openNoveltyDetail(id){const x=noveltyRows.find(n=>n.id_novedad===id);if(!x)return;const m=document.querySelector('#novDetailModal');m.dataset.id=id;document.querySelector('#novDetailTitle').textContent='Novedad - '+(x.reserva||'-');document.querySelector('#novDetailMeta').textContent=(x.produccion?'Orden '+x.produccion+' - ':'')+(x.tipo||'');document.querySelector('#novDetailInfo').innerHTML='<div><span>Reserva / parte</span><b>'+escapeHtml(x.reserva||'-')+' / '+escapeHtml(x.parte||'-')+'</b></div><div><span>Orden</span><b>'+escapeHtml(x.produccion||'-')+'</b></div><div><span>Perfil</span><b>'+escapeHtml(x.perfil||'-')+'</b></div><div><span>Cantidad</span><b>'+escapeHtml(x.cantidad??'-')+'</b></div><div><span>Longitud</span><b>'+escapeHtml(x.longitud??'-')+'</b></div><div><span>Cortes afectados</span><b>'+escapeHtml(x.cortes_afectados||'-')+'</b></div><div><span>Origen</span><b>'+escapeHtml(String(x.origen||'').replaceAll('_',' '))+'</b></div><div><span>Reportado por</span><b>'+escapeHtml(x.reportado_por||'-')+'</b></div>';document.querySelector('#novEditState').value=x.estado||'PENDIENTE_RESOLVER';document.querySelector('#novEditNC').value=x.numero_nc||'';document.querySelector('#novEditSolution').value=x.reserva_solucion||'';document.querySelector('#novEditObs').value=x.observacion||'';m.hidden=false}
async function saveNoveltyUpdate(){const m=document.querySelector('#novDetailModal'),id=m?.dataset.id;if(!id)return;try{const db=await getSupabaseClient(),{error}=await db.rpc('sgp_mecanizado_novedad_actualizar',{p_token:getAppToken(),p_id:id,p_estado:document.querySelector('#novEditState').value,p_observacion:document.querySelector('#novEditObs').value,p_numero_nc:document.querySelector('#novEditNC').value,p_reserva_solucion:document.querySelector('#novEditSolution').value});if(error)throw error;m.hidden=true;await loadNovelties()}catch(e){alert('No fue posible actualizar la novedad: '+e.message)}}
document.querySelector('#novRefresh')?.addEventListener('click',loadNovelties);document.querySelector('#novSearch')?.addEventListener('input',renderNovelties);document.querySelector('#novState')?.addEventListener('change',renderNovelties);document.querySelector('#novOrigin')?.addEventListener('change',renderNovelties);document.querySelector('#novWeek')?.addEventListener('change',renderNovelties);document.querySelector('#novDetailClose')?.addEventListener('click',()=>document.querySelector('#novDetailModal').hidden=true);document.querySelector('#novDetailCancel')?.addEventListener('click',()=>document.querySelector('#novDetailModal').hidden=true);document.querySelector('#novDetailSave')?.addEventListener('click',saveNoveltyUpdate);
let prodRows=[],prodNoveltyTarget=null,prodNoveltyProduction=null,prodNoveltySharedMeta=null;
const PROD_STATES=['SIN INICIAR','CORTE','MECANIZADO','PROCESADO'];
const noveltyTypes={PROVEEDOR:['Detalle de proveedor'],BODEGA:['Detalle del perfil','Error de acabado','Medida errada'],MECANIZADO_PERSONAL:['Daño de pieza por personal'],MECANIZADO_MAQUINA:['Daño de pieza por máquina'],INGENIERIA:['XML no disponible','Error de fabricación','Información / plano','Otro'],CALIDAD:['Novedad de calidad','Liberación / definición','Otro']};
function prodStateClass(s){return 'state-'+String(s||'SIN INICIAR').toLowerCase().replace(/\s+/g,'-')}

let prodPendingWeekSort='asc';
async function loadAluminumPending(){
 const host=document.querySelector('#prodAluminumPending');if(!host||!getAppToken())return;
 try{
  const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_aluminio_pendientes_listar',{p_token:getAppToken(),p_solo_abiertos:true});if(error)throw error;
  const rows=(data||[]).slice().sort((a,b)=>{const av=Number(a.semana)||999,bv=Number(b.semana)||999;return prodPendingWeekSort==='asc'?av-bv:bv-av});
  const states=['PENDIENTE','REPO_OK','CORTE','MECANIZADO','PROCESADO','PICKING'];
  host.innerHTML=rows.length?'<section class="al-pending-card"><div class="al-pending-head"><div><b>⚠ Pendientes de aluminio / reposiciones</b><span>Piezas pendientes detectadas en Producción, Picking o Línea</span></div><strong>'+rows.length+'</strong></div><div class="al-pending-sort"><button type="button" data-pending-week-sort>SEMANA '+(prodPendingWeekSort==='asc'?'↑':'↓')+'</button><span>Ordenado por semana de programación</span></div><div class="al-pending-list">'+rows.map(x=>{const validated=repoIsValidated(x),state=String(x.estado_repo||'PENDIENTE');return '<div class="al-pending-row repo-'+state.toLowerCase()+'" data-prod-pending-open="'+escapeHtml(x.id_pendiente)+'"><div class="al-pending-week"><b>SEM '+escapeHtml(x.semana||'—')+'</b></div><div><b>'+escapeHtml(x.produccion||x.reserva||'—')+'</b><span><strong>PDT '+escapeHtml(x.cantidad||0)+'</strong> · '+escapeHtml(x.perfil||'—')+(x.marca?' · '+escapeHtml(x.marca):'')+(x.fabricacion?' · '+escapeHtml(x.fabricacion):'')+(x.longitud?' · '+escapeHtml(String(x.longitud)):'')+(x.nc?' · NC '+escapeHtml(x.nc):'')+'</span><small>'+escapeHtml(x.observacion||'')+'</small></div><div><b class="repo-state">'+escapeHtml(state==='REPO_OK'?'REPO OK · LISTO PARA SACAR':state)+'</b><span>'+repoValidationBadgeHtml(x,false)+'</span></div><div class="repo-actions">'+(validated?'<select data-repo-state="'+x.id_pendiente+'">'+states.map(st=>'<option value="'+st+'" '+(state===st?'selected':'')+'>'+(st==='REPO_OK'?'REPO OK':st)+'</option>').join('')+'</select>':'<span class="repo-mech-lock">🔒 BLOQUEADO PARA MECANIZADO</span>')+'</div></div>'}).join('')+'</div></section>':'<section class="al-pending-card empty"><b>✓ Sin pendientes de aluminio por resolver</b></section>';
  host.querySelector('[data-pending-week-sort]')?.addEventListener('click',()=>{prodPendingWeekSort=prodPendingWeekSort==='asc'?'desc':'asc';loadAluminumPending()});
  host.querySelectorAll('[data-prod-pending-open]').forEach(row=>row.onclick=e=>{if(e.target.closest('select,button'))return;const x=rows.find(r=>String(r.id_pendiente)===String(row.dataset.prodPendingOpen));if(x)openRepoPendingDetail(x)});
  host.querySelectorAll('[data-repo-state]').forEach(sel=>sel.onchange=async()=>{const {error}=await db.rpc('sgp_aluminio_pendiente_estado',{p_token:getAppToken(),p_id:sel.dataset.repoState,p_estado:sel.value,p_observacion:null});if(error){alert(error.message);await loadAluminumPending();return}await loadAluminumPending()})
 }catch(e){console.error('Pendientes aluminio:',e)}
}

// Reporte de entrega de turno de mecanizado
function shiftReportState(row){return String(row?.ejecucion?.estado||'PROGRAMADA').toUpperCase()}
function shiftReportExecuted(row){
 const qty=Number(row?.cantidad_programada||0),st=shiftReportState(row);
 const saved=Number(row?.ejecucion?.cantidad_procesada||0);
 if(st==='PROCESADO')return qty;
 return Math.max(0,Math.min(qty,saved));
}
function shiftReportWeek(date){const d=new Date(date+'T12:00:00'),jan4=new Date(d.getFullYear(),0,4,12),start=new Date(jan4);start.setDate(jan4.getDate()-((jan4.getDay()+6)%7));return Math.floor((d-start)/604800000)+1}
async function buildShiftReportData(date,turno){
 const db=await getSupabaseClient();
 let q=db.from('sgp_mecanizado_programacion').select('*').eq('fecha_programacion',date).neq('estado','CANCELADA').order('prioridad');
 if(turno)q=q.eq('turno',turno);
 const {data:program,error}=await q;if(error)throw error;
 const rows=program||[],ids=rows.map(x=>x.id_programacion);
 let exec=[],orderStates=[],nov=[];
 if(ids.length){
  const [er,or,nr]=await Promise.all([
   db.from('sgp_mecanizado_ejecucion').select('*').in('id_programacion',ids),
   db.from('sgp_mecanizado_ejecucion_orden').select('*').in('id_programacion',ids),
   db.from('sgp_mecanizado_novedades').select('*').in('id_programacion',ids)
  ]);
  if(er.error)throw er.error;if(or.error)throw or.error;if(nr.error)throw nr.error;
  exec=er.data||[];orderStates=or.data||[];nov=nr.data||[];
 }
 const detailed=[];
 for(const x of rows){
  const oe=orderStates.filter(e=>e.id_programacion===x.id_programacion);
  const re=exec.find(e=>e.id_programacion===x.id_programacion);
  let orders=[];
  try{const dr=await db.rpc('sgp_mecanizado_ordenes_programacion',{p_token:getAppToken(),p_id_programacion:x.id_programacion});if(!dr.error)orders=dr.data||[]}catch(_){}
  const programmed=Number(x.cantidad_programada||0);
  let executed=0,state=re?.estado||'PROGRAMADA';
  if(orders.length){
   executed=orders.reduce((n,o)=>{const os=oe.find(e=>String(e.produccion)===String(o.produccion));return n+(String(os?.estado||'PROGRAMADA')==='PROCESADO'?Number(o.cantidad||0):0)},0);
   if(oe.length){state=oe.every(e=>e.estado==='PROCESADO')?'PROCESADO':oe.some(e=>e.estado==='MECANIZADO')?'MECANIZADO':oe.some(e=>e.estado==='CORTE')?'CORTE':state}
  }else executed=shiftReportExecuted({...x,ejecucion:re});
  detailed.push({...x,ejecucion:re,novedades:nov.filter(n=>n.id_programacion===x.id_programacion),_orders:orders,_orderStates:oe,_executed:Math.min(programmed,executed),_state:state});
 }
 let cq=db.from('sgp_mecanizado_reportes_turno').select('comentario_general').eq('fecha',date);
 if(turno)cq=cq.eq('turno',turno);else cq=cq.eq('turno','TODOS');
 const cr=await cq.maybeSingle();
 return {date,turno:turno||'',rows:detailed,comment:cr.data?.comentario_general||''};
}
function shiftReportSummary(d){
 const programmed=d.rows.reduce((n,x)=>n+Number(x.cantidad_programada||0),0);
 const executed=d.rows.reduce((n,x)=>n+Number(x._executed||0),0);
 const pending=Math.max(0,programmed-executed),pct=programmed?Math.round(executed/programmed*100):0;
 const systems={};d.rows.forEach(x=>{const k=x.sistema||'SIN SISTEMA',g=systems[k]||(systems[k]={system:k,programmed:0,complete:0});g.programmed+=Number(x.cantidad_programada||0);g.complete+=Number(x._executed||0)});
 return {programmed,executed,pending,pct,systems:Object.values(systems).map(x=>({...x,inProcess:Math.max(0,x.programmed-x.complete)}))};
}
function shiftReportEsc(v){return escapeHtml(v==null?'—':String(v))}
function shiftReportPreviewHtml(d){
 const s=shiftReportSummary(d),week=shiftReportWeek(d.date),pending=d.rows.filter(x=>Number(x._executed||0)<Number(x.cantidad_programada||0));
 const nov=d.rows.flatMap(x=>(x.novedades||[]).map(n=>({...n,reserva:x.reserva})));
 const fmtDate=new Date(d.date+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
 const stateBadge=st=>'<span class="shift-r-state '+prodStateClass(st)+'">'+shiftReportEsc(st)+'</span>';
 return '<div class="shift-report-sheet">'+
 '<header class="shift-r-head"><div><b>SGP ONE</b><span>PLATAFORMA DE PRODUCCIÓN</span><strong>MECANIZADO</strong></div><div><h2>REPORTE DE PRODUCCIÓN · MECANIZADO</h2><p>Línea: '+shiftReportEsc(d.rows?.[0]?.id_linea||d.rows?.[0]?.linea||'Todas')+' · Desde: '+shiftReportEsc(d.date)+' · Hasta: '+shiftReportEsc(d.date)+' · '+shiftReportEsc(d.turno||'Todos los turnos')+'</p></div><div><small>Generado: '+shiftReportEsc(new Date().toLocaleString('es-CO'))+'</small><b>'+shiftReportEsc(currentAuth?.nombre||currentAuth?.usuario||'SGP ONE')+'</b></div></header>'+
 '<section><h3>RESUMEN DEL TURNO</h3><div class="shift-r-kpis"><article><span>Programado</span><b>'+s.programmed+'</b><small>unidades</small></article><article class="ok"><span>Ejecutado</span><b>'+s.executed+'</b><small>unidades</small></article><article class="warn"><span>Pendiente</span><b>'+s.pending+'</b><small>unidades</small></article><article><span>Avance del turno</span><b>'+s.pct+'%</b><small>'+s.executed+' / '+s.programmed+'</small></article></div><div class="shift-r-progress"><i style="width:'+s.pct+'%"></i></div></section>'+
 '<div class="shift-r-topgrid"><section><h3>AVANCE POR SISTEMA</h3><table><thead><tr><th>Sistema</th><th>Programadas</th><th>Completas</th><th>En proceso</th></tr></thead><tbody>'+s.systems.map(x=>'<tr><th>'+shiftReportEsc(x.system)+'</th><td>'+x.programmed+'</td><td><b class="shift-r-complete">'+x.complete+'</b></td><td><b class="shift-r-process">'+x.inProcess+'</b></td></tr>').join('')+'</tbody></table></section><section><h3>COMENTARIO GENERAL DEL TURNO</h3><div class="shift-r-comment">'+shiftReportEsc(d.comment||'Sin comentario general registrado.').replaceAll('\n','<br>')+'</div></section></div>'+
 '<section><h3>PROGRAMACIÓN VS EJECUCIÓN (POR RESERVA)</h3><div class="shift-r-tablewrap"><table><thead><tr><th>SEM.</th><th>PARTE</th><th>RESERVA</th><th>ORDEN / PROYECTO</th><th>SISTEMA</th><th>PROGRAMADO</th><th>EJECUTADO</th><th>SALDO</th><th>ESTADO</th></tr></thead><tbody>'+d.rows.map(x=>{const saldo=Math.max(0,Number(x.cantidad_programada||0)-Number(x._executed||0)),part=x.prioridad_semanal||'—',order=x._orders?.length?x._orders.map(o=>o.produccion||o.proyecto).filter(Boolean).slice(0,2).join(' / '):(x.produccion||'—');return '<tr><td>'+week+'</td><td>'+shiftReportEsc(part)+'</td><td>'+shiftReportEsc(x.reserva)+'</td><td>'+shiftReportEsc(order)+'</td><td>'+shiftReportEsc(x.sistema)+'</td><td>'+Number(x.cantidad_programada||0)+'</td><td>'+Number(x._executed||0)+'</td><td>'+saldo+'</td><td>'+stateBadge(x._state)+'</td></tr>'}).join('')+'</tbody></table></div></section>'+
 '<div class="shift-r-bottomgrid"><section><h3>PENDIENTES PARA EL SIGUIENTE TURNO</h3><table><thead><tr><th>Reserva</th><th>Sistema</th><th>Saldo</th><th>Estado</th><th>Observación</th></tr></thead><tbody>'+(pending.length?pending.map(x=>'<tr><td>'+shiftReportEsc(x.reserva)+'</td><td>'+shiftReportEsc(x.sistema)+'</td><td>'+Math.max(0,Number(x.cantidad_programada||0)-Number(x._executed||0))+'</td><td>'+stateBadge(x._state)+'</td><td>'+shiftReportEsc(x.ejecucion?.observacion||x.observacion||'—')+'</td></tr>').join(''):'<tr><td colspan="5">Sin pendientes.</td></tr>')+'</tbody></table></section><section><h3>NOVEDADES DEL TURNO</h3><table><thead><tr><th>Reserva</th><th>Orden</th><th>Novedad</th><th>Estado</th></tr></thead><tbody>'+(nov.length?nov.map(n=>'<tr><td>'+shiftReportEsc(n.reserva)+'</td><td>'+shiftReportEsc(n.produccion||'—')+'</td><td>'+shiftReportEsc((n.tipo||'')+(n.observacion?' · '+n.observacion:''))+'</td><td>'+shiftReportEsc(n.estado||'ABIERTA')+'</td></tr>').join(''):'<tr><td colspan="4">Sin novedades registradas.</td></tr>')+'</tbody></table></section></div>'+
 '<footer><b>SGP ONE</b><span>Plataforma de Producción · Reporte de Turno · Mecanizado</span></footer></div>';
}
async function saveShiftReportComment(d,comment){
 const db=await getSupabaseClient(),turno=d.turno||'TODOS';
 const {error}=await db.from('sgp_mecanizado_reportes_turno').upsert({fecha:d.date,turno,comentario_general:comment,usuario:currentAuth?.usuario||'',actualizado_en:new Date().toISOString()},{onConflict:'fecha,turno'});if(error)throw error;d.comment=comment;
}
function shiftReportError(error){
 const detail=String(error?.message||error?.details||error?.hint||error||'Error desconocido');
 return detail==='undefined'||detail==='[object Object]'?'No se pudo completar la operación. Comprueba la conexión y vuelve a intentarlo.':detail;
}
function shiftReportDownloadName(d,extension){
 return 'SGP_Reporte_Turno_'+d.date+'_'+(d.turno||'TODOS').replaceAll(' ','_')+'.'+extension;
}
async function shiftReportCapture(preview){
 try{await ensureReportExportLibs(false)}catch(error){throw new Error('No se pudo cargar la biblioteca de imágenes. Comprueba que los archivos de exportación estén disponibles en el servidor SGP_ONE.',{cause:error})}
 if(typeof window.html2canvas!=='function')throw new Error('No se pudo cargar la biblioteca de imágenes. Comprueba el acceso a los recursos de exportación.');
 const sheet=preview.querySelector('.shift-report-sheet');
 if(!sheet)throw new Error('No hay una vista previa disponible para exportar.');
 const canvas=await window.html2canvas(sheet,{scale:2,useCORS:true,backgroundColor:'#fff',windowWidth:sheet.scrollWidth,windowHeight:sheet.scrollHeight});
 if(!canvas?.width||!canvas?.height)throw new Error('La captura del reporte está vacía.');
 return canvas;
}
async function openShiftReport(){
 const initialDate=document.querySelector('#prodDate')?.value,initialTurno=document.querySelector('#prodShift')?.value||'';
 if(!initialDate)return alert('Selecciona la fecha del reporte.');
 try{
  let d=await buildShiftReportData(initialDate,initialTurno),busy=false;
  let m=document.querySelector('#shiftReportModal');
  if(!m){m=document.createElement('div');m.id='shiftReportModal';m.className='rec-overlay shift-report-overlay';document.body.appendChild(m)}
  m.innerHTML='<div class="shift-report-modal"><div class="shift-report-modal-head"><div><small>REPORTE DE TURNO</small><h3>Generar reporte de turno</h3></div><button type="button" class="modal-close" data-shift-report-close>×</button></div><div class="shift-report-work"><aside><label>Fecha<input type="date" data-shift-report-date value="'+shiftReportEsc(initialDate)+'"></label><label>Turno<select data-shift-report-turno><option value="">Todos los turnos</option><option value="TURNO 1">Turno 1</option><option value="TURNO 2">Turno 2</option></select></label><div class="shift-report-mini" data-shift-report-summary></div><label>Comentario general del turno<textarea data-shift-report-comment rows="8" maxlength="1200" placeholder="Resumen para el líder del siguiente turno y coordinación..."></textarea></label><p class="shift-report-help">El comentario se guarda por fecha y turno y se incluye en PDF e imagen.</p><p class="shift-report-error" data-shift-report-error role="alert" hidden></p><div class="shift-report-actions"><button type="button" data-shift-preview>Vista previa</button><button type="button" class="primary" data-shift-pdf>Generar PDF</button><button type="button" data-shift-image>Generar imagen</button></div></aside><main data-shift-report-preview></main></div></div>';
  m.hidden=false;m.scrollTop=0;
  const dateInput=m.querySelector('[data-shift-report-date]'),turnoInput=m.querySelector('[data-shift-report-turno]'),comment=m.querySelector('[data-shift-report-comment]'),preview=m.querySelector('[data-shift-report-preview]'),summary=m.querySelector('[data-shift-report-summary]'),errorBox=m.querySelector('[data-shift-report-error]'),buttons=[...m.querySelectorAll('.shift-report-actions button')];
  turnoInput.value=initialTurno;
  const showError=e=>{errorBox.textContent=shiftReportError(e);errorBox.hidden=false;console.error('Reporte de turno:',e)};
  const clearError=()=>{errorBox.textContent='';errorBox.hidden=true};
  const render=()=>{const z=shiftReportSummary(d);summary.innerHTML='<span>Programado <b>'+z.programmed+'</b></span><span>Ejecutado <b>'+z.executed+'</b></span><span>Pendiente <b>'+z.pending+'</b></span><span>Avance <b>'+z.pct+'%</b></span>';comment.value=d.comment||'';preview.innerHTML=shiftReportPreviewHtml(d)};
  const setBusy=value=>{busy=value;buttons.forEach(button=>button.disabled=value);dateInput.disabled=value;turnoInput.disabled=value};
  const run=async fn=>{if(busy)return;setBusy(true);clearError();try{await fn()}catch(e){showError(e)}finally{setBusy(false)}};
  const saveComment=async()=>{const value=comment.value.trim();if(value===d.comment)return;await saveShiftReportComment(d,value)};
  const updateFilters=async()=>{
   const nextDate=dateInput.value,nextTurno=turnoInput.value;
   try{
    if(!nextDate)throw new Error('Selecciona una fecha válida.');
    if(nextDate===d.date&&nextTurno===d.turno)return;
    // Nunca guardar el comentario de un turno bajo la fecha o turno siguiente.
    await saveComment();
    const next=await buildShiftReportData(nextDate,nextTurno);
    d=next;render();
   }catch(error){dateInput.value=d.date;turnoInput.value=d.turno;throw error}
  };
  const refresh=async()=>{
   const draft=comment.value.trim();
   if(draft!==d.comment){try{await saveShiftReportComment(d,draft)}catch(error){showError(new Error('No se pudo guardar el comentario. El archivo incluirá el texto escrito, pero quedará pendiente de guardar: '+shiftReportError(error),{cause:error}))}}
   preview.innerHTML=shiftReportPreviewHtml({...d,comment:draft});
  };
  m.querySelector('[data-shift-report-close]').onclick=()=>{if(!busy)m.hidden=true};
  dateInput.onchange=()=>run(updateFilters);
  turnoInput.onchange=()=>run(updateFilters);
  m.querySelector('[data-shift-preview]').onclick=()=>run(refresh);
  m.querySelector('[data-shift-image]').onclick=()=>run(async()=>{
   await refresh();
   const canvas=await shiftReportCapture(preview),a=document.createElement('a');
   a.download=shiftReportDownloadName(d,'png');a.href=canvas.toDataURL('image/png');a.click();
  });
  m.querySelector('[data-shift-pdf]').onclick=()=>run(async()=>{
   await refresh();
   const canvas=await shiftReportCapture(preview);
   if(!window.jspdf?.jsPDF){try{await ensureReportExportLibs(true)}catch(error){throw new Error('No se pudo cargar la biblioteca PDF. Comprueba que los archivos de exportación estén disponibles en el servidor SGP_ONE.',{cause:error})}}
   const Pdf=window.jspdf?.jsPDF;
   if(typeof Pdf!=='function')throw new Error('No se pudo cargar la biblioteca PDF. Comprueba el acceso a los recursos de exportación.');
   const pdf=new Pdf({orientation:'landscape',unit:'mm',format:'a4'}),pw=297,ph=210,margin=6,w=pw-margin*2,h=canvas.height*w/canvas.width,img=canvas.toDataURL('image/jpeg',.95);
   let y=margin,left=h;pdf.addImage(img,'JPEG',margin,y,w,h);left-=ph-margin*2;
   while(left>0){y=-(h-left)+margin;pdf.addPage();pdf.addImage(img,'JPEG',margin,y,w,h);left-=ph-margin*2}
   pdf.save(shiftReportDownloadName(d,'pdf'));
  });
  render();
 }catch(e){console.error('Reporte de turno:',e);alert('No fue posible preparar el reporte: '+shiftReportError(e))}
}

let productionBoardRequestSeq=0;
async function loadProductionBoard(){
 const requestSeq=++productionBoardRequestSeq;
 loadAluminumPending();
 const date=document.querySelector('#prodDate')?.value,shift=document.querySelector('#prodShift')?.value;if(!date)return;
 try{const db=await getSupabaseClient();const sharedPromise=ensureSharedReservations();let q=db.from('sgp_mecanizado_programacion').select('*').eq('fecha_programacion',date).neq('estado','CANCELADA').order('turno').order('prioridad');if(shift)q=q.eq('turno',shift);const {data,error}=await q;if(requestSeq!==productionBoardRequestSeq)return;if(error)throw error;
 const preview=document.querySelector('#prodBoard');
 if(preview)preview.innerHTML='<div class="empty-state"><strong>'+(data||[]).length+' programaciones encontradas</strong><p>Cargando estados de mecanizado, novedades y pendientes…</p></div>'+
 (data||[]).slice(0,60).map(x=>'<div class="prod-job" style="padding:10px 14px"><strong>'+escapeHtml(x.reserva||'Sin reserva')+'</strong> · '+Number(x.cantidad_programada||0)+' ventanas · Estado: consultando ejecución…</div>').join('');
 const weeklyMeta=new Map();let semanaPromise=Promise.resolve(null);if((data||[]).length){const idsSemana=(data||[]).map(x=>x.id_programacion);semanaPromise=db.rpc('sgp_mecanizado_semanas_programacion',{p_token:getAppToken(),p_ids:idsSemana});}let carry=[];const shifts=shift?[shift]:['TURNO 1','TURNO 2'],ids=(data||[]).map(x=>x.id_programacion);let ex=[],nov=[],orderHistory=[];const jobs=[...shifts.map(st=>db.rpc('sgp_mecanizado_pendientes_turno',{p_token:getAppToken(),p_fecha:date,p_turno:st}).then(cr=>({kind:'carry',st,cr})))];if(ids.length){jobs.push(db.from('sgp_mecanizado_ejecucion').select('*').in('id_programacion',ids).then(er=>({kind:'exec',er})),db.from('sgp_mecanizado_novedades').select('*').in('id_programacion',ids).then(nr=>({kind:'nov',nr})),db.from('sgp_mecanizado_historial_orden').select('id_programacion,produccion,estado_nuevo,fecha_evento').in('id_programacion',ids).eq('estado_nuevo','PROCESADO').then(hr=>({kind:'history',hr})))}const [results,semanaResp]=await Promise.all([Promise.all(jobs),semanaPromise,sharedPromise]);if(requestSeq!==productionBoardRequestSeq)return;
 if(semanaResp){if(semanaResp.error)console.warn('Semana de programación no disponible',semanaResp.error);else (semanaResp.data||[]).forEach(x=>weeklyMeta.set(String(x.id_programacion),x.semana))}
 results.forEach(r=>{if(r.kind==='carry'&&!r.cr.error)carry.push(...(r.cr.data||[]).map(o=>({...o,_targetShift:r.st})));else if(r.kind==='exec'&&!r.er.error)ex=r.er.data||[];else if(r.kind==='nov'&&!r.nr.error)nov=r.nr.data||[];else if(r.kind==='history'&&!r.hr.error)orderHistory=r.hr.data||[]});const cutoffFor=x=>{const base=new Date(String(x.fecha_programacion)+'T00:00:00-05:00');if(String(x.turno).toUpperCase()==='TURNO 1')base.setHours(19,5,0,0);else{base.setDate(base.getDate()+1);base.setHours(7,5,0,0)}return base};prodRows=(data||[]).map(x=>{x.semana=x.semana||weeklyMeta.get(String(x.id_programacion))||null;const ejecucion=ex.find(e=>e.id_programacion===x.id_programacion),cutoff=cutoffFor(x),processedEvents=orderHistory.filter(h=>h.id_programacion===x.id_programacion),processedAfter=processedEvents.some(h=>new Date(h.fecha_evento)>cutoff),summaryAfter=ejecucion?.estado==='PROCESADO'&&ejecucion?.actualizado_en&&new Date(ejecucion.actualizado_en)>cutoff,_noCulminado=new Date()>=cutoff&&(processedAfter||summaryAfter||((ejecucion?.estado||'PROGRAMADA')!=='PROCESADO'&&processedEvents.length===0));return {...x,ejecucion,novedades:nov.filter(n=>n.id_programacion===x.id_programacion),_noCulminado}});if(carry.length){const grouped=new Map();carry.forEach(o=>{const k=o._targetShift+'|'+o.id_programacion_origen;let g=grouped.get(k);if(!g){g={id_programacion:'carry-'+o._targetShift.replaceAll(' ','-')+'-'+o.id_programacion_origen,reserva:o.reserva,prioridad_semanal:o.prioridad_semanal,semana:o.semana,sistema:o.sistema,acabado:o.acabado,fecha_origen:o.fecha_origen,turno_origen:o.turno_origen,cantidad_programada:0,turno:o._targetShift,prioridad:-1,_carry:true,_carryOrders:[],ejecucion:{estado:o.estado},novedades:[]};grouped.set(k,g)}g.cantidad_programada+=Number(o.cantidad||0);g._carryOrders.push(o);if(o.fecha_culminacion)g._completedCarry=true});prodRows=[...grouped.values(),...prodRows]}if(requestSeq===productionBoardRequestSeq)renderProductionBoard()}catch(e){if(requestSeq!==productionBoardRequestSeq)return;console.error(e);document.querySelector('#prodBoard').innerHTML='<div class="empty-state"><strong>No fue posible cargar producción</strong><p>'+escapeHtml(e.message||String(e))+'</p></div>'}
}
function prodWeekCalendarHtml(){const selected=document.querySelector('#prodDate')?.value||progDateISO(new Date()),start=progWeekStart(selected),names=['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];let h='';for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=progDateISO(d);h+='<button type="button" data-prod-day="'+iso+'" class="'+(iso===selected?'active':'')+'"><small>'+names[i]+'</small><b>'+d.getDate()+'</b><span>'+d.toLocaleDateString('es-CO',{month:'short'}).replace('.','')+'</span></button>'}return '<div class="prod-week"><button type="button" class="prod-week-nav" data-prod-week-prev>‹</button><div class="prod-week-days">'+h+'</div><button type="button" class="prod-week-nav" data-prod-week-next>›</button></div>'}function bindProdWeek(){const root=document.querySelector('#prodWeekCalendar');if(!root)return;root.querySelectorAll('[data-prod-day]').forEach(b=>b.onclick=()=>{document.querySelector('#prodDate').value=b.dataset.prodDay;loadProductionBoard()});const move=n=>{const d=new Date(document.querySelector('#prodDate').value+'T12:00:00');d.setDate(d.getDate()+n);document.querySelector('#prodDate').value=progDateISO(d);loadProductionBoard()};root.querySelector('[data-prod-week-prev]')?.addEventListener('click',()=>move(-7));root.querySelector('[data-prod-week-next]')?.addEventListener('click',()=>move(7))}
async function openMecanizadoReprogram(id,production=null){
 const db=await getSupabaseClient();
 const {data:source,error}=await db.from('sgp_mecanizado_programacion').select('id_programacion,reserva,fecha_programacion,turno,prioridad').eq('id_programacion',id).single();
 if(error||!source){alert('No fue posible cargar la programación de origen.');return}
 let m=document.querySelector('#mecReprogramModal');
 if(!m){m=document.createElement('div');m.id='mecReprogramModal';m.className='rec-overlay';document.body.appendChild(m)}
 m.innerHTML='<div class="mec-reprogram-card"><h3>↪ Reprogramar '+(production?'orden':'reserva')+'</h3><p><b>'+escapeHtml(production||source.reserva)+'</b> · Reserva '+escapeHtml(source.reserva)+'<br>Origen: '+escapeHtml(source.fecha_programacion)+' · '+escapeHtml(source.turno)+'</p><label>Nueva fecha<input type="date" data-rp-date value="'+escapeHtml(document.querySelector('#prodDate')?.value||progDateISO(new Date()))+'"></label><label>Turno<select data-rp-shift><option>TURNO 1</option><option>TURNO 2</option></select></label><label>Prioridad<input type="number" data-rp-priority min="1" step="1" value="'+Math.max(1,Math.floor(Number(source.prioridad)||1))+'"></label><label>Motivo<textarea data-rp-motive rows="3" placeholder="Motivo de la reprogramación (obligatorio)"></textarea></label><div class="mec-reprogram-actions"><button type="button" data-rp-cancel>Cancelar</button><button type="button" class="primary" data-rp-save>Confirmar reprogramación</button></div></div>';
 m.hidden=false;
 m.querySelector('[data-rp-cancel]').onclick=()=>m.hidden=true;
 m.onclick=e=>{if(e.target===m)m.hidden=true};
 m.querySelector('[data-rp-save]').onclick=async()=>{
  const btn=m.querySelector('[data-rp-save]'),fecha=m.querySelector('[data-rp-date]').value,turno=m.querySelector('[data-rp-shift]').value,prioridad=Number(m.querySelector('[data-rp-priority]').value),motivo=m.querySelector('[data-rp-motive]').value.trim();
  if(!fecha||!Number.isInteger(prioridad)||prioridad<1||motivo.length<5)return alert('Completa fecha, prioridad y motivo (mínimo 5 caracteres).');
  if(!confirm('¿Reprogramar '+(production?'la orden '+production:'todas las órdenes de la reserva '+source.reserva)+' para '+fecha+' '+turno+'?'))return;
  btn.disabled=true;
  try{
   const name=production?'sgp_mecanizado_reprogramar_orden':'sgp_mecanizado_reprogramar_reserva';
   const args={p_token:getAppToken(),p_id_programacion:id,p_fecha:fecha,p_turno:turno,p_prioridad:prioridad,p_motivo:motivo};
   if(production)args.p_produccion=production;
   const {error:saveError}=await db.rpc(name,args);if(saveError)throw saveError;
   m.hidden=true;await loadProductionBoard();await loadProgramming();
  }catch(e){alert('No fue posible reprogramar: '+(e.message||String(e)))}finally{btn.disabled=false}
 };
}

function renderProductionBoard(){
 const host=document.querySelector('#prodBoard'),sum=document.querySelector('#prodSummary'),cal=document.querySelector('#prodWeekCalendar');if(!host)return;if(cal){cal.innerHTML=prodWeekCalendarHtml();bindProdWeek()}const regularRows=prodRows.filter(x=>!x._carry),total=regularRows.reduce((n,x)=>n+Number(x.cantidad_programada||0),0),processed=regularRows.filter(x=>(x.ejecucion?.estado||'CORTE')==='PROCESADO').reduce((n,x)=>n+Number(x.cantidad_programada||0),0)+prodRows.filter(x=>x._carry&&x._carryOrders?.every(o=>o.estado==='PROCESADO')).reduce((n,x)=>n+Number(x.cantidad_programada||0),0),nov=prodRows.reduce((n,x)=>n+x.novedades.length,0);
 sum.innerHTML='<div><span>Programadas</span><b>'+total+'</b></div><div><span>Procesadas</span><b>'+processed+'</b></div><div><span>Novedades</span><b>'+nov+'</b></div><div><span>Cumplimiento</span><b>'+(total?Math.round(processed/total*100):0)+'%</b></div>';
 if(!prodRows.length){host.innerHTML='<div class="empty-state"><strong>Sin programación</strong><p>No hay reservas programadas para los filtros seleccionados.</p></div>';return}
 const turns=[...new Set(prodRows.map(x=>x.turno))];host.innerHTML=turns.map(t=>{const tr=prodRows.filter(x=>x.turno===t),carryRows=tr.filter(x=>x._carry),regular=tr.filter(x=>!x._carry);const pending=carryRows.length?'<div class="prod-prev-pending"><div class="prod-prev-title"><b>Pendientes del turno anterior</b><span>'+carryRows.length+' reservas · '+carryRows.reduce((n,x)=>n+Number(x.cantidad_programada||0),0)+' ventanas</span></div>'+carryRows.map((x,i)=>{const done=x._carryOrders?.every(o=>o.estado==='PROCESADO'),st=done?'PROCESADO':(x.ejecucion?.estado||'PROGRAMADA'),unfinished=!done;return '<article class="prod-job '+(unfinished?'prod-unfinished':'prod-carry-done')+'"><div class="prod-job-main"><span class="prod-priority">P'+(i+1)+'</span><div class="prod-job-id"><div class="prod-res-line"><b>'+escapeHtml(x.reserva)+'</b><b class="prod-week-text">SEM '+escapeHtml(x.semana||'—')+'</b><b>'+escapeHtml(x.sistema||'—')+' · '+escapeHtml(x.acabado||'—')+'</b></div>'+sharedReserveNoticeHtml(x.reserva)+'<span>'+(done?'CULMINADA EN ESTE TURNO':'PENDIENTE')+' · Origen: '+escapeHtml(x.fecha_origen||'—')+' / '+escapeHtml(x.turno_origen||'—')+' · Parte / Prioridad '+escapeHtml(x.prioridad_semanal||'—')+(unfinished?' · <span class="prod-unfinished-tag">NO CULMINADO</span>':'')+'</span></div><div class="prod-job-qty"><b>'+Number(x.cantidad_programada||0)+'</b><span>ventanas</span></div><span class="prod-state '+prodStateClass(st)+'">'+st+'</span><button class="prod-expand" data-prod-expand="'+x.id_programacion+'">⌄</button></div><div class="prod-job-detail" data-prod-detail="'+x.id_programacion+'" hidden><div class="prod-orders-exec"><div class="prod-orders-exec-head"><b>Detalle de órdenes</b><span>Reserva / parte programada</span></div><div class="prod-order-source" data-prod-orders="'+x.id_programacion+'"></div></div><div class="prod-state-picker">'+PROD_STATES.map(s=>'<button data-prod-state="'+s+'" data-prod-id="'+x.id_programacion+'" class="'+prodStateClass(s)+' '+(st===s?'selected':'')+'">'+s+'</button>').join('')+'</div><label>Observaciones del líder<textarea data-prod-obs="'+x.id_programacion+'" placeholder="Observaciones operativas…">'+escapeHtml(x.ejecucion?.observacion||'')+'</textarea></label><div class="prod-actions"><button type="button" data-reprogram-reserve="'+x.id_programacion+'">↪ Reprogramar reserva</button>'+(x._carry?'<span class="prod-carry-order-note">Guardar cada orden pendiente desde su detalle para evitar cambios masivos.</span>':'<button data-prod-novelty="'+x.id_programacion+'">+ Reportar novedad</button><button class="primary" data-prod-save="'+x.id_programacion+'">Guardar</button>')+'</div><div class="prod-nov-list">'+(x.novedades.length?x.novedades.map(n=>'<div><b>'+escapeHtml(n.origen.replaceAll('_',' '))+'</b><span>'+escapeHtml(n.tipo||'')+'</span><em>'+escapeHtml(n.estado||'ABIERTA')+'</em></div>').join(''):'<small>Sin novedades reportadas.</small>')+'</div></div></article>'}).join('')+'</div>':'<div class="prod-prev-pending empty"><b>Pendientes del turno anterior</b><span>Sin producciones pendientes</span></div>';return '<section class="prod-turn" data-prod-turn="'+escapeHtml(t)+'"><button type="button" class="prod-turn-head" data-turn-focus="'+escapeHtml(t)+'"><div><b>'+escapeHtml(t)+'</b><span>'+escapeHtml(shiftLabelForDate(document.querySelector('#prodDate').value,t))+'</span></div><div class="prod-turn-head-actions"><strong>'+regular.reduce((n,x)=>n+Number(x.cantidad_programada||0),0)+' ventanas'+(carryRows.filter(x=>x._carryOrders?.every(o=>o.estado==='PROCESADO')).length?' · +'+carryRows.filter(x=>x._carryOrders?.every(o=>o.estado==='PROCESADO')).reduce((n,x)=>n+Number(x.cantidad_programada||0),0)+' arrastre':'')+'</strong><span class="prod-focus-icon">⛶</span></div></button>'+pending+regular.map((x,i)=>{const st=x.ejecucion?.estado||'PROGRAMADA',unfinished=Boolean(x._noCulminado);return '<article class="prod-job '+(unfinished?'prod-unfinished':'')+'"><div class="prod-job-main"><span class="prod-priority">'+(i+1)+'</span><div class="prod-job-id"><div class="prod-res-line"><b>'+escapeHtml(x.reserva)+'</b><b class="prod-week-text">SEM '+escapeHtml(x.semana||'—')+'</b><b>'+escapeHtml(x.sistema||'—')+' · '+escapeHtml(x.acabado||'—')+'</b></div>'+sharedReserveNoticeHtml(x.reserva)+'<span>Parte / Prioridad '+escapeHtml(x.prioridad_semanal||'—')+(unfinished?' · <span class="prod-unfinished-tag">NO CULMINADO</span>':'')+'</span></div><div class="prod-job-qty"><b>'+Number(x.cantidad_programada||0)+'</b><span>ventanas</span></div><span class="prod-state '+prodStateClass(st)+'">'+st+'</span><button class="prod-expand" data-prod-expand="'+x.id_programacion+'">⌄</button></div><div class="prod-job-detail" data-prod-detail="'+x.id_programacion+'" hidden><div class="prod-orders-exec"><div class="prod-orders-exec-head"><b>Detalle de órdenes</b><span>Reserva / parte programada</span></div><div class="prod-order-source" data-prod-orders="'+x.id_programacion+'"></div></div><div class="prod-state-picker">'+PROD_STATES.map(s=>'<button data-prod-state="'+s+'" data-prod-id="'+x.id_programacion+'" class="'+prodStateClass(s)+' '+(st===s?'selected':'')+'">'+s+'</button>').join('')+'</div><label>Observaciones del líder<textarea data-prod-obs="'+x.id_programacion+'" placeholder="Observaciones operativas…">'+escapeHtml(x.ejecucion?.observacion||'')+'</textarea></label><div class="prod-actions"><button type="button" data-reprogram-reserve="'+x.id_programacion+'">↪ Reprogramar reserva</button><button data-prod-novelty="'+x.id_programacion+'">+ Reportar novedad</button><button class="primary" data-prod-save="'+x.id_programacion+'">Guardar</button></div><div class="prod-nov-list">'+(x.novedades.length?x.novedades.map(n=>'<div><b>'+escapeHtml(n.origen.replaceAll('_',' '))+'</b><span>'+escapeHtml(n.tipo||'')+'</span><em>'+escapeHtml(n.estado||'ABIERTA')+'</em></div>').join(''):'<small>Sin novedades reportadas.</small>')+'</div></div></article>'}).join('')+'</section>'}).join('');
 const carryGlassRequests=new Map();
 host.querySelectorAll('[data-prod-orders]').forEach(async el=>{const x=prodRows.find(r=>r.id_programacion===el.dataset.prodOrders);try{const db=await getSupabaseClient();let orders=[],states=[];if(x?._carry){
  const originId=x._carryOrders?.[0]?.id_programacion_origen;
  let originalOrders=[];
  if(originId){
   try{
    let request=carryGlassRequests.get(originId);
    if(!request){request=db.rpc('sgp_mecanizado_ordenes_programacion',{p_token:getAppToken(),p_id_programacion:originId});carryGlassRequests.set(originId,request)}
    const {data,error}=await request;
    if(error)console.warn('Vidrio de arrastre no disponible para programación original',originId,error);
    else if(Array.isArray(data))originalOrders=data;
    else console.warn('Respuesta de vidrio no válida para programación original',originId);
   }catch(error){console.warn('Error consultando vidrio de arrastre',originId,error)}
  }
  orders=mergeCarryOrdersWithGlass(x._carryOrders,originalOrders);
  states=x._carryOrders.map(o=>({key_produccion:o.key_produccion,produccion:o.produccion,estado:o.estado,observacion:o.observacion,id_programacion:o.id_programacion_origen,_carry:true}));
 }else{const [dr,er]=await Promise.all([db.rpc('sgp_mecanizado_ordenes_programacion',{p_token:getAppToken(),p_id_programacion:x.id_programacion}),db.from('sgp_mecanizado_ejecucion_orden').select('*').eq('id_programacion',x.id_programacion)]);if(dr.error)throw dr.error;states=er.error?[]:(er.data||[]);orders=dr.data||[]}el.innerHTML=orders.length?'<div class="prod-order-table-head"><span>Orden / proyecto</span><span>Ventanas</span><span>Vidrio</span><span>Estado</span></div>'+orders.map(o=>{const oe=x?._carry?states.find(e=>e.key_produccion&&String(e.key_produccion)===String(o.key_produccion)):states.find(e=>String(e.produccion)===String(o.produccion)),os=oe?.estado||(x.ejecucion?.estado||'PROGRAMADA'),tipo=String(o.tipo||'').trim(),meta=sharedMetaFromEmbedded(o,x.reserva);return '<div class="prod-order-line prod-order-exec-row '+(isSharedMeta(meta)?'shared-row':'')+'"><div><b>'+escapeHtml(o.produccion||'—')+'</b>'+(meta?sharedBadgeHtml(meta)+sharedDetailsHtml(meta):'')+'<span>'+escapeHtml(o.proyecto||o.cliente||'')+(tipo?' · '+escapeHtml(tipo.toUpperCase()):'')+'</span></div><strong>'+Number(o.cantidad||0)+'</strong><div class="prod-glass-counts"><span class="glass-prep">Prep. <b>'+glassCountLabel(o.vidrio_preparado)+'</b></span><span class="glass-nov">Nov. <b>'+glassCountLabel(o.vidrio_novedad)+'</b></span><span class="glass-move">Trasl. <b>'+glassCountLabel(o.vidrio_traslado)+'</b></span></div><select class="prod-order-state '+prodStateClass(os)+'" data-order-state data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">'+PROD_STATES.map(s=>'<option value="'+s+'" '+(s===os?'selected':'')+'>'+s+'</option>').join('')+'</select><div class="prod-order-followup"><textarea data-order-obs placeholder="Observación de esta orden…">'+escapeHtml(oe?.observacion||'')+'</textarea><div><button type="button" data-order-novelty data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">+ Novedad</button><button type="button" class="primary" data-order-save data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">Guardar orden</button><button type="button" data-order-reprogram data-prod-id="'+(oe?._carry?oe.id_programacion:x.id_programacion)+'" data-production="'+escapeHtml(o.produccion||'')+'">↪ Reprogramar</button></div></div></div>'}).join(''):'<div class="prod-order-empty">No hay órdenes asociadas a esta parte.</div>';if(x?._carry&&orders.some(o=>[o.vidrio_preparado,o.vidrio_novedad,o.vidrio_traslado].some(v=>glassCountLabel(v)==='—')))el.insertAdjacentHTML('beforeend','<div class="prod-glass-note" role="status">— = vidrio sin información disponible de la programación original. No equivale a cero.</div>');el.querySelectorAll('[data-order-state]').forEach(s=>s.onchange=async()=>{s.className='prod-order-state '+prodStateClass(s.value);const {error}=await db.rpc('sgp_mecanizado_guardar_estado_orden',{p_token:getAppToken(),p_id_programacion:s.dataset.prodId,p_produccion:s.dataset.production,p_estado:s.value,p_observacion:null});if(error)alert('No fue posible cambiar el estado de la orden: '+error.message)});el.querySelectorAll('[data-order-save]').forEach(b=>b.onclick=async()=>{const row=b.closest('.prod-order-exec-row'),state=row.querySelector('[data-order-state]').value,observacion=row.querySelector('[data-order-obs]').value;const {error}=await db.rpc('sgp_mecanizado_guardar_estado_orden',{p_token:getAppToken(),p_id_programacion:b.dataset.prodId,p_produccion:b.dataset.production,p_estado:state,p_observacion:observacion});if(error)return alert('No fue posible guardar la orden: '+error.message);b.textContent='Guardado ✓';setTimeout(()=>b.textContent='Guardar orden',1200)});el.querySelectorAll('[data-order-novelty]').forEach(b=>b.onclick=()=>openProductionNovelty(b.dataset.prodId,b.dataset.production));el.querySelectorAll('[data-order-reprogram]').forEach(b=>b.onclick=()=>openMecanizadoReprogram(b.dataset.prodId,b.dataset.production))}catch(e){el.innerHTML='<div class="prod-order-empty">No fue posible cargar las órdenes: '+escapeHtml(e.message||String(e))+'</div>'}});


 host.querySelectorAll('[data-turn-focus]').forEach(b=>b.onclick=()=>{const sec=b.closest('.prod-turn'),focused=host.classList.contains('prod-turn-focused')&&sec.classList.contains('focused');host.classList.toggle('prod-turn-focused',!focused);host.querySelectorAll('.prod-turn').forEach(x=>x.classList.toggle('focused',!focused&&x===sec));b.querySelector('.prod-focus-icon').textContent=focused?'⛶':'✕'});
 host.querySelectorAll('[data-reprogram-reserve]').forEach(b=>b.onclick=()=>{const x=prodRows.find(r=>r.id_programacion===b.dataset.reprogramReserve);openMecanizadoReprogram(x?._carryOrders?.[0]?.id_programacion_origen||b.dataset.reprogramReserve)});
 host.querySelectorAll('[data-prod-expand]').forEach(b=>b.onclick=()=>{const d=host.querySelector('[data-prod-detail="'+b.dataset.prodExpand+'"]');d.hidden=!d.hidden;b.textContent=d.hidden?'⌄':'⌃'});
 host.querySelectorAll('[data-prod-state]').forEach(b=>b.onclick=()=>{const root=b.closest('.prod-state-picker');root.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
 host.querySelectorAll('[data-prod-save]').forEach(b=>{if(String(b.dataset.prodSave).startsWith('carry-'))b.hidden=true;else b.onclick=()=>saveProductionExecution(b.dataset.prodSave)});
 host.querySelectorAll('[data-prod-novelty]').forEach(b=>b.onclick=()=>openProductionNovelty(b.dataset.prodNovelty));
}
async function saveProductionExecution(id){const row=prodRows.find(x=>x.id_programacion===id),detail=document.querySelector('[data-prod-detail="'+id+'"]'),state=detail.querySelector('.prod-state-picker .selected')?.dataset.prodState||'PROGRAMADA',obs=detail.querySelector('[data-prod-obs]').value;try{const db=await getSupabaseClient(),{error}=await db.from('sgp_mecanizado_ejecucion').upsert({id_programacion:id,estado:state,cantidad_procesada:state==='PROCESADO'?Number(row.cantidad_programada||0):0,observacion:obs,usuario:currentAuth?.usuario||'',actualizado_en:new Date().toISOString()},{onConflict:'id_programacion'});if(error)throw error;await loadProductionBoard()}catch(e){alert('No fue posible guardar: '+e.message)}}
async function openProductionNovelty(id,production=null){
 prodNoveltyTarget=id;prodNoveltyProduction=production;
 const r=prodRows.find(x=>x.id_programacion===id);
 await ensureSharedReservations();
 prodNoveltySharedMeta=production?sharedMetaForOrder({produccion:production},r?.reserva):null;
 const options=sharedReserveOptions(prodNoveltySharedMeta,r?.reserva||'',r?.acabado||'');
 const reserveSel=document.querySelector('#prodNoveltyReserve'),finishInp=document.querySelector('#prodNoveltyFinish'),help=document.querySelector('#prodNoveltyReserveHelp');
 if(reserveSel){
  reserveSel.innerHTML=options.map((x,i)=>'<option value="'+escapeHtml(x.reserva)+'" data-finish="'+escapeHtml(x.acabado||'')+'">'+escapeHtml(x.reserva)+' · '+escapeHtml(reserveRelationLabel(x))+' · '+escapeHtml(x.acabado||'ACABADO POR CONFIRMAR')+'</option>').join('');
  const syncFinish=()=>{const op=reserveSel.selectedOptions?.[0],fin=op?.dataset.finish||'';if(finishInp){finishInp.value=fin;finishInp.readOnly=!!fin;finishInp.placeholder=fin?'':'Escribe el acabado real antes de guardar'}};
  reserveSel.onchange=()=>{syncFinish();searchProfiles()};syncFinish();
 }
 if(help)help.textContent=options.length>1?'Orden con varias reservas asociadas: selecciona la reserva y el acabado del material pendiente.':'Reserva asociada al pendiente.';
 document.querySelector('#prodNoveltyContext').textContent=(r?.reserva||'')+' · Parte '+(r?.prioridad_semanal||'—')+(production?' · Orden '+production:'');
 document.querySelector('#prodNoveltyModal').hidden=false;
 document.querySelector('#prodNoveltyOrigin').value='';document.querySelector('#prodNoveltyOrigin').dispatchEvent(new Event('change'));
 const inp=document.querySelector('#prodNoveltyProfile'),dl=document.querySelector('#prodProfileCatalog'),len=document.querySelector('#prodNoveltyLength');inp.value='';len.value='';
 let timer;
 async function searchProfiles(){try{const db=await getSupabaseClient(),selected=reserveSel?.value||r?.reserva||'',{data,error}=await db.rpc('sgp_mecanizado_perfiles_reserva',{p_token:getAppToken(),p_reserva:String(selected),p_buscar:inp.value.trim()});if(error)throw error;dl.innerHTML=(data||[]).map(p=>'<option value="'+escapeHtml(p.perfil)+'" data-length="'+escapeHtml(p.longitud??'')+'">'+escapeHtml(p.descripcion||'')+' · '+escapeHtml(p.longitud??'—')+' pulg</option>').join('')}catch(e){dl.innerHTML=''}}
 inp.oninput=()=>{clearTimeout(timer);timer=setTimeout(searchProfiles,180)};
 inp.onchange=()=>{const opt=[...dl.options].find(o=>o.value===inp.value);if(opt?.dataset.length)len.value=opt.dataset.length};
 await searchProfiles()
}
document.querySelector('#prodNoveltyOrigin')?.addEventListener('change',e=>{const o=e.target.value,t=document.querySelector('#prodNoveltyType'),lab=document.querySelector('#prodNoveltyRefLabel');t.innerHTML='<option value="">Seleccionar…</option>'+((noveltyTypes[o]||[]).map(x=>'<option>'+x+'</option>').join(''));lab.firstChild.textContent=o==='MECANIZADO_MAQUINA'?'Ticket mantenimiento ':['INGENIERIA','CALIDAD'].includes(o)?'Número de novedad ':'Número de NC ';});
document.querySelector('#prodNoveltySave')?.addEventListener('click',async()=>{
 const o=document.querySelector('#prodNoveltyOrigin').value,t=document.querySelector('#prodNoveltyType').value,ref=document.querySelector('#prodNoveltyRef').value.trim();
 if(!o||!t)return alert('Selecciona origen y tipo de novedad.');
 if((o==='MECANIZADO_PERSONAL'||o==='MECANIZADO_MAQUINA'||o==='INGENIERIA'||o==='CALIDAD')&&!ref)return alert('Debes suministrar '+(o==='MECANIZADO_MAQUINA'?'el ticket de mantenimiento':o==='MECANIZADO_PERSONAL'?'el número de NC':'el número de novedad')+'.');
 const payload={id_programacion:prodNoveltyTarget,produccion:prodNoveltyProduction||null,origen:o,tipo:t,perfil:document.querySelector('#prodNoveltyProfile').value,longitud:Number(document.querySelector('#prodNoveltyLength').value)||null,cantidad:Number(document.querySelector('#prodNoveltyQty').value)||null,cortes_afectados:document.querySelector('#prodNoveltyCuts').value,observacion:document.querySelector('#prodNoveltyObs').value,usuario:currentAuth?.usuario||'',estado:ref?'REPORTADA':'PENDIENTE_RESOLVER'};
 if(o==='MECANIZADO_MAQUINA')payload.ticket_mtto=ref;else if(['INGENIERIA','CALIDAD'].includes(o))payload.numero_novedad=ref;else payload.numero_nc=ref;
 try{
  const db=await getSupabaseClient(),{error}=await db.from('sgp_mecanizado_novedades').insert(payload);if(error)throw error;
  const perfil=payload.perfil?.trim(),qty=Number(payload.cantidad||0);
  if(perfil&&qty>0){
   const row=prodRows.find(x=>x.id_programacion===prodNoveltyTarget)||{},sel=document.querySelector('#prodNoveltyReserve'),fin=document.querySelector('#prodNoveltyFinish')?.value.trim()||'',selectedReserve=sel?.value||row.reserva||null;
   if(!selectedReserve)return alert('Selecciona la reserva correspondiente al pendiente.');
   if(!fin)return alert('Indica el acabado correspondiente al pendiente.');
   const ap=await db.rpc('sgp_aluminio_pendiente_crear',{
    p_token:getAppToken(),p_reserva:selectedReserve,p_reserva_principal:row.reserva||null,
    p_key_produccion:prodNoveltySharedMeta?.key_produccion||null,p_acabado_pendiente:fin,
    p_produccion:prodNoveltyProduction||null,p_perfil:perfil,p_cantidad:qty,p_longitud:payload.longitud,
    p_origen:'PRODUCCION',p_causa:o+' · '+t,p_observacion:payload.observacion||null
   });
   if(ap.error)throw ap.error
  }
  document.querySelector('#prodNoveltyModal').hidden=true;await loadProductionBoard()
 }catch(e){alert('No fue posible guardar la novedad: '+e.message)}
});
document.querySelector('#prodShiftReport')?.addEventListener('click',openShiftReport);document.querySelector('#prodRefresh')?.addEventListener('click',loadProductionBoard);document.querySelector('#prodNoveltyClose')?.addEventListener('click',()=>document.querySelector('#prodNoveltyModal').hidden=true);document.querySelector('#prodNoveltyCancel')?.addEventListener('click',()=>document.querySelector('#prodNoveltyModal').hidden=true);
if(document.querySelector('#prodDate'))document.querySelector('#prodDate').value=new Date().toISOString().slice(0,10);

// UI scale preference v233
const UI_SCALE_KEY='sgp_ui_scale';
function applyUiScale(value){
 const allowed=['0.90','1','1.10','1.20'];
 const scale=allowed.includes(String(value))?String(value):'1';
 document.documentElement.style.setProperty('--sgp-ui-scale',scale);
 document.documentElement.dataset.uiScale=scale;
 document.querySelectorAll('[data-ui-scale]').forEach(b=>b.classList.toggle('active',b.dataset.uiScale===scale));
}
applyUiScale(localStorage.getItem(UI_SCALE_KEY)||'1');
document.querySelectorAll('[data-ui-scale]').forEach(b=>b.addEventListener('click',()=>{
 localStorage.setItem(UI_SCALE_KEY,b.dataset.uiScale);
 applyUiScale(b.dataset.uiScale);
}));

document.querySelector('#pickDeliveryTab')?.addEventListener('click',()=>{document.querySelector('#pickDeliveryTab').classList.add('active');document.querySelector('#pickReceptionTab').classList.remove('active');document.querySelector('#pickDeliveryPanel').hidden=false;document.querySelector('#pickReceptionPanel').hidden=true});document.querySelector('#pickReceptionTab')?.addEventListener('click',()=>{document.querySelector('#pickReceptionTab').classList.add('active');document.querySelector('#pickDeliveryTab').classList.remove('active');document.querySelector('#pickDeliveryPanel').hidden=true;document.querySelector('#pickReceptionPanel').hidden=false;loadPickingReception()});document.querySelector('#pickReceptionRefresh')?.addEventListener('click',loadPickingReception);document.querySelector('#pickReceptionSearch')?.addEventListener('input',renderPickingReception);document.querySelector('#pickReceptionWeek')?.addEventListener('change',renderPickingReception);document.querySelector('#pickAuditValidate')?.addEventListener('click',savePickingAudit);document.querySelector('#pickAuditClose')?.addEventListener('click',()=>document.querySelector('#pickAuditModal').hidden=true);document.querySelector('#pickAuditCancel')?.addEventListener('click',()=>document.querySelector('#pickAuditModal').hidden=true);document.querySelector('#pickAuditDifference')?.addEventListener('click',openAuditDifferenceEditor);

document.querySelector('#alCompactTab')?.addEventListener('click',()=>{document.querySelector('#alCompactTab').classList.add('active');document.querySelector('#alDetailTab').classList.remove('active');document.querySelector('#alCompactPanel').hidden=false;document.querySelector('#alDetailPanel').hidden=true;renderAlCompact()});document.querySelector('#alDetailTab')?.addEventListener('click',()=>{document.querySelector('#alDetailTab').classList.add('active');document.querySelector('#alCompactTab').classList.remove('active');document.querySelector('#alCompactPanel').hidden=true;document.querySelector('#alDetailPanel').hidden=false;renderAlTrackRows(alTrackRows)});

function ncReportBar(label,value,max,suffix=' casos'){const pct=max?Math.max(2,Math.round(value/max*100)):0;return '<div class="report-bar-row"><b>'+escapeHtml(label||'SIN CLASIFICAR')+'</b><div class="report-bar-track"><i style="width:'+pct+'%"></i></div><strong>'+escapeHtml(value)+suffix+'</strong></div>'}
function fmtKg(v){return Number(v||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})+' kg'}
async function loadNcAlReport(){const from=document.querySelector('#ncReportFrom')?.value,to=document.querySelector('#ncReportTo')?.value,line=document.querySelector('#ncReportLine')?.value||null,status=document.querySelector('#ncReportStatus'),host=document.querySelector('#ncReportCanvas');if(!from||!to){alert('Selecciona la fecha inicial y final.');return}if(from>to){alert('La fecha inicial no puede ser posterior a la final.');return}status.textContent='Procesando informe…';host.innerHTML='<div class="empty-state">Procesando…</div>';try{const db=await getSupabaseClient(),{data,error}=await db.rpc('sgp_informe_nc_aluminio',{p_token:getAppToken(),p_desde:from,p_hasta:to,p_linea:line});if(error)throw error;const d=data||{},ca=d.causas||[],se=d.secciones||[],rp=d.responsables_produccion||[],maxC=Math.max(1,...ca.map(x=>Number(x.casos))),maxS=Math.max(1,...se.map(x=>Number(x.casos))),total=Number(d.total_registros||0);host.innerHTML='<header class="report-hero"><div><span>CONTROL DE AFECTACIÓN DE MATERIAL</span><h3>Seguimiento a la línea de producción</h3><p>'+escapeHtml(line||'Todas las líneas')+' · '+escapeHtml(from)+' – '+escapeHtml(to)+'</p></div><div><small>REPORTE</small><b>NC ALUMINIO</b></div></header><div class="report-kpis"><article><b>'+total+'</b><span>registros de afectación</span></article><article><b>'+fmtKg(d.peso_total)+'</b><span>peso total registrado</span></article><article><b>'+escapeHtml(d.nc_produccion||0)+'</b><span>casos NC producción</span></article></div><section class="report-card"><h3>¿De dónde vienen las afectaciones?</h3><p>Distribución por causa registrada</p>'+ca.map(x=>ncReportBar(x.causa,x.casos,maxC,' casos · '+(total?Math.round(x.casos/total*1000)/10:0)+'%')).join('')+'</section><div class="report-grid"><section class="report-card"><h3>Secciones con más reportes</h3><p>Número de registros</p>'+se.slice(0,8).map(x=>ncReportBar(x.seccion,x.casos,maxS)).join('')+'</section><section class="report-card"><h3>Seguimiento: NC producción</h3><p>Mayor peso registrado por responsable</p><div class="report-ranking">'+rp.map(x=>'<div><span>'+escapeHtml(x.responsable)+'</span><b>'+fmtKg(x.peso)+' · '+escapeHtml(x.cortes||0)+' cortes</b></div>').join('')+'</div></section></div><div class="report-grid"><section class="report-card"><h3>Referencias más afectadas</h3><p>Casos, cortes y peso registrado</p><div class="report-ranking">'+(d.referencias||[]).map(x=>'<div><span>'+escapeHtml(x.referencia)+'</span><b>'+escapeHtml(x.casos)+' casos · '+escapeHtml(x.cortes)+' cortes · '+fmtKg(x.peso)+'</b></div>').join('')+'</div></section><section class="report-card"><h3>Origen de la afectación</h3><p>Comparativo según la clasificación aprobada de NC</p><div class="report-origin"><article><span>PROVEEDOR</span><b>'+fmtKg(d.peso_proveedor)+'</b><small>'+escapeHtml(d.casos_proveedor||0)+' casos · '+escapeHtml(d.cortes_proveedor||0)+' cortes</small></article><article><span>PLANTA</span><b>'+fmtKg(d.peso_planta)+'</b><small>'+escapeHtml(d.casos_planta||0)+' casos · '+escapeHtml(d.cortes_planta||0)+' cortes</small></article></div></section></div>';status.textContent=total+' registros · '+escapeHtml(d.total_cortes||0)+' cortes · '+fmtKg(d.peso_total)+' · '+from+' a '+to}catch(e){status.textContent='Error al generar informe: '+e.message;host.innerHTML='<div class="empty-state">No fue posible generar el informe.</div>'}}
document.querySelector('#runNcReport')?.addEventListener('click',loadNcAlReport);
document.querySelector('[data-view="informes"]')?.addEventListener('click',()=>{const to=document.querySelector('#ncReportTo'),from=document.querySelector('#ncReportFrom');if(to&&!to.value){const d=new Date(),z=n=>String(n).padStart(2,'0');to.value=d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());const f=new Date(d);f.setDate(f.getDate()-30);from.value=f.getFullYear()+'-'+z(f.getMonth()+1)+'-'+z(f.getDate())}});

async function ensureReportExportLibs(needPdf=true){
 const load=async(src,ready,label)=>{
  if(ready())return;
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=src;script.onload=resolve;
   script.onerror=()=>reject(new Error('No se pudo cargar '+label+' desde el servidor SGP_ONE: '+src));
   document.head.appendChild(script);
  });
  if(!ready())throw new Error('La biblioteca '+label+' no se inicializó correctamente.');
 };
 await load('./vendor/html2canvas.min.js',()=>typeof window.html2canvas==='function','html2canvas');
 if(needPdf)await load('./vendor/jspdf.umd.min.js',()=>typeof window.jspdf?.jsPDF==='function','jsPDF');
}
function ncReportFileName(ext){const f=document.querySelector('#ncReportFrom')?.value||'',t=document.querySelector('#ncReportTo')?.value||'';return 'SGP_NC_Aluminio_'+f+'_a_'+t+'.'+ext}
async function captureNcReport(){const el=document.querySelector('#ncReportCanvas');if(!el||el.querySelector('.empty-state'))throw new Error('Primero genera el informe.');await ensureReportExportLibs();el.classList.add('report-exporting');try{return await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#f4f7fa',windowWidth:el.scrollWidth,windowHeight:el.scrollHeight})}finally{el.classList.remove('report-exporting')}}
document.querySelector('#downloadNcReportImage')?.addEventListener('click',async()=>{try{const c=await captureNcReport(),a=document.createElement('a');a.download=ncReportFileName('png');a.href=c.toDataURL('image/png');a.click()}catch(e){alert('No fue posible generar la imagen: '+e.message)}});
document.querySelector('#downloadNcReportPdf')?.addEventListener('click',async()=>{try{const c=await captureNcReport(),{jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),pw=210,ph=297,m=7,w=pw-m*2,h=c.height*w/c.width,img=c.toDataURL('image/jpeg',.94);let y=m,left=h;pdf.addImage(img,'JPEG',m,y,w,h);left-=ph-m*2;while(left>0){y=-(h-left)+m;pdf.addPage();pdf.addImage(img,'JPEG',m,y,w,h);left-=ph-m*2}pdf.save(ncReportFileName('pdf'))}catch(e){alert('No fue posible generar el PDF: '+e.message)}});

initPickingDeliveryReport({getSupabaseClient,getAppToken});
