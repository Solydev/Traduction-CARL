'use strict';
const {readDuringNavigation}=require('./attentes.cjs');

// Fonction autonome exécutée dans le document par Playwright. Renvoie false
// tant que CARL est entre deux pages, même si le réseau paraît déjà inactif.
function languageTransitionState({target,screenId,screenValue}) {
  const visible = e => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(visible);
  if (dialog) return {kind:'dialog',text:dialog.innerText};
  const form = document.getElementById('ignore-tpl-switch-lang');
  const script = form ? Array.from(form.querySelectorAll('script')).map(e=>e.textContent).join('\n') : '';
  const locale = script.match(/"locale"\s*:\s*"([^"]+)"/)?.[1] || null;
  if (locale !== target || document.readyState !== 'complete') return false;
  const selector = document.getElementById('user-detail-lang-dropdown-button');
  // Le sélecteur est caché lorsque son menu est fermé : son texte doit néanmoins être chargé.
  if (!selector?.textContent.trim()) return false;
  const screen = document.getElementById(screenId);
  if (!visible(screen)) return false;
  const value = screen.tagName === 'INPUT' ? screen.value : screen.textContent.trim();
  if (screenValue != null && value !== screenValue) return false;
  return {kind:'ready',locale};
}
async function waitForLanguageTransition(page, options, timeout=45000) {
  return readDuringNavigation(async()=>{
    const result = await page.waitForFunction(languageTransitionState,options,{polling:100,timeout});
    try {return await result.jsonValue();}
    finally {await result.dispose().catch(()=>{});}
  },{timeout});
}
module.exports = {languageTransitionState,waitForLanguageTransition};
