export function createMecanizadoModule(rows) {
  const state = { rows };

  function stateMeta(value) {
    if (value === "ALUMINIO_ENTREGADO") return ["Aluminio Entregado", "entregado"];
    if (value === "PENDIENTE_BODEGA") return ["Pendiente por Bodega", "bodega"];
    return ["Pendiente por Abastecimiento", "abastecimiento"];
  }

  function filterRows(filters) {
    const q = (filters.q || "").trim().toLowerCase();
    return state.rows.filter((row) => {
      const searchable = [
        row.id, row.reserva, row.proyecto, row.produccion, row.sistema
      ].join(" ").toLowerCase();

      return (!q || searchable.includes(q))
        && (!filters.estado || row.estado === filters.estado)
        && (!filters.linea || row.lineas.includes(filters.linea));
    });
  }

  function renderTable(rows) {
    if (!rows.length) {
      return '<tr><td class="empty" colspan="10">Sin resultados</td></tr>';
    }

    return rows.map((row) => {
      const [label, css] = stateMeta(row.estado);
      const lines = row.lineas
        .map((line) => '<span class="line-tag">' + line + '</span>')
        .join("");

      return '<tr>' +
        '<td><strong>' + row.id + '</strong></td>' +
        '<td>' + row.reserva + '</td>' +
        '<td>' + row.semana + '</td>' +
        '<td>' + row.proyecto + '</td>' +
        '<td>' + row.produccion + '</td>' +
        '<td>' + row.sistema + '</td>' +
        '<td><span class="badge ' + css + '">' + label + '</span></td>' +
        '<td>' + row.peso.toLocaleString("es-CO", { maximumFractionDigits: 8 }) + '</td>' +
        '<td>' + (row.cantVent === "" ? "—" : row.cantVent) + '</td>' +
        '<td>' + lines + '</td>' +
      '</tr>';
    }).join("");
  }

  function advanceDemoState() {
    const row = state.rows.find((item) => item.id === "1305055");
    if (!row) return "";

    if (row.estado === "PENDIENTE_ABASTECIMIENTO") {
      row.estado = "PENDIENTE_BODEGA";
    } else if (row.estado === "PENDIENTE_BODEGA") {
      row.estado = "ALUMINIO_ENTREGADO";
    } else {
      row.estado = "PENDIENTE_ABASTECIMIENTO";
    }

    return "1305055 → " + stateMeta(row.estado)[0];
  }

  return { filterRows, renderTable, advanceDemoState };
}
