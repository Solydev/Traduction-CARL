'use strict';
const {ALLOWED_BINDINGS,fieldKey,validateValue}=require('./core.cjs');

// Fonction autonome exécutée dans le document. Les icônes et conteneurs de
// recherche peuvent porter le même title que leur champ : ce ne sont pas des codes.
function widgetFieldsInDocument(dialog){
  const binding=e=>{
    const declared=e.title?.match(/\[([A-Z]+\.[a-zA-Z]+)\]/)?.[1];
    if(declared)return declared;
    // CARL peut retirer l'infobulle lors du passage span -> input. Ces deux
    // identifiants désignent explicitement les libellés, jamais les codes.
    if(e.id?.endsWith(':da_ConfigFavPortlet_Favorites_Formdescription'))return 'FAVORITEROW.label';
    if(e.id?.endsWith(':da_ConfigRepPortlet_Reports_Formdescription'))return 'REPORTROW.label';
  };
  const value=e=>/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)?e.value:e.textContent.trim();
  const valueElement=e=>/^(INPUT|TEXTAREA|SELECT|SPAN)$/.test(e.tagName)&&
    !Array.from(e.querySelectorAll('[title]')).some(child=>binding(child)===binding(e));
  const identity=(row,family)=>{
    if(!row||!family)return '';
    const names=family==='FAVORITEROW'?['component','customForm','form']:['component','funct','report'];
    const entries=names.map(name=>{
      const key=`${family}.${name}`;
      const values=[...new Set(Array.from(row.querySelectorAll('[title]'))
        .filter(e=>binding(e)===key&&valueElement(e)).map(value).filter(x=>x!==''))];
      if(values.length>1)throw new Error('Codes contradictoires dans la ligne : '+key);
      return [key,values[0]||''];
    });
    if(!entries.find(([key])=>key.endsWith('.component'))?.[1]||
       !entries.find(([key])=>key.endsWith(family==='FAVORITEROW'?'.form':'.funct'))?.[1]){
      throw new Error('Identité technique incomplète : '+family);
    }
    return JSON.stringify(entries.sort((a,b)=>a[0].localeCompare(b[0])));
  };
  return Array.from(dialog.querySelectorAll('input,textarea,span[id]'))
    .filter(e=>(e.tagName!=='INPUT'||e.type==='text')&&binding(e)&&valueElement(e)).map(e=>{
      const key=binding(e),family=key?.match(/^(FAVORITEROW|REPORTROW)\.label$/)?.[1];
      return {id:e.id,binding:key,text:value(e),max:e.maxLength||-1,rowKey:identity(e.closest('tr'),family)};
    }).filter(e=>e.binding);
}
async function readFields(dialog){
  return (await dialog.evaluate(widgetFieldsInDocument)).filter(f=>ALLOWED_BINDINGS.has(f.binding));
}
function assertFieldUnchanged(expected,live){
  if(!live||expected.id!==live.id||fieldKey(expected)!==fieldKey(live)||expected.text!==live.text){
    const error=new Error('La ligne a changé avant la saisie : '+expected.id);
    error.details={expected,live:live||null};
    throw error;
  }
}
async function fillWidgetField({field,desired,byId,dialog,post}){
  const verify=async()=>{
    const live=(await readFields(dialog)).find(f=>f.id===field.id);
    try{assertFieldUnchanged(field,live);}
    catch(error){
      if(!live)error.details.element=await byId(field.id).evaluate(e=>({
        id:e.id,tag:e.tagName,type:e.getAttribute('type'),title:e.getAttribute('title'),
        value:/^(INPUT|TEXTAREA)$/.test(e.tagName)?e.value:e.textContent.trim()
      })).catch(()=>null);
      throw error;
    }
  };
  await verify();
  let locator=byId(field.id);
  if(!await locator.evaluate(e=>e.tagName==='INPUT'||e.tagName==='TEXTAREA')){
    await post(()=>locator.click());
    locator=byId(field.id).filter({visible:true});
    await locator.page().waitForFunction(id=>{
      const e=document.getElementById(id);
      return e&&/^(INPUT|TEXTAREA)$/.test(e.tagName)&&!e.disabled;
    },field.id);
  }
  validateValue(desired,await locator.evaluate(e=>e.maxLength));
  await verify();
  const hasChange=await locator.evaluate(e=>!!e.getAttribute('onchange')||!!e.getAttribute('onblur'));
  const fill=async()=>{await locator.fill(desired);await locator.press('Tab');};
  if(hasChange)await post(fill);else await fill();
  if(await locator.inputValue()!==desired)throw new Error('Saisie non confirmée : '+field.id);
}
module.exports={widgetFieldsInDocument,readFields,assertFieldUnchanged,fillWidgetField};
