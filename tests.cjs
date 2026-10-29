'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {readDictionary, normalize, isStandard, fieldKey, prepare, assertSameLayout,
  validateValue, saveAndVerify, LOCALES,auditChanges} = require('./core.cjs');
const dictionary = readDictionary(path.join(__dirname, 'dictionnaire.tsv'));
const {selectProfiles}=require('./core.cjs');
test('la reprise inclut le profil saisi et tous les suivants, dans l’ordre CARL',()=>{
  const codes=['BUYER','CFO','BUYER_LABO','DEFAULT','TECHNICIAN'];
  assert.deepEqual(selectProfiles(codes,{startProfile:' buyer_labo '}),['BUYER_LABO','DEFAULT','TECHNICIAN']);
  assert.deepEqual(selectProfiles(codes,{startProfile:'TECHNICIAN'}),['TECHNICIAN']);
  assert.deepEqual(codes,['BUYER','CFO','BUYER_LABO','DEFAULT','TECHNICIAN']);
});
test('sans profil de départ, toute la liste est sélectionnée',()=>{
  assert.deepEqual(selectProfiles(['BUYER','CFO'],{startProfile:''}),['BUYER','CFO']);
});
test('un profil de départ inconnu est refusé sans reprendre au début',()=>{
  assert.throws(()=>selectProfiles(['BUYER'],{startProfile:'INCONNU'}),/Profil de départ introuvable/);
});
test('la sélection explicite reste disponible et ne se mélange pas à la reprise',()=>{
  assert.deepEqual(selectProfiles(['BUYER','CFO'],{requestedProfiles:['CFO']}),['CFO']);
  assert.throws(()=>selectProfiles(['BUYER'],{requestedProfiles:['CFO']}),/introuvable/);
  assert.throws(()=>selectProfiles(['BUYER'],{requestedProfiles:['BUYER'],startProfile:'BUYER'}),/pas les deux/);
});
const {readDuringNavigation}=require('./attentes.cjs');
test('une lecture interrompue par une navigation peut être reprise',async()=>{
  let reads=0;
  assert.equal(await readDuringNavigation(async()=>{
    if(++reads===1)throw new Error('locator.evaluateAll: Execution context was destroyed, most likely because of a navigation');
    return 'fr_FR';
  }), 'fr_FR');
  assert.equal(reads,2);
});
test('une erreur métier ou un navigateur fermé ne sont pas repris',async()=>{
  for(const message of ['Mauvais profil ouvert.','Target page, context or browser has been closed']){
    let reads=0;
    await assert.rejects(readDuringNavigation(async()=>{reads++;throw new Error(message);}),{message});
    assert.equal(reads,1);
  }
});
function sample() {
  return {description:'PORTAIL BUYER-MALTEUROP', widgets:[
    {slot:'0:0', code:'WIDGETFAVORITE', fields:[{binding:'FAVORITEROW.label', rowKey:'[1,"MR_SEL"]', text:'DI en cours'}]},
    {slot:'1:1', code:'WIDGETFAVORITE', fields:[{binding:'FAVORITEROW.label', rowKey:'[1,"MR_SEL"]', text:'Nouvelle DI'}]}
  ]};
}
test('un profil standard est reconnu, un profil modifiable reste traitable', () => {
  assert.equal(isStandard('InputCheck InputCheckTrueReadOnly'), true);
  assert.equal(isStandard('InputCheck InputCheckFalseReadOnly'), false);
  assert.equal(isStandard('InputCheck InputCheckTrue'), true);
});
test('les traductions sont complètes, sans dépasser les champs de 60 caractères', () => {
  for (const values of dictionary.values()) for (const locale of LOCALES) validateValue(values[locale], 60);
  assert.equal(dictionary.get(normalize('FAVORITES')).en_GB, 'Favourites');
  assert.equal(dictionary.get(normalize('Favourites')).en_US, 'Favorites');
  assert.equal(dictionary.get(normalize('Nouvelle DI')).fr_FR, "Nouvelle demande d'intervention");
});
test('deux widgets du même type gardent des traductions distinctes', () => {
  const plan = prepare(sample(), dictionary);
  assert.equal(plan.missing.length, 0);
  assert.equal(plan.values.get('0:0|WIDGETFAVORITE|FAVORITEROW.label|[1,"MR_SEL"]').en_US, 'Work requests in progress');
  assert.equal(plan.values.get('1:1|WIDGETFAVORITE|FAVORITEROW.label|[1,"MR_SEL"]').en_US, 'New work request');
});
test('audit : les différences sont calculées depuis les textes déjà lus sans altérer les lectures',()=>{
  const snapshot=sample(),original=structuredClone(snapshot);
  const plan=prepare(snapshot,dictionary);
  const changes=auditChanges(snapshot,plan,'en_GB');
  assert.equal(changes.length,2);
  assert.equal(changes[0].widget,'0:0|WIDGETFAVORITE');
  assert.equal(changes[0].after,'Work requests in progress');
  assert.equal(changes[1].after,'New work request');
  assert.deepEqual(snapshot,original);
});
test('un texte inconnu reste signalé et ne reçoit pas de traduction inventée', () => {
  const source = sample(); source.description = 'Texte nouveau inconnu';
  const plan = prepare(source, dictionary);
  assert.equal(plan.values.has('description'), false);
  assert.equal(plan.missing[0].text, 'Texte nouveau inconnu');
});
test('un changement d’identité de ligne est détecté même avec le même nombre de lignes', () => {
  const source = sample(), target = sample();
  target.widgets[0].fields[0].rowKey = '[2,"PO_SEL"]';
  assert.throws(() => assertSameLayout(source, target), /structure/);
  assert.notEqual(fieldKey(source.widgets[0].fields[0]), fieldKey(target.widgets[0].fields[0]));
});
test('la relecture serveur intervient après la disquette et le rafraîchissement', async () => {
  const events = [];
  await saveAndVerify({save:async () => events.push('disquette'), refresh:async () => events.push('rafraichir'),
    read:async () => { events.push('relire'); return sample(); }, expected:sample(), locale:'fr_FR'});
  events.push('changer langue');
  assert.deepEqual(events, ['disquette', 'rafraichir', 'relire', 'changer langue']);
});
test('une sauvegarde perdue empêche de poursuivre vers une autre langue', async () => {
  const events = [], actual = sample(); actual.widgets[0].fields[0].text = 'ancienne valeur';
  await assert.rejects(async () => {
    await saveAndVerify({save:async () => events.push('disquette'), refresh:async () => {}, read:async () => actual,
      expected:sample(), locale:'fr_FR'});
    events.push('changer langue');
  }, /Sauvegarde non confirmée/);
  assert.deepEqual(events, ['disquette']);
});
test('les entrées trop longues ou vides sont rejetées avant saisie', () => {
  assert.throws(() => validateValue('x'.repeat(61), 60), /trop longue/);
  assert.throws(() => validateValue(''), /vide/);
});
const {EventEmitter} = require('node:events');
const {startLocalDisplay} = require('./affichage-local.cjs');
const {checkCarlResponse,captureCarlAjax} = require('./reseau.cjs');
function fakeResponse({navigation=false,status=200,type='text/xml',body='<partial-response><changes/></partial-response>',bodyError=null}={}) {
  let reads=0;
  return {finished:async()=>null,status:()=>status,headers:()=>({'content-type':type}),
    request:()=>({isNavigationRequest:()=>navigation,postData:()=>navigation?'': 'javax.faces.partial.ajax=true'}),
    text:async()=>{reads++;if(bodyError)throw bodyError;return body;},reads:()=>reads};
}
test('régression : une navigation ne relit pas un corps supprimé par Chromium',async()=>{
  const response=fakeResponse({navigation:true,type:'text/html',bodyError:new Error('Network.getResponseBody: No resource with given identifier found')});
  await checkCarlResponse(response);assert.equal(response.reads(),0);
});
test('une redirection HTTP ne tente pas de lire un corps inexistant',async()=>{
  const response=fakeResponse({status:302,bodyError:new Error('corps absent')});
  await checkCarlResponse(response);assert.equal(response.reads(),0);
});
test('une erreur HTTP est toujours bloquante, même après navigation',async()=>{
  await assert.rejects(checkCarlResponse(fakeResponse({navigation:true,status:500})),/HTTP 500/);
});
test('les réponses AJAX sont contrôlées et les erreurs JSF arrêtent le parcours',async()=>{
  const response=fakeResponse();await checkCarlResponse(response);assert.equal(response.reads(),1);
  await assert.rejects(checkCarlResponse(fakeResponse({body:'<partial-response><error><error-name>Erreur</error-name></error></partial-response>'})),/erreur JSF/);
});
test('un corps AJAX perdu ou remplacé par une page de connexion reste bloquant',async()=>{
  await assert.rejects(checkCarlResponse(fakeResponse({bodyError:new Error('No resource with given identifier found')})),/AJAX CARL illisible/);
  await assert.rejects(checkCarlResponse(fakeResponse({body:'<html>Connexion</html>'})),/AJAX CARL inattendue/);
});
test('la capture AJAX garde les octets avant de les livrer au navigateur, sans double requête',async()=>{
  let handler;
  const events=[];
  const request={method:()=> 'POST',isNavigationRequest:()=>false};
  const bytes=Buffer.from('<partial-response><changes/></partial-response>');
  const reader=await captureCarlAjax({route:async(_pattern,fn)=>{handler=fn;}},new URL('https://carl.example/gmao/'));
  const upstream={body:async()=>{events.push('lire');return bytes;},dispose:async()=>{events.push('libérer');}};
  await handler({request:()=>request,fetch:async options=>{assert.equal(options.maxRetries,0);assert.equal(options.maxRedirects,0);events.push('envoyer');return upstream;},
    fulfill:async options=>{assert.deepEqual(options.body,bytes);events.push('livrer');}});
  assert.equal(await reader({request:()=>request,text:async()=>{throw Error('No resource');}}),bytes.toString());
  assert.deepEqual(events,['envoyer','lire','livrer','libérer']);
});
async function fakeDisplay() {
  const events = [];
  const browser = new EventEmitter();
  const page = {screenshot:async () => Buffer.from('image de test sans CARL'),
    keyboard:{insertText:async text => events.push(text),press:async key => events.push(key)},
    mouse:{click:async (x,y) => events.push([x,y]),wheel:async () => {}}};
  const display = await startLocalDisplay(page,browser,{port:0});
  return {...display,events};
}
test('affichage local : les requêtes sans le lien protégé sont refusées', async () => {
  const display = await fakeDisplay();
  try {
    const url = new URL(display.url);
    assert.equal((await fetch(url.origin)).status,403);
    assert.equal((await fetch(display.url)).status,200);
    const picture = new URL('/image',url); picture.search=url.search;
    assert.equal(await (await fetch(picture)).text(),'image de test sans CARL');
  } finally {display.close();}
});
test('affichage local : une origine tierce ne peut transmettre de texte', async () => {
  const display = await fakeDisplay();
  try {
    const url = new URL(display.url);url.pathname='/action';
    const result = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.org'},body:JSON.stringify({kind:'text',text:'test'})});
    assert.equal(result.status,403);assert.deepEqual(display.events,[]);
  } finally {display.close();}
});
test('affichage local : seules les commandes prévues sont acceptées', async () => {
  const display = await fakeDisplay();
  try {
    const url = new URL(display.url);url.pathname='/action';
    const send = body => fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:url.origin},body:JSON.stringify(body)});
    assert.equal((await send({kind:'text',text:'exemple fictif'})).status,200);
    assert.equal((await send({kind:'key',key:'Control+a'})).status,200);
    assert.equal((await send({kind:'eval',code:'non autorisé'})).status,503);
    assert.deepEqual(display.events,['exemple fictif','Control+a']);
  } finally {display.close();}
});
