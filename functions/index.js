const {onRequest}=require("firebase-functions/v2/https");

const SUPABASE_ORIGIN="https://ocvxbwzqxbrfndkvjmfx.supabase.co";
const PUBLIC_KEY="sb_publishable_DD7RmnEZdIV8zKh6E3lMpw_ROWqs3rt";

exports.sgpGateway=onRequest({region:"us-east1",cors:false,timeoutSeconds:120,memory:"256MiB"},async(req,res)=>{
  try{
    const marker="/sgp-gateway";
    const original=req.originalUrl||req.url||"";
    const i=original.indexOf(marker);
    let path=i>=0?original.slice(i+marker.length):original;
    if(!path.startsWith("/"))path="/"+path;
    if(path==="/"||path===""){
      res.status(200).json({ok:true,service:"sgp-gateway"});
      return;
    }
    if(!/^\/(rest|storage)\/v1\//.test(path)&&path!=="/rest/v1/"&&path!=="/storage/v1/"){
      res.status(404).json({message:"Ruta no permitida"});
      return;
    }
    const headers={};
    for(const [k,v] of Object.entries(req.headers)){
      const key=k.toLowerCase();
      if(["host","content-length","connection","accept-encoding","origin","referer"].includes(key))continue;
      if(v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);
    }
    headers.apikey=PUBLIC_KEY;
    if(!headers.authorization)headers.authorization="Bearer "+PUBLIC_KEY;
    const init={method:req.method,headers,redirect:"manual"};
    if(!["GET","HEAD"].includes(req.method)){
      if(Buffer.isBuffer(req.rawBody))init.body=req.rawBody;
      else if(req.body!=null)init.body=typeof req.body==="string"?req.body:JSON.stringify(req.body);
    }
    const upstream=await fetch(SUPABASE_ORIGIN+path,init);
    res.status(upstream.status);
    upstream.headers.forEach((value,key)=>{
      if(!["content-encoding","transfer-encoding","connection","content-length"].includes(key.toLowerCase()))res.setHeader(key,value);
    });
    const body=Buffer.from(await upstream.arrayBuffer());
    res.send(body);
  }catch(error){
    console.error("SGP gateway",error);
    res.status(502).json({message:"No fue posible comunicar el gateway con Supabase."});
  }
});
