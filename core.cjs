'use strict';
const fs = require('node:fs');
const LOCALES = ['fr_FR', 'en_GB', 'de_DE', 'en_US', 'es_ES', 'es_MX'];
const ALLOWED_BINDINGS = new Set([
  'FAVORITEPORTLETANIMATOR.configTitle', 'INDICATORPORTLETANIMATOR.configTitle',
  'REPORTPORTLETANIM.configTitle', 'CONTENTSPORTLETANIM.configTitle',
  'INDICATORCHARTPORTLETANIMATOR.configTitle', 'FAVORITEROW.label', 'REPORTROW.label',
]);
function normalize(text) {
  return String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');
}
function readDictionary(file) {
  const dictionary = new Map();
  for (const [index, line] of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [aliases, fr, gb, de, es, us, mx] = line.split('\t').map(s => s.trim());
    if (![aliases, fr, gb, de, es].every(Boolean)) throw new Error(`Dictionnaire, ligne ${index + 1} : colonnes manquantes.`);
    const values = {fr_FR: fr, en_GB: gb, de_DE: de, en_US: us || gb, es_ES: es, es_MX: mx || es};
    for (const alias of [...aliases.split('~'), ...Object.values(values)]) {
      const key = normalize(alias);
      const previous = dictionary.get(key);
      if (previous && JSON.stringify(previous) !== JSON.stringify(values)) {
        throw new Error(`Traductions contradictoires pour « ${alias} » (ligne ${index + 1}).`);
      }
      dictionary.set(key, values);
    }
  }
  return dictionary;
}
function fieldKey(field) { return `${field.binding}|${field.rowKey || ''}`; }
function widgetKey(widget) { return `${widget.slot}|${widget.code}`; }
function isStandard(className) { return /\bInputCheckTrue(?:ReadOnly)?\b/.test(className); }
function prepare(source, dictionary) {
  const result = new Map();
  const missing = [];
  const add = (key, text) => {
    if (!text.trim()) return;
    const values = dictionary.get(normalize(text));
    if (values) result.set(key, values);
    else missing.push({key, text});
  };
  add('description', source.description);
  for (const widget of source.widgets) {
    const seen = new Set();
    for (const field of widget.fields) {
      const key = fieldKey(field);
      if (seen.has(key)) throw new Error(`Lignes indiscernables dans ${widget.code} : ${key}`);
      seen.add(key);
      add(`${widgetKey(widget)}|${key}`, field.text);
    }
  }
  return {values: result, missing};
}
function assertSameLayout(source, target) {
  const signatures = s => s.widgets.map(w => `${widgetKey(w)}:${w.fields.map(fieldKey).sort().join(';')}`).sort();
  if (JSON.stringify(signatures(source)) !== JSON.stringify(signatures(target))) {
    throw new Error('La structure des widgets diffère entre les langues. Arrêt avant modification.');
  }
}
function validateValue(value, maxLength = -1) {
  if (typeof value !== 'string' || !value.trim() || /[\r\n\x00]/.test(value)) throw new Error('Traduction vide ou invalide.');
  if (maxLength > 0 && value.length > maxLength) throw new Error(`Traduction trop longue (${value.length}/${maxLength}) : ${value}`);
}
function assertSaved(expected, actual, locale) {
  assertSameLayout(expected, actual);
  if (actual.description !== expected.description) throw new Error(`Sauvegarde non confirmée (${locale}) : libellé du profil.`);
  const index = new Map(actual.widgets.map(w => [widgetKey(w), new Map(w.fields.map(f => [fieldKey(f), f.text]))]));
  for (const w of expected.widgets) for (const f of w.fields) {
    if (index.get(widgetKey(w)).get(fieldKey(f)) !== f.text) {
      throw new Error(`Sauvegarde non confirmée (${locale}) : ${w.code}, ${f.binding}, ${f.rowKey}`);
    }
  }
}
async function saveAndVerify({save, refresh, read, expected, locale}) {
  await save();
  await refresh();
  const actual = await read();
  assertSaved(expected, actual, locale);
}
function selectProfiles(codes,{requestedProfiles,startProfile}={}){
  if(requestedProfiles&&startProfile)throw new Error('Utilisez --profiles ou --start-profile, pas les deux.');
  if(requestedProfiles){
    if(requestedProfiles.some(p=>!codes.includes(p)))throw new Error('Un des profils demandés est introuvable.');
    return [...requestedProfiles];
  }
  const start=String(startProfile||'').trim();
  if(!start)return [...codes];
  const index=codes.findIndex(code=>code.toUpperCase()===start.toUpperCase());
  if(index<0)throw new Error('Profil de départ introuvable : '+start);
  return codes.slice(index); // Ordre CARL conservé ; le profil saisi est inclus.
}
function auditChanges(snapshot,translated,locale){
  const changes=[];
  for(const widget of snapshot.widgets)for(const field of widget.fields){
    const key=`${widgetKey(widget)}|${fieldKey(field)}`;
    const desired=translated.values.get(key)?.[locale];
    if(desired&&desired!==field.text)changes.push({widget:widgetKey(widget),field:fieldKey(field),before:field.text,after:desired});
  }
  return changes;
}
module.exports = {LOCALES, ALLOWED_BINDINGS, normalize, readDictionary, fieldKey, widgetKey, isStandard,
  prepare, assertSameLayout, validateValue, assertSaved, saveAndVerify,auditChanges,selectProfiles};
