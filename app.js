import { trackingRows } from "./src/data/mock-data.js";
import { createMecanizadoModule } from "./src/modules/mecanizado.js";
import { readProgrammingWorkbook, summarizeProgramming } from "./src/domain/production-importer.js";
import { importProductions } from "./src/services/production-import-repository.js";
import { readAluminumTrackingWorkbook, summarizeAluminumTracking } from "./src/domain/aluminum-tracking-importer.js";
import { readAluminumPiecesWorkbook, summarizeAluminumPieces, classifyAluminumPieces } from "./src/domain/aluminum-pieces-importer.js";
import { classifyPieceCodes } from "./src/services/piece-master-repository.js";
import { readAccessoriesWorkbook, relateAccessories } from "./src/domain/accessories-importer.js";
import { readGlassWorkbook, relateGlass } from "./src/domain/glass-importer.js";

const mecanizado = createMecanizadoModule(trackingRows);
let validatedProductions = [];
let validatedAccessories = null;
let validatedGlass = null;

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
  commit: document.querySelector("#commitProgramming"),
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
  pErrors: document.querySelector("#pErrors"),
  accessoriesFile: document.querySelector("#accessoriesFile"), validateAccessories: document.querySelector("#validateAccessories"), accessoriesStatus: document.querySelector("#accessoriesStatus"), xTotal: document.querySelector("#xTotal"), xRelated: document.querySelector("#xRelated"), xNoMatch: document.querySelector("#xNoMatch"), xErrors: document.querySelector("#xErrors"), accessoriesNoMatchWrap: document.querySelector("#accessoriesNoMatchWrap"), accessoriesNoMatchBody: document.querySelector("#accessoriesNoMatchBody"),
  glassFile: document.querySelector("#glassFile"), validateGlass: document.querySelector("#validateGlass"), glassStatus: document.querySelector("#glassStatus"), gTotal: document.querySelector("#gTotal"), gRelated: document.querySelector("#gRelated"), gSkipped: document.querySelector("#gSkipped"), gErrors: document.querySelector("#gErrors")
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function renderAccessoryNoMatches(relation) {
  if (!els.accessoriesNoMatchWrap || !els.accessoriesNoMatchBody) return;
  const rows = relation?.noMatchRows || [];
  els.accessoriesNoMatchWrap.hidden = rows.length === 0;
  els.accessoriesNoMatchBody.innerHTML = rows.length
    ? rows.map(row => `<tr><td>${escapeHtml(row.produccion)}</td><td>${escapeHtml(row.sistema)}</td><td>${escapeHtml(row.filas)}</td><td>${escapeHtml(row.codigo_sap || "—")}</td><td>Producción + Sistema no existe en la programación validada</td></tr>`).join("")
    : '<tr><td colspan="5" class="empty">Sin grupos pendientes</td></tr>';
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
    els.glassStatus.textContent = `Correcto: ${validatedGlass.rows.length} registros útiles · ${relation.related} relacionados con PANELES_2 · ${relation.noMatch} sin relación · ${relation.conflicts} conflictos.`;
  }
}

async function validateProgrammingFiles() {
  const files = [...(els.files.files || [])];
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
    els.importStatus.textContent = errors.length ? `Validación bloqueada: ${errors.length} error(es).` : `Validación correcta: ${rows.length} producciones listas.`;
  } catch (error) {
    validatedProductions = [];
    els.importStatus.textContent = "Error: " + error.message;
  } finally { els.validate.disabled = false; }
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
    const lineText = Object.entries(summary.lines).map(([line,count]) => `${line}: ${count}`).join(" · ");
    els.piecesStatus.textContent = result.errors.length
      ? `Validación bloqueada: ${result.errors.length} error(es) de estructura.`
      : classification.unclassified.length
        ? `Terminado. ${lineText}. ${classification.unclassified.length} fila(s) con SAP no clasificado.`
        : `Terminado. ${summary.total} filas clasificadas · ${summary.sapCodes} códigos SAP · ${lineText} · 0 sin clasificar.`;
  } catch (error) {
    els.pUnclassified.textContent = "—";
    els.piecesStatus.textContent = "Error: " + error.message;
  } finally {
    els.validatePieces.disabled = false;
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
    els.accessoriesStatus.textContent=result.errors.length?`Bloqueado: ${result.errors.length} error(es).`:validatedProductions.length?`Correcto: ${result.rows.length} filas · ${relation.sourceGroups} grupos Producción + Sistema · ${relation.related} relacionados · ${relation.noMatch} sin relación · ${relation.conflicts} conflictos.`:`Estructura correcta: ${result.rows.length} registros. Valida primero Programación para ejecutar el cruce Producción + Sistema.`;
  }catch(error){els.accessoriesStatus.textContent="Error: "+error.message;}finally{els.validateAccessories.disabled=false;}
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
    els.glassStatus.textContent=validatedProductions.length?`Correcto: ${result.rows.length} registros útiles · ${relation.related} relacionados con PANELES_2 · ${relation.noMatch} sin relación · ${relation.conflicts} conflictos.`:`Estructura leída: ${result.rows.length} registros útiles. Valida primero Programación para ejecutar el cruce por ID.`;
  }catch(error){els.glassStatus.textContent="Error: "+error.message;}finally{els.validateGlass.disabled=false;}
}

async function commitProgramming() {
  if (!validatedProductions.length) return;
  els.commit.disabled = true;
  els.importStatus.textContent = "Cargando a Supabase…";
  try {
    const result = await importProductions(validatedProductions);
    els.importStatus.textContent = `Carga completada: ${result.written} producciones.`;
  } catch (error) {
    els.importStatus.textContent = "Carga no ejecutada: " + error.message;
    els.commit.disabled = true;
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
els.validate.addEventListener("click", validateProgrammingFiles);
els.validateAluminum.addEventListener("click", validateAluminumFile);
els.validatePieces.addEventListener("click", validatePiecesFile);
els.validateAccessories.addEventListener("click", validateAccessoriesFile);
els.validateGlass.addEventListener("click", validateGlassFile);
els.commit.addEventListener("click", commitProgramming);

openView("mecanizado");
renderMecanizado();
