import { trackingRows } from "./src/data/mock-data.js";
import { createMecanizadoModule } from "./src/modules/mecanizado.js";
import { readProgrammingWorkbook, summarizeProgramming } from "./src/domain/production-importer.js";
import { importProductions } from "./src/services/production-import-repository.js";
import { readAluminumTrackingWorkbook, summarizeAluminumTracking } from "./src/domain/aluminum-tracking-importer.js";
import { readAluminumPiecesWorkbook, summarizeAluminumPieces, classifyAluminumPieces, relateAluminumPieces, prepareAluminumPiecePayload } from "./src/domain/aluminum-pieces-importer.js";
import { classifyPieceCodes } from "./src/services/piece-master-repository.js";
import { readAccessoriesWorkbook, relateAccessories, prepareAccessoryPayload } from "./src/domain/accessories-importer.js";
import { readGlassWorkbook, relateGlass, prepareGlassPayload } from "./src/domain/glass-importer.js";
import { getSupabaseClient } from "./src/services/supabase-client.js";

const mecanizado = createMecanizadoModule(trackingRows);
let validatedProductions = [];
let validatedAccessories = null;
let validatedGlass = null;
let validatedPieces = null;
let targetWeek = null;

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
  authEmail: document.querySelector("#authEmail"),
  authLogin: document.querySelector("#authLogin"),
  authLogout: document.querySelector("#authLogout"),
  importStatus: document.querySelector("#importStatus"),
  iTotal: document.querySelector("#iTotal"),
  iKeys: document.querySelector("#iKeys"),
  iErrors: document.querySelector("#iErrors"),
  importBody: document.querySelector("#importSummaryBody"),
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
  glassFile: document.querySelector("#glassFile"), validateGlass: document.querySelector("#validateGlass"), glassStatus: document.querySelector("#glassStatus"), gTotal: document.querySelector("#gTotal"), gRelated: document.querySelector("#gRelated"), gNoMatch: document.querySelector("#gNoMatch"), gSkipped: document.querySelector("#gSkipped"), gErrors: document.querySelector("#gErrors"), glassNoMatchWrap: document.querySelector("#glassNoMatchWrap"), glassNoMatchBody: document.querySelector("#glassNoMatchBody")
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
  els.commit.disabled = true;
  els.commit.textContent = status.ready ? "Paquete listo ✓" : "Carga final bloqueada";
  if (els.previewLoad) els.previewLoad.disabled = !status.ready;
  els.commit.title = status.ready
    ? "Las 4 fuentes están validadas. La escritura a Supabase permanece deshabilitada en LAB."
    : "Pendiente: " + status.blockers.join(", ");
  if (status.ready) {
    els.importStatus.textContent = `Paquete semanal listo para carga: Programación + Piezas + Accesorios + Vidrio validados. Escritura a Supabase aún deshabilitada en LAB.`;
  }
}


async function refreshAuthStatus() {
  try {
    const client = await getSupabaseClient();
    const { data } = await client.auth.getSession();
    const user = data?.session?.user || null;
    els.authStatus.textContent = user ? `Sesión: ${user.email || "autenticada"}` : "Sin sesión";
    els.authEmail.hidden = Boolean(user);
    els.authLogin.hidden = Boolean(user);
    els.authLogout.hidden = !user;
    return user;
  } catch (error) {
    els.authStatus.textContent = "Auth no disponible";
    return null;
  }
}
async function requestEmailAccess() {
  const email = String(els.authEmail.value || "").trim();
  if (!email || !email.includes("@")) { els.authStatus.textContent = "Indica un correo válido."; return; }
  els.authLogin.disabled = true;
  els.authStatus.textContent = "Enviando acceso…";
  try {
    const client = await getSupabaseClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname + "?v=29" }
    });
    if (error) throw error;
    els.authStatus.textContent = "Revisa tu correo para iniciar sesión.";
  } catch (error) {
    els.authStatus.textContent = "No fue posible enviar el acceso: " + error.message;
  } finally { els.authLogin.disabled = false; }
}
async function logout() {
  const client = await getSupabaseClient();
  await client.auth.signOut();
  await refreshAuthStatus();
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
  } finally { els.validate.disabled = false; refreshWeeklyRelations(); refreshWeeklyPackageGate(); }
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
  }catch(error){validatedAccessories=null;els.accessoriesStatus.textContent="Error: "+error.message;}finally{els.validateAccessories.disabled=false;refreshWeeklyPackageGate();}
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
  }catch(error){validatedGlass=null;els.glassStatus.textContent="Error: "+error.message;}finally{els.validateGlass.disabled=false;refreshWeeklyPackageGate();}
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

async function commitProgramming() {
  // LAB safety: deliberately no writes. Production commit will be enabled only after explicit approval.
  refreshWeeklyPackageGate();
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
els.validate.addEventListener("click", validateProgrammingFiles);
els.validateAluminum.addEventListener("click", validateAluminumFile);
els.validatePieces.addEventListener("click", validatePiecesFile);
els.validateAccessories.addEventListener("click", validateAccessoriesFile);
els.validateGlass.addEventListener("click", validateGlassFile);
els.previewLoad.addEventListener("click", previewWeeklyLoad);
els.commit.addEventListener("click", commitProgramming);

openView("mecanizado");
renderMecanizado();

els.authLogin.addEventListener("click", requestEmailAccess);
els.authLogout.addEventListener("click", logout);
refreshAuthStatus();
