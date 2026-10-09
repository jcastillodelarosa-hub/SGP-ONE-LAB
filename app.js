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
let detailColumns = [
 {key:'reserva_al',label:'Reserva'}, {key:'id_linea',label:'Línea'}, {key:'id',label:'ID'}, {key:'produccion',label:'Producción'}, {key:'sistema',label:'Sistema'}, {key:'acabado',label:'Acabado'}, {key:'proyecto',label:'Proyecto'}, {key:'cantidad',label:'Cantidad'}, {key:'muntin',label:'Muntin'}, {key:'porc_vidrio',label:'Vidrio'}
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
  aDelivered: document.querySelector("#aDelivered"),
  aErrors: document.querySelector("#aErrors"),
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

async function refreshAuthStatus() {
  try {
    const token = sessionStorage.getItem(APP_SESSION_KEY);
    if (!token) {
      els.authStatus.textContent = "Sin sesión";
      els.authUser.hidden = false; els.authPassword.hidden = false; els.authLogin.hidden = false; els.authLogout.hidden = true;
      return null;
    }
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("sgp_sesion_actual", { p_token: token });
    if (error || !data?.valida) {
      sessionStorage.removeItem(APP_SESSION_KEY);
      els.authStatus.textContent = "Sesión vencida";
      els.authUser.hidden = false; els.authPassword.hidden = false; els.authLogin.hidden = false; els.authLogout.hidden = true;
      return null;
    }
    els.authStatus.textContent = `${data.nombre} · ${data.rol}`;
    els.authUser.hidden = true; els.authPassword.hidden = true; els.authLogin.hidden = true; els.authLogout.hidden = false;
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
    sessionStorage.setItem(APP_SESSION_KEY, data.token);
    els.authPassword.value = "";
    await refreshAuthStatus();
  } catch {
    els.authPassword.value = "";
    els.authStatus.textContent = "Usuario o contraseña incorrectos.";
  } finally { els.authLogin.disabled = false; }
}
async function logout() {
  const token=sessionStorage.getItem(APP_SESSION_KEY);
  try { if(token){ const client=await getSupabaseClient(); await client.rpc("sgp_logout",{p_token:token}); } } finally {
    sessionStorage.removeItem(APP_SESSION_KEY); await refreshAuthStatus();
  }
}

function currentFilters() { return { q: els.search.value, estado: els.state.value, linea: els.line.value }; }
function renderMecanizado() {
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
async function validateAluminumFile() {
  const file = els.aluminumFile.files?.[0];
  if (!file) { els.aluminumStatus.textContent = "Selecciona el archivo de seguimiento."; return; }
  els.validateAluminum.disabled = true;
  els.aluminumStatus.textContent = "Validando…";
  try {
    const result = await readAluminumTrackingWorkbook(file);
    const summary = summarizeAluminumTracking(result.rows);
    els.aTotal.textContent = summary.total;
    els.aReservations.textContent = summary.reservations;
    els.aDelivered.textContent = summary.states.ALUMINIO_ENTREGADO || 0;
    els.aErrors.textContent = result.errors.length;
    els.aluminumStatus.textContent = result.errors.length
      ? `Validación bloqueada: ${result.errors.length} error(es).`
      : `Correcto: ${summary.total} seguimientos, ${summary.reservations} reservas, ${result.skipped} filas de control omitidas.`;
  } catch (error) {
    els.aluminumStatus.textContent = "Error: " + error.message;
  } finally {
    els.validateAluminum.disabled = false;
  }
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
  els.queryHead.innerHTML='<tr>'+detailColumns.map((c,i)=>`<th><div class="detail-head"><span data-sort="${c.key}">${escapeHtml(c.label)}${detailSort.key===c.key?(detailSort.dir>0?' ▲':' ▼'):''}</span><span><button type="button" data-move="${i}:-1" title="Mover a la izquierda">←</button><button type="button" data-move="${i}:1" title="Mover a la derecha">→</button></span></div><input class="column-filter" data-filter="${c.key}" value="${escapeHtml(detailColumnFilters[c.key]||'')}" placeholder="Filtrar…"></th>`).join('')+'</tr>';
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

  let rows=baseRows.filter(r=>detailColumns.every(c=>!detailColumnFilters[c.key]||String(detailValue(r,c.key)).toLowerCase().includes(detailColumnFilters[c.key].toLowerCase())));
  if(detailSort.key)rows=[...rows].sort((x,y)=>String(detailValue(x,detailSort.key)).localeCompare(String(detailValue(y,detailSort.key)),undefined,{numeric:true})*detailSort.dir);
  els.qVisible.textContent=rows.length;renderDetailHead();
  let prev=null,idx=-1;
  els.queryBody.innerHTML=rows.length?rows.map(r=>{const reserva=String(r.reserva_al??'').trim()||'SIN RESERVA';if(reserva!==prev){idx++;prev=reserva}const hm=hasMuntin(r);
    return `<tr class="${idx%2===0?'reservation-alt':''} ${hm?'has-muntin':''}">${detailColumns.map(c=>{let v=detailValue(r,c.key);if(c.key==='reserva_al')return `<td><button class="piece-link" data-piece-mode="reserva" data-piece-value="${escapeHtml(reserva)}">${escapeHtml(reserva)}</button></td>`;if(c.key==='produccion')return `<td><button class="piece-link" data-piece-mode="produccion" data-piece-value="${escapeHtml(r.produccion)}">${escapeHtml(r.produccion)}</button></td>`;if(c.key==='muntin')v=hm?'SÍ · '+(r.cantidad_muntin??r.cantidad??''):'—';return `<td>${escapeHtml(v||'—')}</td>`}).join('')}</tr>`;
  }).join(''):`<tr><td colspan="${detailColumns.length}" class="empty">No hay registros con los filtros seleccionados.</td></tr>`;
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



function renderAssembly(){
  if(!els.assemblyBody)return;
  const q=String(els.assemblySearch?.value||"").trim().toLowerCase(),state=els.assemblyState?.value||"";
  const rows=assemblyRows.filter(r=>(!state||r.estado_produccion===state)&&(!q||[r.id,r.produccion,r.sistema,r.reserva_al,r.tipo_vidrio,r.medidas,r.ubicacion_vidrio,r.acabado].some(v=>String(v??"").toLowerCase().includes(q))));
  const n=v=>Number(v??0), pct=v=>v==null?"—":(n(v)<=1?Math.round(n(v)*100):Math.round(n(v)))+"%";
  els.asTotal.textContent=rows.length;els.asBalance.textContent=rows.reduce((a,r)=>a+n(r.saldo_ensamble),0);
  els.asOpen.textContent=rows.filter(r=>r.estado_produccion==="ABIERTA").length;els.asClosed.textContent=rows.filter(r=>r.estado_produccion==="CERRADA").length;els.asAssembled.textContent=rows.filter(r=>r.estado_produccion==="ENSAMBLADA").length;
  els.assemblyBody.innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.semana_actual??r.semana_base)}</td><td><strong>${escapeHtml(r.id)}</strong></td><td>${escapeHtml(r.produccion||"—")}</td><td>${escapeHtml(r.sistema||"—")}</td><td class="num">${escapeHtml(r.cantidad??"—")}</td><td class="num">${escapeHtml(r.ensamblado??"—")}</td><td class="num assembly-balance"><strong>${escapeHtml(r.saldo_ensamble??"—")}</strong></td><td><span class="assembly-state state-${String(r.estado_produccion||"").toLowerCase()}">${escapeHtml(r.estado_produccion||"—")}</span></td><td class="num">${pct(r.porc_vidrio)}</td><td>${escapeHtml(r.tipo_vidrio||"—")}</td><td class="assembly-measures">${escapeHtml(r.medidas||"—")}</td><td class="assembly-location">${r.ubicacion_vidrio&&r.ubicacion_vidrio!=="—"?`<button class="glass-location-link" data-glass-key="${escapeHtml(r.key_produccion)}" data-glass-id="${escapeHtml(r.id)}">${escapeHtml(r.ubicacion_vidrio)}</button>`:"—"}</td><td>${escapeHtml(r.reserva_al||"—")}</td><td>${escapeHtml(r.estado_reserva_al||"—")}</td><td>${escapeHtml(r.acabado||"—")}</td><td>${escapeHtml(r.orden_oves||"—")}</td></tr>`).join(""):'<tr><td colspan="16" class="empty">No hay órdenes con estos filtros.</td></tr>';
}

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
els.nav.forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
window.addEventListener("error", event => {
  console.error("SGP ONE:", event.error || event.message);
});
window.addEventListener("unhandledrejection", event => {
  console.error("SGP ONE:", event.reason);
});
[els.search, els.state, els.line].forEach(el => el.addEventListener("input", renderMecanizado));
els.simulate.addEventListener("click", () => { els.demoMessage.textContent = mecanizado.advanceDemoState(); renderMecanizado(); });
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

refreshWeeklyTabs();
openView("mecanizado");
renderMecanizado();

els.authLogin.addEventListener("click", requestCredentialAccess);
els.authLogout.addEventListener("click", logout);
refreshAuthStatus();

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
 if(ncAlNewRows.length){const modal=document.querySelector("#ncNewModal"),table=modal.querySelector("table");document.querySelector("#ncNewTitle").textContent=`NC agregadas en esta carga · ${ncAlNewRows.length}`;document.querySelector("#ncNewBody").innerHTML=ncAlNewRows.map(r=>`<tr><td>${escapeHtml(r.consecutivo)}</td><td>${escapeHtml(r.linea||'')}</td><td>${escapeHtml(r.semana_nc||'')}</td><td>${escapeHtml(r.referencia||'')}</td><td>${escapeHtml(r.acabado||'')}</td><td><span class="nc-state-pill">${escapeHtml(r.estado||'')}</span></td><td>${escapeHtml(String(r.creacion||'').slice(0,10))}</td><td>${escapeHtml(r.reserva_solucion||'')}</td><td>${escapeHtml(ncInches(r.perfil_mm))}</td><td>${escapeHtml(r.no_cortes||'')}</td></tr>`).join('');modal.hidden=false;delete table.dataset.dragReady;enableDraggableColumns(modal)}
 }catch(e){status.textContent="Aplicación rechazada ✕ "+e.message;btn.disabled=false}
}
document.querySelector("#previewNcAl")?.addEventListener("click",previewNcAluminum);
document.querySelector("#applyNcAl")?.addEventListener("click",applyNcAluminum);


let ncViewRows=[],ncViewFilters={};
let ncHiddenCols=new Set(JSON.parse(localStorage.getItem("sgp_nc_hidden_cols")||"[]"));
let ncCols=[['consecutivo','Consecutivo'],['semana_nc','Sem. NC'],['linea','Línea'],['creacion','Creación'],['dias_abierta','Días'],['semaforo',''],['estado','Estado'],['reserva','Reserva'],['reserva_solucion','Reserva solución'],['produccion','Producción'],['sistema','Sistema'],['referencia','Referencia'],['perfil_mm','Perfil mm'],['perfil_in','Perfil pulg.'],['no_cortes','# Cortes'],['acabado','Acabado'],['concepto','Concepto'],['causa','Causa'],['responsable','Responsable']];
function ncInches(v){let n=Number(String(v??'').replace(',','.'));if(!Number.isFinite(n))return '';let x=n/25.4,w=Math.floor(x),q=Math.round((x-w)*16);if(q===16){w++;q=0}if(!q)return w+'″';const g=(a,b)=>b?g(b,a%b):a,d=g(q,16);return w+' '+(q/d)+'/'+(16/d)+'″'}
function ncFmt(r,k){let v=k==='perfil_in'?ncInches(r.perfil_mm):r[k];if(v==null)return "";if(k==='creacion')return String(v).slice(0,10);return String(v)}
function renderNcView(){
 const head=document.querySelector("#ncViewHead"),body=document.querySelector("#ncViewBody");if(!head||!body)return;
 const visibleCols=ncCols.filter(([k])=>!ncHiddenCols.has(k));
 head.innerHTML='<tr>'+visibleCols.map(([k,l],i)=>`<th draggable="true" data-nccol="${i}">${l}</th>`).join('')+'</tr><tr class="filter-row">'+visibleCols.map(([k])=>k==='semaforo'?'<th></th>':`<th><input data-ncf="${k}" value="${escapeHtml(ncViewFilters[k]||'')}" placeholder="Filtrar"></th>`).join('')+'</tr>';
 const rows=ncViewRows.filter(r=>visibleCols.every(([k])=>!ncViewFilters[k]||ncFmt(r,k).toLowerCase().includes(ncViewFilters[k].toLowerCase())));
 body.innerHTML=rows.map(r=>`<tr class="${String(r.estado).toLowerCase()==='finalizada'?'nc-finalized':''}">${visibleCols.map(([k])=>k==='semaforo'? `<td><span class="nc-light ${String(r.semaforo).toLowerCase()}" title="${r.dias_abierta} días"></span></td>`:`<td>${escapeHtml(ncFmt(r,k))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${visibleCols.length}" class="empty">Sin NC para los filtros seleccionados</td></tr>`;
 head.querySelectorAll('[data-ncf]').forEach(x=>x.addEventListener('input',e=>{ncViewFilters[e.target.dataset.ncf]=e.target.value;renderNcView();const n=document.querySelector(`[data-ncf="${e.target.dataset.ncf}"]`);n?.focus();n?.setSelectionRange(n.value.length,n.value.length)}));
 let drag=null;head.querySelectorAll('[data-nccol]').forEach(th=>{th.addEventListener('dragstart',e=>{drag=Number(th.dataset.nccol);th.classList.add('col-dragging');e.dataTransfer.effectAllowed='move'});th.addEventListener('dragover',e=>{e.preventDefault();const r=th.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;head.querySelectorAll('.col-drop-left,.col-drop-right').forEach(x=>x.classList.remove('col-drop-left','col-drop-right'));th.classList.add(after?'col-drop-right':'col-drop-left');e.dataTransfer.dropEffect='move'});th.addEventListener('dragleave',()=>th.classList.remove('col-drop-left','col-drop-right'));th.addEventListener('drop',e=>{e.preventDefault();const r=th.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;let to=Number(th.dataset.nccol)+(after?1:0);if(drag===null)return;const [c]=ncCols.splice(drag,1);if(drag<to)to--;ncCols.splice(to,0,c);drag=null;renderNcView()});th.addEventListener('dragend',()=>{drag=null;head.querySelectorAll('.col-dragging,.col-drop-left,.col-drop-right').forEach(x=>x.classList.remove('col-dragging','col-drop-left','col-drop-right'))})});
}
function openNcMetric(kind){
 const tests={consult:r=>String(r.estado).toLowerCase()==='consultada',audit:r=>String(r.estado).toLowerCase()==='sin auditar',overdue:r=>String(r.estado).toLowerCase()!=='finalizada'&&Number(r.dias_abierta)>2,nosolution:r=>r.sin_solucion};
 const titles={consult:'NC en consulta',audit:'NC sin auditar',overdue:'NC con más de 2 días sin finalizar',nosolution:'NC sin solución'},rows=ncViewRows.filter(tests[kind]);
 document.querySelector("#ncMetricTitle").textContent=titles[kind]+' · '+rows.length;
 const modalTable=document.querySelector("#ncMetricModal table");modalTable.tHead.innerHTML='<tr>'+[['consecutivo','NC'],['referencia','Referencia'],['acabado','Acabado'],['estado','Estado'],['creacion','Creación'],['dias_abierta','Días'],['reserva_solucion','Reserva solución'],['perfil_in','Perfil'],['no_cortes','Cortes']].map(([k,l])=>`<th data-key="${k}">${l}</th>`).join('')+'</tr>';
 document.querySelector("#ncMetricBody").innerHTML=rows.map(r=>`<tr><td>${escapeHtml(r.consecutivo)}</td><td>${escapeHtml(r.referencia||'')}</td><td>${escapeHtml(r.acabado||'')}</td><td><span class="nc-state-pill">${escapeHtml(r.estado)}</span></td><td>${escapeHtml(ncFmt(r,'creacion'))}</td><td class="nc-days-cell">${r.dias_abierta}</td><td>${escapeHtml(r.reserva_solucion||'')}</td><td>${escapeHtml(ncInches(r.perfil_mm))}</td><td>${escapeHtml(r.no_cortes??'')}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">Sin registros</td></tr>';document.querySelector("#ncMetricModal").hidden=false;delete modalTable.dataset.dragReady;enableDraggableColumns(document.querySelector("#ncMetricModal"));
}
async function loadNcOperational(){
 const status=document.querySelector("#ncViewStatus");try{status.textContent="Consultando NC…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),week=Number(document.querySelector("#ncViewWeek").value)||null;
 const {data,error}=await client.rpc("sgp_consultar_nc_aluminio",{p_token:token,p_semana:week});if(error)throw error;ncViewRows=data.filas||[];ncViewFilters={};
 const [{data:lineSummary,error:lineErr},{data:originMetrics,error:originErr}]=await Promise.all([client.rpc("sgp_resumen_nc_aluminio_linea",{p_token:token,p_semana:week}),client.rpc("sgp_metricas_origen_nc_aluminio",{p_token:token,p_semana:week})]);if(lineErr)throw lineErr;if(originErr)throw originErr;
 document.querySelector("#ncMPlant").textContent=originMetrics.planta;document.querySelector("#ncMSupplier").textContent=originMetrics.proveedor;
 document.querySelector("#ncLineSummary").innerHTML=(lineSummary||[]).map(x=>`<div class="nc-line-card"><strong>${escapeHtml(x.linea)}</strong><span>Total NC <b>${x.total}</b></span><span>Planta <b>${x.planta}</b></span><span>Proveedor <b>${x.proveedor}</b></span></div>`).join('');
 document.querySelector("#ncMConsult").textContent=data.metricas.en_consulta;document.querySelector("#ncMAudit").textContent=data.metricas.sin_auditar;document.querySelector("#ncMOverdue").textContent=data.metricas.mas_2_dias;document.querySelector("#ncMNoSolution").textContent=data.metricas.sin_solucion;renderNcView();status.textContent=`Semana Maestro ${data.semana} · ${ncViewRows.length} NC`;
 }catch(e){status.textContent="Consulta rechazada ✕ "+e.message}}
document.querySelector("#loadNcView")?.addEventListener("click",loadNcOperational);
document.querySelectorAll(".nc-metric-btn").forEach(b=>b.addEventListener("click",()=>openNcMetric(b.dataset.ncmetric)));
document.querySelector("#closeNcMetric")?.addEventListener("click",()=>document.querySelector("#ncMetricModal").hidden=true);

function enableDraggableColumns(root=document){
 root.querySelectorAll('table').forEach(table=>{
  if(table.classList.contains('nc-operational-table')||table.dataset.dragReady)return;
  const row=table.tHead?.rows?.[0];if(!row||row.cells.length<2)return;table.dataset.dragReady='1';
  [...row.cells].forEach(th=>{th.draggable=true;th.classList.add('draggable-th')});
  let from=null,side='before',target=null;
  row.addEventListener('dragstart',e=>{const th=e.target.closest('th');if(!th)return;from=[...row.cells].indexOf(th);th.classList.add('col-dragging');e.dataTransfer.effectAllowed='move'});
  row.addEventListener('dragover',e=>{const th=e.target.closest('th');if(!th||from==null)return;e.preventDefault();const r=th.getBoundingClientRect();side=e.clientX<r.left+r.width/2?'before':'after';target=[...row.cells].indexOf(th);row.querySelectorAll('.col-drop-left,.col-drop-right').forEach(x=>x.classList.remove('col-drop-left','col-drop-right'));th.classList.add(side==='before'?'col-drop-left':'col-drop-right');e.dataTransfer.dropEffect='move'});
  row.addEventListener('drop',e=>{e.preventDefault();if(from==null||target==null)return;const count=row.cells.length;let insertion=target+(side==='after'?1:0);if(insertion===from||insertion===from+1){from=null;target=null;row.querySelectorAll('.col-drop-left,.col-drop-right').forEach(x=>x.classList.remove('col-drop-left','col-drop-right'));return}
   [...table.rows].forEach(tr=>{if(tr.cells.length!==count)return;const moving=tr.cells[from];let dest=insertion;if(from<dest)dest--;if(dest>=tr.cells.length)tr.appendChild(moving);else tr.insertBefore(moving,tr.cells[dest])});from=null;target=null;row.querySelectorAll('.col-drop-left,.col-drop-right,.col-dragging').forEach(x=>x.classList.remove('col-drop-left','col-drop-right','col-dragging'))});
  row.addEventListener('dragend',()=>{from=null;target=null;row.querySelectorAll('.col-drop-left,.col-drop-right,.col-dragging').forEach(x=>x.classList.remove('col-drop-left','col-drop-right','col-dragging'))});
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
 if(!ncGlassPreview)return;const status=document.querySelector("#ncGlassStatus"),btn=document.querySelector("#applyNcGlass");try{btn.disabled=true;status.textContent="Aplicando NC Vidrio…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session");const {data,error}=await client.rpc("sgp_aplicar_nc_vidrio",{p_token:token,p_nombre_archivo:ncGlassPreview.file,p_datos:ncGlassRows});if(error)throw error;status.textContent=`NC Vidrio actualizado ✓ · ${data.nuevos} nuevas · ${data.actualizados} actualizadas`}catch(e){status.textContent="Aplicación rechazada ✕ "+e.message;btn.disabled=false}}
document.querySelector("#previewNcGlass")?.addEventListener("click",previewNcGlass);document.querySelector("#applyNcGlass")?.addEventListener("click",applyNcGlass);

const ncGlassCols=[['semana_maestro','Sem. Maestro'],['consecutivo','NC'],['estado_nc','Estado'],['dias_abierta','Días'],['fecha_generacion_nc','Generación'],['semana_prod','Sem. Prod'],['oves','OVES'],['orden_sap','Orden SAP'],['item','Item'],['proyecto','Proyecto'],['sistema','Sistema'],['motivo','Motivo'],['linea_responsable','Línea responsable'],['linea_afectada','Línea afectada'],['linea_despacho','Línea despacho'],['cant_repo','Cant. repo'],['cant_recibida','Cant. recibida'],['mt_nc','MT NC'],['estado_auditado','Auditado'],['turno','Turno']];
let ncGlassViewRows=[],ncGlassFilters={},ncGlassHidden=new Set(JSON.parse(localStorage.getItem("sgp_ncg_hidden_cols")||"[]"));
function renderNcGlassView(){const h=document.querySelector("#ncGlassHead"),b=document.querySelector("#ncGlassBody");if(!h||!b)return;const cols=ncGlassCols.filter(([k])=>!ncGlassHidden.has(k));h.innerHTML='<tr>'+cols.map(([k,l])=>`<th data-ncgcol="${k}">${l}</th>`).join('')+'</tr><tr class="filter-row">'+cols.map(([k])=>`<th><input data-ncgfilter="${k}" value="${escapeHtml(ncGlassFilters[k]||'')}" placeholder="Filtrar"></th>`).join('')+'</tr>';const rows=ncGlassViewRows.filter(r=>cols.every(([k])=>!ncGlassFilters[k]||String(r[k]??'').toLowerCase().includes(ncGlassFilters[k].toLowerCase())));b.innerHTML=rows.length?rows.map(r=>'<tr class="'+(String(r.estado_nc).toUpperCase()==='CERRADA'?'ncg-closed':'ncg-open')+'">'+cols.map(([k])=>`<td>${escapeHtml(r[k]??'')}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${cols.length}">Sin NC para este filtro.</td></tr>`;h.querySelectorAll('[data-ncgfilter]').forEach(x=>x.addEventListener('input',()=>{ncGlassFilters[x.dataset.ncgfilter]=x.value;renderNcGlassView()}));}
function renderNcGlassPicker(){const box=document.querySelector("#ncGlassColumnPicker");box.innerHTML='<div class="nc-column-picker-head"><strong>Campos visibles</strong><span>Selecciona las columnas de la tabla</span></div><div class="nc-column-picker-grid">'+ncGlassCols.map(([k,l])=>`<label><input type="checkbox" data-ncgvis="${k}" ${ncGlassHidden.has(k)?'':'checked'}> ${l}</label>`).join('')+'</div>';box.querySelectorAll('[data-ncgvis]').forEach(x=>x.addEventListener('change',()=>{x.checked?ncGlassHidden.delete(x.dataset.ncgvis):ncGlassHidden.add(x.dataset.ncgvis);localStorage.setItem("sgp_ncg_hidden_cols",JSON.stringify([...ncGlassHidden]));renderNcGlassView()}))}
async function loadNcGlassOperational(){const status=document.querySelector("#ncGlassViewStatus");try{status.textContent="Consultando NC Vidrio…";const client=await getSupabaseClient(),token=sessionStorage.getItem("sgp_one_session"),sel=document.querySelector("#ncGlassWeek"),week=sel?.value?Number(sel.value):null;const {data,error}=await client.rpc("sgp_consultar_nc_vidrio",{p_token:token,p_semana:week});if(error)throw error;ncGlassViewRows=data.rows||[];const current=sel.value,weeks=data.semanas_abiertas||[];sel.innerHTML='<option value="">Todas las semanas abiertas</option>'+weeks.map(w=>`<option value="${w}">Semana ${w}</option>`).join('');if(current&&weeks.map(String).includes(current))sel.value=current;document.querySelector("#ncgTotal").textContent=ncGlassViewRows.length;document.querySelector("#ncgOpen").textContent=ncGlassViewRows.filter(r=>String(r.estado_nc).toUpperCase()==='ABIERTA').length;document.querySelector("#ncgClosed").textContent=ncGlassViewRows.filter(r=>String(r.estado_nc).toUpperCase()==='CERRADA').length;document.querySelector("#ncgSupplier").textContent=ncGlassViewRows.filter(r=>String(r.motivo).toUpperCase().includes('PROVEEDOR')||String(r.linea_afectada).toUpperCase().includes('PROVEEDOR')).length;document.querySelector("#ncgProcess").textContent=ncGlassViewRows.filter(r=>String(r.motivo).toUpperCase().includes('PROCESO')).length;status.textContent=week?`Semana Maestro ${week}`:`Mostrando todas las NC de ${weeks.length} semana(s) abierta(s)`;renderNcGlassView()}catch(e){status.textContent="Error consultando NC Vidrio: "+e.message}}
document.querySelector("#loadNcGlassView")?.addEventListener("click",loadNcGlassOperational);document.querySelector("#ncGlassWeek")?.addEventListener("change",loadNcGlassOperational);document.querySelector("#ncGlassChooseColumns")?.addEventListener("click",()=>{const b=document.querySelector("#ncGlassColumnPicker");b.hidden=!b.hidden;if(!b.hidden)renderNcGlassPicker()});
document.querySelector('[data-view="nc-vidrio"]')?.addEventListener("click",loadNcGlassOperational);
