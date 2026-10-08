import { trackingRows } from "./src/data/mock-data.js";
import { createMecanizadoModule } from "./src/modules/mecanizado.js";
import { readProgrammingWorkbook, summarizeProgramming } from "./src/domain/production-importer.js";
import { importProductions } from "./src/services/production-import-repository.js";
import { readAluminumTrackingWorkbook, summarizeAluminumTracking } from "./src/domain/aluminum-tracking-importer.js";
import { readAluminumPiecesWorkbook, summarizeAluminumPieces, classifyAluminumPieces } from "./src/domain/aluminum-pieces-importer.js";
import { loadPieceMaster } from "./src/services/piece-master-repository.js";

const mecanizado = createMecanizadoModule(trackingRows);
let validatedProductions = [];

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
  pErrors: document.querySelector("#pErrors")
};

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
    els.commit.disabled = errors.length > 0 || rows.length === 0;
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
    const result = await readAluminumPiecesWorkbook(file);
    const summary = summarizeAluminumPieces(result.rows);
    const master = await loadPieceMaster();
    const classification = classifyAluminumPieces(result.rows, master);
    els.pTotal.textContent = summary.total;
    els.pOrders.textContent = summary.productionOrders;
    els.pCodes.textContent = summary.sapCodes;
    els.pErrors.textContent = result.errors.length;
    els.pUnclassified.textContent = classification.unclassified.length;
    const lineText = Object.entries(summary.lines).map(([line,count]) => `${line}: ${count}`).join(" · ");
    els.piecesStatus.textContent = result.errors.length
      ? `Validación bloqueada: ${result.errors.length} error(es) de estructura.`
      : classification.unclassified.length
        ? `Estructura correcta. ${lineText}. ${classification.unclassified.length} fila(s) con SAP no clasificado en Maestro de Piezas.`
        : `Estructura y Maestro correctos. ${lineText}. ${master.length} códigos activos disponibles en el Maestro.`;
  } catch (error) {
    els.pUnclassified.textContent = "—";
    els.piecesStatus.textContent = "Error: " + error.message;
  } finally {
    els.validatePieces.disabled = false;
  }
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
    els.commit.disabled = false;
  }
}

els.nav.forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
[els.search, els.state, els.line].forEach(el => el.addEventListener("input", renderMecanizado));
els.simulate.addEventListener("click", () => { els.demoMessage.textContent = mecanizado.advanceDemoState(); renderMecanizado(); });
els.validate.addEventListener("click", validateProgrammingFiles);
els.validateAluminum.addEventListener("click", validateAluminumFile);
els.validatePieces.addEventListener("click", validatePiecesFile);
els.commit.addEventListener("click", commitProgramming);

openView("mecanizado");
renderMecanizado();
