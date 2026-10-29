'use strict';
const {readDuringNavigation}=require('./attentes.cjs');
const PROFILE_LIST_SELECTOR='[id^="dashboard_SEL:"][id$=":tb_Dashboard_SEL_result"]';
const WIDGET_TABLE_SELECTOR='[id^="dashboard_DET:"][id$=":tb_Dashboard_Widgets"]';

function tableReadyState({rootSelector,itemSelector,expectedFirst=null}) {
  const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
  if(document.readyState!=='complete')return false;
  const root=document.querySelector(rootSelector);
  if(!visible(root))return false;
  const pager=root.querySelector('[id$=":s-stbLines"]');
  if(!pager)return false;
  const numbers=pager.innerText.match(/\d+/g)?.map(Number)||[];
  if(numbers.length!==3)return false;
  const [first,last,total]=numbers;
  if(expectedFirst!==null&&first!==expectedFirst)return false;
  const items=Array.from(root.querySelectorAll(itemSelector)).map(e=>e.textContent.trim());
  const expected=total===0?0:last-first+1;
  if(items.length!==expected||items.some(x=>!x))return false;
  return {rootId:root.id,first,last,total,items};
}
function widgetReadyState() {
  const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
  if(document.readyState!=='complete')return false;
  const dialogs=Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible);
  if(dialogs.length!==1)return false;
  const dialog=dialogs[0];
  const title=Array.from(dialog.querySelectorAll('input[title],textarea[title]'))
    .find(e=>(e.tagName!=='INPUT'||e.type==='text')&&/\.configTitle\]/.test(e.title));
  if(!visible(title)||title.disabled)return false;
  const buttons=['defaultButton','button-0'].map(id=>dialog.querySelector(`[id="${id}"]`));
  if(buttons.some(b=>!visible(b)||b.disabled))return false;
  const pager=dialog.querySelector('[id$=":s-stbLines"]');
  const requiresTable=/\[(?:FAVORITEPORTLETANIMATOR|REPORTPORTLETANIM)\.configTitle\]/.test(title.title);
  if(requiresTable&&!pager)return false;
  if(pager){
    const numbers=pager.innerText.match(/\d+/g)?.map(Number)||[];
    if(numbers.length!==3)return false;
    const expected=numbers[2]===0?0:numbers[1]-numbers[0]+1;
    const labels=Array.from(dialog.querySelectorAll('[id]'))
      .filter(e=>/\[(?:FAVORITEROW|REPORTROW)\.label\]/.test(e.title||'')||
        e.id.endsWith(':da_ConfigFavPortlet_Favorites_Formdescription')||
        e.id.endsWith(':da_ConfigRepPortlet_Reports_Formdescription'));
    if(labels.length!==expected)return false;
  }
  return true;
}
async function resultValue(handle){try{return await handle.jsonValue();}finally{await handle.dispose();}}
async function waitForTableReady(page,options,timeout=45000){
  return readDuringNavigation(async()=>resultValue(await page.waitForFunction(tableReadyState,options,{polling:100,timeout})),{timeout});
}
async function waitForProfileList(page,timeout=45000){
  return waitForTableReady(page,{rootSelector:PROFILE_LIST_SELECTOR,itemSelector:'a[id$=":cl_Dashboard_Code"]'},timeout);
}
async function waitForWidgetReady(page,timeout=45000){
  return resultValue(await page.waitForFunction(widgetReadyState,null,{polling:100,timeout}));
}
async function waitForPager(page,{id,first=null,after=null},timeout=45000){
  return resultValue(await page.waitForFunction(({id,first,after})=>{
    const pager=document.getElementById(id);
    const nums=pager?.innerText.match(/\d+/g)?.map(Number)||[];
    if(nums.length!==3)return false;
    if(first!==null&&nums[0]!==first)return false;
    if(after!==null&&nums[0]<=after)return false;
    return nums;
  },{id,first,after},{polling:100,timeout}));
}
module.exports={PROFILE_LIST_SELECTOR,WIDGET_TABLE_SELECTOR,tableReadyState,widgetReadyState,
  waitForTableReady,waitForProfileList,waitForWidgetReady,waitForPager};
