const trackingRows = [
  { id:"1254941", reserva:"8558678", semana:40, proyecto:"Avery Pompano", produccion:"Orden 1254941", sistema:"MX", estado:"ALUMINIO_ENTREGADO", peso:1471.041, cantVent:60, lineas:["PANELES_2","FRAMES_2"] },
  { id:"1299077", reserva:"8665101", semana:40, proyecto:"Proyecto Paneles", produccion:"Orden 1299077", sistema:"ES", estado:"PENDIENTE_BODEGA", peso:283.27, cantVent:24, lineas:["PANELES_2"] },
  { id:"1305055", reserva:"8670112", semana:41, proyecto:"Proyecto Frames", produccion:"Orden 1305055", sistema:"MX4000", estado:"PENDIENTE_ABASTECIMIENTO", peso:75.66012821, cantVent:"", lineas:["FRAMES_2"] }
];

const els = {
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

function labelState(state) {
  if (state === "ALUMINIO_ENTREGADO") return ["Aluminio Entregado","entregado"];
  if (state === "PENDIENTE_BODEGA") return ["Pendiente por Bodega","bodega"];
  return ["Pendiente por Abastecimiento","abastecimiento"];
}

function filteredRows() {
  const q = els.search.value.trim().toLowerCase();
  const state = els.state.value;
  const line = els.line.value;

  return trackingRows.filter(r => {
    const searchable = [r.id,r.reserva,r.proyecto,r.produccion,r.sistema].join(" ").toLowerCase();
    const matchQ = !q || searchable.includes(q);
    const matchState = !state || r.estado === state;
    const matchLine = !line || r.lineas.includes(line);
    return matchQ && matchState && matchLine;
  });
}

function render() {
  const rows = filteredRows();
  els.total.textContent = rows.length;
  els.delivered.textContent = rows.filter(r => r.estado === "ALUMINIO_ENTREGADO").length;
  els.warehouse.textContent = rows.filter(r => r.estado === "PENDIENTE_BODEGA").length;
  els.supply.textContent = rows.filter(r => r.estado === "PENDIENTE_ABASTECIMIENTO").length;

  if (!rows.length) {
    els.tbody.innerHTML = '<tr><td class="empty" colspan="10">Sin resultados</td></tr>';
    return;
  }

  els.tbody.innerHTML = rows.map(r => {
    const [label, css] = labelState(r.estado);
    const lines = r.lineas.map(x => '<span class="line-tag">'+x+'</span>').join("");
    return '<tr>'+
      '<td><strong>'+r.id+'</strong></td>'+
      '<td>'+r.reserva+'</td>'+
      '<td>'+r.semana+'</td>'+
      '<td>'+r.proyecto+'</td>'+
      '<td>'+r.produccion+'</td>'+
      '<td>'+r.sistema+'</td>'+
      '<td><span class="badge '+css+'">'+label+'</span></td>'+
      '<td>'+r.peso.toLocaleString("es-CO",{maximumFractionDigits:8})+'</td>'+
      '<td>'+(r.cantVent === "" ? "—" : r.cantVent)+'</td>'+
      '<td>'+lines+'</td>'+
    '</tr>';
  }).join("");
}

function advanceDemoState() {
  const row = trackingRows.find(r => r.id === "1305055");
  if (!row) return;

  if (row.estado === "PENDIENTE_ABASTECIMIENTO") {
    row.estado = "PENDIENTE_BODEGA";
  } else if (row.estado === "PENDIENTE_BODEGA") {
    row.estado = "ALUMINIO_ENTREGADO";
  } else {
    row.estado = "PENDIENTE_ABASTECIMIENTO";
  }

  const [label] = labelState(row.estado);
  els.demoMessage.textContent = "1305055 → " + label;
  render();
}

[els.search, els.state, els.line].forEach(el => el.addEventListener("input", render));
els.simulate.addEventListener("click", advanceDemoState);
render();
