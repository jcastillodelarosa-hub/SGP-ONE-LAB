// Public Hosting origins for this LAB project; no credentials or wildcard CORS.
const LAB_ORIGINS=['https://sgp-one-lab.web.app','https://sgp-one-lab.firebaseapp.com'];
export function powerBIOrigins(configured){
 const origins=configured===undefined?LAB_ORIGINS:String(configured).split(',').map(x=>x.trim());
 if(!origins.length||origins.some(origin=>{
  try{const url=new URL(origin);return url.protocol!=='https:'||url.origin!==origin||url.username||url.password;}
  catch{return true;}
 }))throw Error('Orígenes servidor LP inválidos');
 return [...new Set(origins)];
}
