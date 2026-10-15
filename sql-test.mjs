import "/vendor/firebase-auth.js";
import "/vendor/firebase-app-check.js";
import { initializeApp } from "/vendor/firebase-app.js";
import { getDataConnect, executeQuery, queryRef } from "/vendor/firebase-data-connect.js";
const state=document.querySelector("#state"), detail=document.querySelector("#detail");
const cfg={projectId:"sgp-one-lab",appId:"1:60057564968:web:sgp-one-lab"};
const connectorConfig={connector:"default",location:"us-east4",service:"sgp-one-test-service"};
async function run(){try{state.textContent="Conectando…";const app=initializeApp(cfg);const dc=getDataConnect(app,connectorConfig);const ref=queryRef(dc,"ConnectivityTestRead");const res=await executeQuery(ref);const rows=res?.data?.connectivityTests||res?.data?.connectivityTestRead||[];const ok=JSON.stringify(res?.data||{}).includes("SGP_GOOGLE_DB_OK");state.textContent=ok?"CONEXIÓN EXITOSA":"RESPUESTA RECIBIDA";state.className="badge "+(ok?"ok":"");detail.textContent=JSON.stringify(res.data,null,2);}catch(e){state.textContent="CONEXIÓN FALLIDA";state.className="badge bad";detail.textContent=(e?.message||String(e))+"\n\n"+(e?.stack||"");}}run();