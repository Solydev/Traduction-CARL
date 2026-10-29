'use strict';
const {setTimeout:delay}=require('node:timers/promises');

function navigationReadError(error){
  return /Execution context was destroyed|Cannot find context with specified id|JSHandles can be evaluated only in the context they were created|Execution context is not available in detached frame/.test(error.message||'');
}
// Réservé aux lectures : aucun clic, POST ou remplissage dans ce callback.
async function readDuringNavigation(read,{timeout=45000}={}){
  const deadline=Date.now()+timeout;
  for(;;){
    try{return await read();}
    catch(error){
      if(!navigationReadError(error)||Date.now()>=deadline)throw error;
      await delay(Math.min(150,Math.max(1,deadline-Date.now())));
    }
  }
}
async function refreshAndWait(page,{anchor,action,ready,timeout=45000}){
  const old=await anchor.elementHandle();
  if(!old)throw new Error('Écran absent avant le rafraîchissement.');
  try{
    await action(); // Une seule transmission, même si le document disparaît ensuite.
    const deadline=Date.now()+timeout;
    for(;;){
      try{if(!await old.evaluate(e=>e.isConnected))break;}
      catch(error){
        // Évaluer l'ancien élément permet de détecter le document détruit.
        // waitForFunction relancé dans la nouvelle page conserverait un argument périmé.
        if(navigationReadError(error))break;
        throw error;
      }
      if(Date.now()>=deadline)throw new Error('Timeout : CARL n’a pas remplacé l’écran après le rafraîchissement.');
      await delay(100);
    }
    await ready();
  }finally{await old.dispose().catch(()=>{});}
}
module.exports={navigationReadError,readDuringNavigation,refreshAndWait};
