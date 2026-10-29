'use strict';

async function checkCarlResponse(response, readBody = response => response.text()) {
  const failure = await response.finished();
  if (failure) throw new Error('La requête CARL ne s’est pas terminée correctement.', {cause:failure});
  const status = response.status();
  if (status < 200 || status >= 400) throw new Error(`CARL a répondu HTTP ${status}.`);
  const request = response.request();
  // Une réponse de navigation peut être évincée de Chromium dès le changement
  // de document. Sa réussite est contrôlée ensuite par l'état de la page.
  // Les redirections n'ont pas de corps de réponse exploitable non plus.
  if (request.isNavigationRequest() || (status >= 300 && status < 400)) return;
  const type = response.headers()['content-type'] || '';
  const ajax = /xml/i.test(type) || /(?:^|&)javax\.faces\.partial\.ajax=true(?:&|$)/.test(request.postData() || '');
  if (!ajax) return;
  let text;
  try { text = await readBody(response); }
  catch (cause) {
    // Ne pas rejouer l'action : elle a pu modifier les données côté serveur.
    throw new Error('Réponse AJAX CARL illisible. Arrêt sans rejouer l’action ni changer de langue.', {cause});
  }
  if (/<(?:\w+:)?error(?:\s|>)/i.test(text)) {
    throw new Error('CARL a renvoyé une erreur JSF. La sauvegarde ne peut pas être confirmée.');
  }
  if (!/<(?:\w+:)?partial-response(?:\s|>)/i.test(text)) {
    throw new Error('Réponse AJAX CARL inattendue. La sauvegarde ne peut pas être confirmée.');
  }
}
async function captureCarlAjax(page, base) {
  const bodies = new WeakMap();
  await page.route(`${base.origin}${base.pathname}**`, async route => {
    const request = route.request();
    if (request.method() !== 'POST' || request.isNavigationRequest()) return route.continue();
    const captured = (async () => {
      // Une seule transmission au serveur. Aucun retry ni suivi de redirection
      // par le client intermédiaire ; le navigateur les gère normalement.
      const upstream = await route.fetch({maxRetries:0,maxRedirects:0,timeout:30000});
      try {
        const body = await upstream.body();
        const text = body.toString('utf8');
        await route.fulfill({response:upstream,body});
        return text;
      } finally {await upstream.dispose();}
    })();
    bodies.set(request,captured);
    try {await captured;}
    catch {await route.abort('failed').catch(() => {});}
  });
  return response => bodies.get(response.request()) || response.text();
}
module.exports = {checkCarlResponse,captureCarlAjax};
