'use strict';
// V1.3.0 — Reprise à partir d'un profil inclus, dans l'ordre de la liste CARL.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {setTimeout:delay}=require('node:timers/promises');
const {LOCALES, readDictionary, fieldKey, widgetKey, isStandard,
  prepare, assertSameLayout, validateValue, saveAndVerify,auditChanges,selectProfiles} = require('./core.cjs');
const {startLocalDisplay} = require('./affichage-local.cjs');
const {checkCarlResponse,captureCarlAjax} = require('./reseau.cjs');
const {waitForLanguageTransition} = require('./langues.cjs');
const {readDuringNavigation,refreshAndWait}=require('./attentes.cjs');
const {readFields,fillWidgetField}=require('./champs.cjs');
const {PROFILE_LIST_SELECTOR,WIDGET_TABLE_SELECTOR,waitForTableReady,waitForProfileList,
  waitForWidgetReady,waitForPager}=require('./ecrans.cjs');
const ROOT = __dirname;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const localDisplay = process.platform === 'linux' && args.includes('--local-display');
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const requestedProfiles = option('--profiles')?.split(',');
let startProfile=option('--start-profile')?.trim();
const languages = option('--languages')?.split(',') || LOCALES;
const baseUrl = option('--url') || 'https://cmmsv7.malteurop.com/gmao/';
const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
if (base.protocol !== 'https:') throw new Error('Une adresse CARL en HTTPS est nécessaire.');
if (languages.some(l => !LOCALES.includes(l))) throw new Error('Langue inconnue. Codes : ' + LOCALES.join(', '));
const reportDir = path.join(ROOT, 'rapports', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(reportDir, {recursive: true});
const csvFile = path.join(reportDir, 'modifications.csv');
fs.writeFileSync(csvFile, '\uFEFFprofil;langue;widget;champ;avant;apres;statut\r\n');
const readsFile=path.join(reportDir,'lectures.csv');
fs.writeFileSync(readsFile,'\uFEFFprofil;langue;widget;champ;texte_lu\r\n');
function recordRead(profile,locale,widget,field,text){
  const row=[profile,locale,widget,field,text].map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(';');
  fs.appendFileSync(readsFile,row+'\r\n');
}
function report(profile, locale, widget, field, before, after, status) {
  const row = [profile, locale, widget, field, before, after, status].map(x => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(';');
  fs.appendFileSync(csvFile, row + '\r\n');
}
function log(message) { console.log(message); fs.appendFileSync(path.join(reportDir, 'execution.log'), message + '\n'); }
function playwrightModule() {
  if (process.env.CARL_PLAYWRIGHT_MODULE) return require(process.env.CARL_PLAYWRIGHT_MODULE);
  try { return require('playwright'); }
  catch (e) {
    const linuxRuntime = path.join(os.homedir(), '.local', 'share', 'carl-traduction', 'runtime', 'node_modules', 'playwright');
    if (process.platform === 'linux' && fs.existsSync(linuxRuntime)) return require(linuxRuntime);
    const bundled = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright');
    if (fs.existsSync(bundled)) return require(bundled);
    throw new Error('Playwright absent. Exécutez Installer.cmd, puis relancez.', {cause: e});
  }
}
const sel = id => `[id=${JSON.stringify(id)}]`;
let page;
let readResponseBody;
const byId = id => page.locator(sel(id));
const visibleDialogs = () => page.locator('[role="dialog"]:visible');
async function readText(id) {
  return byId(id).evaluate(e => e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' ? e.value : e.textContent.trim());
}
async function post(action) {
  const pending = page.waitForResponse(r => r.request().method() === 'POST' &&
    new URL(r.url()).origin === base.origin && new URL(r.url()).pathname.startsWith(base.pathname), {timeout: 30000});
  // Catch immediately to avoid an unhandled rejection if the click itself fails.
  pending.catch(() => {});
  await action();
  const response = await pending;
  await checkCarlResponse(response,readResponseBody);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', {timeout: 30000});
  if (/\/gmao\/(?:auth\/)?login(?:[/?#]|$)/.test(page.url())) throw new Error('Session CARL expirée.');
}
async function currentLocale() {
  return readDuringNavigation(()=>byId('ignore-tpl-switch-lang').locator('script').evaluateAll(es => {
    const match = es.map(e => e.textContent).join('\n').match(/"locale"\s*:\s*"([^"]+)"/);
    return match?.[1] || null;
  }));
}
async function waitForProfileReady(profile,locale){
  const options={target:locale,screenId:'dashboard_DET:da_Dashboard_Code',screenValue:profile};
  const check=async()=>{
    const state=await waitForLanguageTransition(page,options);
    if(state.kind!=='ready')throw new Error('Message CARL pendant la sauvegarde : '+state.text);
  };
  await check();
  await waitForTableReady(page,{rootSelector:WIDGET_TABLE_SELECTOR,itemSelector:'[id$=":da_Dashboard_WidgetDefinition_Code"]'});
  await check();
}
async function switchLocale(locale) {
  if (await currentLocale() === locale) return;
  if (await visibleDialogs().count()) throw new Error('Une fenêtre CARL est ouverte avant le changement de langue.');
  const hasProfile = await byId('dashboard_DET:da_Dashboard_Code').count() === 1;
  const screenId = hasProfile ? 'dashboard_DET:da_Dashboard_Code' : 'main-menu-entry-system';
  const screenValue = hasProfile ? await readText(screenId) : null;
  await byId('uid-info-ref').click();
  await byId('user-detail-lang-dropdown-button').click();
  const links = byId('ignore-tpl-switch-lang').locator('a');
  if (await links.count() !== LOCALES.length) throw new Error('La liste des langues CARL a changé : adaptation nécessaire.');
  await post(() => links.nth(LOCALES.indexOf(locale)).click());
  let confirmed = false;
  for (;;) {
    let state;
    try {state = await waitForLanguageTransition(page,{target:locale,screenId,screenValue});}
    catch (cause) {
      const observed = await currentLocale().catch(()=>null);
      throw new Error(`CARL n’a pas terminé le changement vers ${locale} (code observé : ${observed || 'page en chargement'}).`,{cause});
    }
    if (state.kind === 'ready') return;
    if (confirmed || !/changement de langue|change of language|Sprachwechsel|Sprache.*(?:Seite|wirksam)|cambio de idioma|idioma.*(?:página|efect)/is.test(state.text)) {
      throw new Error('Message CARL inattendu lors du changement de langue : ' + state.text);
    }
    confirmed = true;
    const dialog = visibleDialogs();
    await post(() => dialog.locator('[id="defaultButton"]').click());
    await dialog.waitFor({state:'hidden'});
    // La confirmation peut déclencher une nouvelle navigation après le dernier
    // événement réseau. On attend à nouveau l'état final, sans recliquer la langue.
  }
}
function pager(root) { return root.locator('[id$=":s-stbLines"]'); }
async function pageNumbers(root) {
  await root.waitFor({state:'visible'});
  const p = pager(root);
  if (!await p.count()) return null;
  if (await p.count() !== 1) throw new Error('Plusieurs tableaux dans une fenêtre : adaptation nécessaire.');
  const numbers = (await p.innerText()).match(/\d+/g)?.map(Number) || [];
  if (numbers.length !== 3) throw new Error('Pagination CARL non reconnue : ' + await p.innerText());
  return numbers;
}
async function firstPage(root) {
  const numbers = await pageNumbers(root);
  if (numbers && numbers[0] > 1) {
    const id=await pager(root).getAttribute('id');
    await post(() => root.locator('[id$=":a-stbFirst"]').click());
    await waitForPager(page,{id,first:1});
  }
}
async function nextPage(root) {
  const before = await pageNumbers(root);
  if (!before || before[1] >= before[2]) return false;
  const id=await pager(root).getAttribute('id');
  await post(() => root.locator('[id$=":a-stbNext"]').click());
  const after = await waitForPager(page,{id,after:before[0]});
  if (!after || after[0] <= before[0]) throw new Error('La pagination ne progresse pas.');
  return true;
}
async function profiles() {
  await waitForProfileList(page);
  const table = page.locator(PROFILE_LIST_SELECTOR);
  await firstPage(table);
  const codes = [];
  do {
    const state=await waitForProfileList(page);
    codes.push(...state.items);
  } while (await nextPage(table));
  if (new Set(codes).size !== codes.length) throw new Error('Profils dupliqués dans les pages de résultats.');
  return codes.map(x => x.trim());
}
async function openProfile(code) {
  await waitForProfileList(page);
  const table = page.locator(PROFILE_LIST_SELECTOR);
  await firstPage(table);
  do {
    await waitForProfileList(page);
    const link = table.locator('a[id$=":cl_Dashboard_Code"]').filter({hasText: new RegExp('^\\s*' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$')});
    if (await link.count() === 1) {
      await post(() => link.click());
      await byId('dashboard_DET:da_Dashboard_Code').waitFor();
      if (await readText('dashboard_DET:da_Dashboard_Code') !== code) throw new Error('Mauvais profil ouvert.');
      return;
    }
  } while (await nextPage(table));
  throw new Error('Profil introuvable : ' + code);
}
async function standardProfile() {
  return isStandard(await byId('dashboard_DET:da_Dashboard_Standard_IMG').getAttribute('class') || '');
}
async function fillField(field, desired) {
  return fillWidgetField({field,desired,byId,dialog:visibleDialogs(),post});
}
async function inspectWidgets({profile, locale, translated, source, mutate = false,recordReads=false} = {}) {
  const table = page.locator(WIDGET_TABLE_SELECTOR);
  await waitForTableReady(page,{rootSelector:WIDGET_TABLE_SELECTOR,itemSelector:'[id$=":da_Dashboard_WidgetDefinition_Code"]'});
  await firstPage(table);
  const output = [];
  do {
    await waitForTableReady(page,{rootSelector:WIDGET_TABLE_SELECTOR,itemSelector:'[id$=":da_Dashboard_WidgetDefinition_Code"]'});
    const widgets = await readDuringNavigation(async()=>{
      await waitForProfileReady(profile,locale);
      return table.locator('[id$=":cl_Dashboard_DetailLink"]').evaluateAll(es => es.map(e => ({
      id:e.id, slot:e.id.match(/:(\d+:\d+):cl_Dashboard_DetailLink$/)?.[1],
      code:e.closest('tr').querySelector('[id$=":da_Dashboard_WidgetDefinition_Code"]').textContent.trim()
      })));
    });
    for (const widget of widgets) {
      if (!widget.slot) throw new Error('Position de widget non reconnue.');
      await post(() => byId(widget.id).click());
      const dialog = visibleDialogs();
      await dialog.waitFor();
      await waitForWidgetReady(page);
      const openedAt=Date.now();
      await firstPage(dialog);
      const fields = [];
      let changed = false;
      do {
        await waitForWidgetReady(page);
        const pageFields = await readFields(dialog);
        if (!pageFields.length) throw new Error('Widget sans champs reconnus : ' + widget.code);
        for (const field of pageFields) {
          const dictionaryKey = `${widgetKey(widget)}|${fieldKey(field)}`;
          const desired = translated?.values.get(dictionaryKey)?.[locale];
          const sourceWidget = source?.widgets.find(w => widgetKey(w) === widgetKey(widget));
          if (source && !sourceWidget?.fields.some(f => fieldKey(f) === fieldKey(field))) {
            throw new Error('Identité de ligne différente entre les langues : ' + dictionaryKey);
          }
          if (desired && desired !== field.text) {
            if (mutate) { await fillField(field, desired); changed = true; }
            report(profile, locale, widgetKey(widget), fieldKey(field), field.text, desired, mutate ? 'saisi' : 'prévu');
          }
          fields.push({...field, text: mutate && desired ? desired : field.text});
        }
      } while (await nextPage(dialog));
      if(recordReads){
        for(const field of fields)recordRead(profile,locale,widgetKey(widget),fieldKey(field),field.text);
        log(`${profile} / ${locale} / ${widget.code} [${widget.slot}] : ${fields.length} champ(s) lu(s).`);
      }
      // Confort visuel uniquement : la lecture attend déjà les champs complets.
      const remaining=1200-(Date.now()-openedAt);
      if(remaining>0)await delay(remaining);
      if (changed) {
        await post(() => dialog.locator('[id="defaultButton"]').click());
      } else {
        await post(() => dialog.locator('[id="button-0"]').click());
      }
      await dialog.waitFor({state:'hidden'});
      output.push({...widget, fields});
    }
  } while (await nextPage(table));
  return output;
}
async function snapshot(profile, locale) {
  const description=await readText('dashboard_DET:da_Dashboard_Description');
  recordRead(profile,locale,'','DASHBOARD.description',description);
  return {profile, locale, description,
    widgets: await inspectWidgets({profile,locale,recordReads:true})};
}
async function processProfile(profile, dictionary) {
  if (await standardProfile()) {
    log(`${profile} : STANDARD, ignoré (aucune modification, aucune sauvegarde).`);
    report(profile, '', '', '', '', '', 'standard ignoré');
    return;
  }
  await switchLocale('fr_FR');
  const source = await snapshot(profile, 'fr_FR');
  const translated = prepare(source, dictionary);
  for (const missing of translated.missing) report(profile, '', '', missing.key, missing.text, '', 'absent du dictionnaire');
  if (translated.missing.length) log(`${profile} : ${translated.missing.length} texte(s) à ajouter au dictionnaire.`);
  for (const locale of languages) {
    await switchLocale(locale);
    const before = !apply&&locale==='fr_FR' ? structuredClone(source) : await snapshot(profile, locale);
    assertSameLayout(source, before);
    fs.appendFileSync(path.join(reportDir, 'originaux.jsonl'), JSON.stringify(before) + '\n');
    const expected = structuredClone(before);
    const desiredDescription = translated.values.get('description')?.[locale];
    if (desiredDescription && desiredDescription !== before.description) {
      const input = byId('dashboard_DET:da_Dashboard_Description');
      validateValue(desiredDescription, await input.evaluate(e => e.maxLength));
      report(profile, locale, '', 'DASHBOARD.description', before.description, desiredDescription, apply ? 'saisi' : 'prévu');
      if (apply) { await input.fill(desiredDescription); await input.press('Tab'); expected.description = desiredDescription; }
    }
    if (apply) {
      const widgets = await inspectWidgets({profile, locale, translated, source, mutate:true});
      expected.widgets = widgets;
      // Impératif : disquette, relecture serveur, comparaison, puis seulement autre langue.
      await saveAndVerify({
        save:async () => {
          await waitForProfileReady(profile,locale);
          if (await standardProfile()) throw new Error('Le profil est devenu standard.');
          log(`${profile} / ${locale} : enregistrement avec la disquette…`);
          await post(() => byId('dashboard_DET:a-DataSave').click());
          report(profile,locale,'','','','','disquette transmise, vérification en attente');
          await waitForProfileReady(profile,locale);
        },
        refresh:async () => {
          log(`${profile} / ${locale} : rafraîchissement et chargement de l’écran…`);
          await refreshAndWait(page,{
            anchor:byId('dashboard_DET:da_Dashboard_Description'),
            action:()=>post(()=>byId('dashboard_DET:a-Refresh').click()),
            ready:()=>waitForProfileReady(profile,locale)
          });
        },
        read:async () => {
          log(`${profile} / ${locale} : vérification des valeurs sauvegardées…`);
          return snapshot(profile,locale);
        }, expected, locale
      });
      report(profile, locale, '', '', '', '', 'sauvegarde vérifiée');
      log(`${profile} / ${locale} : sauvegarde vérifiée.`);
    } else {
      for(const change of auditChanges(before,translated,locale)){
        report(profile,locale,change.widget,change.field,change.before,change.after,'prévu');
      }
      const count=before.widgets.reduce((sum,w)=>sum+w.fields.length,0);
      log(`${profile} / ${locale} : audit terminé (${before.widgets.length} widgets, ${count} champs lus).`);
    }
  }
}
async function main() {
  if (args.includes('--help')) {
    console.log('node carl.cjs --audit|--apply [--start-profile BUYER_LABO | --profiles BUYER,CFO] [--languages fr_FR,en_GB] [--url https://serveur/gmao/]');
    console.log('--start-profile : traiter ce profil inclus, puis tous les suivants dans la liste CARL.');
    console.log('Sous WSL : bash lancer-wsl.sh --audit (ou --apply). Vérification : --diagnostic.');
    return;
  }
  if(args.includes('--start-profile')&&(!startProfile||startProfile.startsWith('--'))){
    throw new Error('Indiquez un code après --start-profile.');
  }
  if(args.includes('--ask-start-profile')&&!startProfile){
    const prompt=require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});
    try{startProfile=(await prompt.question('Profil de départ inclus (Entrée = toute la liste) : ')).trim();}
    finally{prompt.close();}
  }
  if(requestedProfiles&&startProfile)throw new Error('Utilisez --profiles ou un profil de départ, pas les deux.');
  const dictionary = readDictionary(path.join(ROOT, 'dictionnaire.tsv'));
  const {chromium} = playwrightModule();
  if (args.includes('--diagnostic')) {
    const candidates = process.platform === 'win32' ? [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files','Google','Chrome','Application','chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)','Google','Chrome','Application','chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google','Chrome','Application','chrome.exe')
    ] : [];
    const executable = candidates.find(p => fs.existsSync(p)) || chromium.executablePath();
    console.log('Plateforme : ' + process.platform);
    console.log('Node.js : ' + process.version);
    console.log('Playwright : disponible');
    console.log('Navigateur : ' + executable);
    console.log('Binaire présent : ' + fs.existsSync(executable));
    console.log('Affichage Linux : ' + (process.env.DISPLAY || process.env.WAYLAND_DISPLAY || 'absent'));
    console.log('Dictionnaire : ' + dictionary.size + ' entrées reconnues');
    if (!fs.existsSync(executable)) process.exitCode = 1;
    return;
  }
  if (process.platform === 'linux' && !localDisplay && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error('Affichage Linux absent. Ce programme nécessite WSLg ou un affichage X11 pour votre connexion manuelle.');
  }
  let browser;
  if (process.platform === 'linux') {
    browser = await chromium.launch({headless:localDisplay,
      args:['--ozone-platform=x11', '--disable-gpu', '--window-position=60,60', '--window-size=1280,900']});
  } else {
    try {
      browser = await chromium.launch({channel:'chrome', headless:false, args:['--start-maximized']});
    } catch {
      browser = await chromium.launch({headless:false, args:['--start-maximized']});
    }
  }
  const context = await browser.newContext({acceptDownloads:false, viewport:localDisplay ? {width:1280,height:900} : null});
  page = await context.newPage();
  const display = localDisplay ? await startLocalDisplay(page,browser) : null;
  process.once('SIGINT', () => browser.close().catch(() => {}));
  process.once('SIGTERM', () => browser.close().catch(() => {}));
  page.setDefaultTimeout(30000);
  page.on('dialog', async dialog => { await dialog.dismiss(); }); // Aucun avertissement natif accepté à l'aveugle.
  try {
    log(`Mode : ${apply ? 'CORRECTION' : 'AUDIT — aucune donnée modifiée'}.`);
    log('Ouverture du navigateur…');
    await page.goto(new URL('auth/login', base).href);
    if (!localDisplay) await page.bringToFront();
    await page.screenshot({path:path.join(reportDir, 'connexion.png'),timeout:5000})
      .catch(error => log('Capture de diagnostic indisponible : ' + error.message.split('\n')[0]));
    if (display) {
      log('Ouvrez ce lien dans votre navigateur Windows pour voir CARL :');
      log(display.url);
      log('Connectez-vous dans cet affichage local. Le programme reprend après connexion.');
    } else {
      log('Connectez-vous dans la fenêtre du navigateur ouverte (Alt+Tab si elle est masquée).');
    }
    await byId('main-menu-entry-system').waitFor({timeout:600000});
    readResponseBody = await captureCarlAjax(page,base);
    await switchLocale('fr_FR');
    await byId('main-menu-entry-system').click();
    await post(() => byId('main-menu-system-submodule-personalisation').getByText("Ecrans d'accueil", {exact:true}).click());
    const codes = await profiles();
    const selected = selectProfiles(codes,{requestedProfiles,startProfile});
    if(startProfile)log(`Reprise à partir de ${selected[0]} inclus : ${selected.length} profil(s) dans l’ordre de la liste CARL (les standards seront ignorés).`);
    for (const code of selected) {
      log('Traitement : ' + code);
      await openProfile(code);
      await processProfile(code, dictionary);
      await post(() => byId('dashboard_DET:a-Cancel').click());
      await waitForProfileList(page);
    }
    await switchLocale('fr_FR');
    log('Terminé. Rapport : ' + csvFile);
    log('Les textes absents du dictionnaire restent inchangés ; consultez le rapport.');
  } catch (error) {
    log('ARRÊT : ' + error.message);
    fs.writeFileSync(path.join(reportDir,'erreur-technique.log'),(error.stack||String(error))+
      (error.details?'\n'+JSON.stringify(error.details,null,2):''));
    await page.screenshot({path:path.join(reportDir, 'erreur.png'), fullPage:true}).catch(() => {});
    log('Aucun changement de langue supplémentaire. Les saisies non sauvegardées peuvent rester visibles dans CARL.');
    process.exitCode = 1;
  } finally {
    console.log(display ? 'Cliquez sur « Fermer le programme » dans l’affichage local pour terminer.' : 'Fermez la fenêtre du navigateur pour terminer.');
    await new Promise(resolve => browser.isConnected() ? browser.once('disconnected', resolve) : resolve());
  }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
