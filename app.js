import { trackingRows } from "./src/data/mock-data.js";
import { createMecanizadoModule } from "./src/modules/mecanizado.js";

const mecanizado = createMecanizadoModule(trackingRows);

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
  demoMessage: document.querySelector("#demoMessage")
};

function currentFilters() {
  return {
    q: els.search.value,
    estado: els.state.value,
    linea: els.line.value
  };
}

function renderMecanizado() {
  const rows = mecanizado.filterRows(currentFilters());

  els.total.textContent = rows.length;
  els.delivered.textContent = rows.filter(r => r.estado === "ALUMINIO_ENTREGADO").length;
  els.warehouse.textContent = rows.filter(r => r.estado === "PENDIENTE_BODEGA").length;
  els.supply.textContent = rows.filter(r => r.estado === "PENDIENTE_ABASTECIMIENTO").length;
  els.tbody.innerHTML = mecanizado.renderTable(rows);
}

function openView(viewName) {
  els.views.forEach(view => {
    view.hidden = view.dataset.viewPanel !== viewName;
  });

  els.nav.forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
}

els.nav.forEach(button => {
  button.addEventListener("click", () => openView(button.dataset.view));
});

[els.search, els.state, els.line].forEach(el => {
  el.addEventListener("input", renderMecanizado);
});

els.simulate.addEventListener("click", () => {
  els.demoMessage.textContent = mecanizado.advanceDemoState();
  renderMecanizado();
});

openView("mecanizado");
renderMecanizado();
