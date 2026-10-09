const clean=v=>v==null?"":String(v).trim();
const key=s=>clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ");
export async function readNcAluminumWorkbook(file){
 const XLSX=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
 const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
 const ws=wb.Sheets[wb.SheetNames[0]]; const data=XLSX.utils.sheet_to_json(ws,{defval:"",raw:true});
 const pick=(r,n)=>{const target=key(n);const k=Object.keys(r).find(x=>key(x)===target);return k?r[k]:""};
 return data.filter(r=>clean(pick(r,"Consecutivo"))).map(r=>({
  consecutivo:clean(pick(r,"Consecutivo")),linea_produccion:clean(pick(r,"Línea Producción")),semana_nc:clean(pick(r,"Semana")),
  seccion:clean(pick(r,"Seccion")),creacion:clean(pick(r,"Creación")),fecha_cierre:clean(pick(r,"Fecha Cierre")),
  referencia:clean(pick(r,"Referencia")),acabado:clean(pick(r,"Acabado")),reserva:clean(pick(r,"Reserva")),proyecto:clean(pick(r,"Proyecto")),
  produccion:clean(pick(r,"Produccion")),sistema:clean(pick(r,"Sistema")),no_cortes:clean(pick(r,"No.Cortes")),perfil_mm:clean(pick(r,"Perfil_mm")),
  peso_kg:clean(pick(r,"Peso Kg")),disposicion:clean(pick(r,"Disposición")),concepto:clean(pick(r,"Concepto")),estado:clean(pick(r,"Estado")),
  responsable:clean(pick(r,"Responsable")),cod_nc:clean(pick(r,"COD NC")),causa:clean(pick(r,"Causa")),reportante:clean(pick(r,"reportante")),
  mercado:clean(pick(r,"Mercado")),tipo:clean(pick(r,"tipo")),ubicacion_bodega:clean(pick(r,"ubicacion_bodega")),co:clean(pick(r,"CO")),
  dias_transcurridos:clean(pick(r,"Dias_transcurridos")),reserva_solucion:clean(pick(r,"Reserva Solucion")),dias_retraso:clean(pick(r,"dias_retraso"))
 }));
}