'use strict';
const http = require('node:http');
const {randomBytes} = require('node:crypto');

// Uniquement une projection locale du navigateur. Aucun identifiant n'est journalisé.
async function startLocalDisplay(page, browser, {port = 8765} = {}) {
  const token = randomBytes(24).toString('hex');
  const nonce = randomBytes(24).toString('hex');
  let origin;
  let capture = null;
  let actions = Promise.resolve();
  const server = http.createServer(async (req, res) => {
    const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':`default-src 'none'; img-src 'self'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`};
    const send = (status, type, body) => { res.writeHead(status, {...headers, 'Content-Type':type}); res.end(body); };
    try {
      const url = new URL(req.url, origin);
      if (req.headers.host !== new URL(origin).host || url.searchParams.get('t') !== token) {
        return send(403, 'text/plain; charset=utf-8', 'Accès local non autorisé. Utilisez le lien affiché dans le terminal.');
      }
      if (req.method === 'GET' && url.pathname === '/') {
        return send(200, 'text/html; charset=utf-8', html(token, nonce));
      }
      if (req.method === 'GET' && url.pathname === '/image') {
        if (!capture) capture = page.screenshot({type:'jpeg', quality:70,timeout:5000}).finally(() => {capture=null;});
        return send(200, 'image/jpeg', await capture);
      }
      if (req.method === 'POST' && url.pathname === '/action') {
        if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') {
          return send(403, 'text/plain', 'Origine refusée.');
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16384) return send(413, 'text/plain', 'Requête trop grande.');
        }
        const input = JSON.parse(body);
        const perform = async () => {
          if (input.kind === 'click' && Number.isFinite(input.x) && Number.isFinite(input.y) &&
              input.x >= 0 && input.x < 1280 && input.y >= 0 && input.y < 900) {
            await page.mouse.click(input.x, input.y);
          } else if (input.kind === 'text' && typeof input.text === 'string' && input.text.length <= 8000) {
            await page.keyboard.insertText(input.text);
          } else if (input.kind === 'key' && /^(?:Shift\+Tab|Control\+a|Enter|Tab|Backspace|Delete|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(input.key)) {
            await page.keyboard.press(input.key);
          } else if (input.kind === 'scroll' && Number.isFinite(input.delta)) {
            await page.mouse.wheel(0, Math.max(-1500, Math.min(1500, input.delta)));
          } else if (input.kind === 'stop') {
            setTimeout(() => browser.close().catch(() => {}), 100);
          } else throw new Error('Action non reconnue.');
        };
        actions = actions.catch(() => {}).then(perform);
        await actions;
        return send(200, 'application/json', '{"ok":true}');
      }
      send(404, 'text/plain', 'Introuvable.');
    } catch {
      if (!res.headersSent) send(503, 'text/plain; charset=utf-8', 'Navigateur en cours de chargement ou fermé.');
      else res.end();
    }
  });
  // Un port occupé n'entraîne jamais l'arrêt d'un autre service.
  for (let attempt=0; attempt<10; attempt++) {
    try {
      await new Promise((resolve,reject) => {
        const fail = error => {server.off('listening',done); reject(error);};
        const done = () => {server.off('error',fail); resolve();};
        server.once('error',fail); server.once('listening',done);
        server.listen(port+attempt, '127.0.0.1');
      });
      origin = `http://127.0.0.1:${server.address().port}`;
      const close = () => {server.close(); server.closeAllConnections();};
      browser.once('disconnected', close);
      return {url:`${origin}/?t=${token}`,close};
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || attempt === 9) throw error;
    }
  }
}
function html(token, nonce) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>CARL — Affichage local WSL</title><style>
body{margin:0;background:#eef0f5;color:#18243a;font:15px system-ui}header{background:white;padding:14px 24px;display:flex;align-items:center;gap:20px;box-shadow:0 1px 5px #ccd}h1{font-size:18px;margin:0}header p{margin:0;flex:1}button{padding:10px 14px;border:1px solid #393091;border-radius:5px;background:white;color:#393091;cursor:pointer}main{margin:16px auto;max-width:1280px}#screen{outline:none;box-shadow:0 3px 20px #ccd;background:white}#screen:focus{box-shadow:0 0 0 3px #7063db}img{display:block;width:100%;height:auto;user-select:none}#status{padding:8px 0;font-size:13px}aside{padding:10px 24px;background:#e1ddff} .error{color:#a12424}
</style><header><h1>CARL · navigateur WSL</h1><p>Connectez-vous dans l'écran ci-dessous. L'automatisation reprendra après connexion.</p><button id="stop">Fermer le programme</button></header>
<aside>Cliquez dans un champ, puis tapez. Tab, Entrée et Ctrl+V fonctionnent. Cet affichage reste sur votre poste.</aside>
<main><div id="status">Chargement de CARL…</div><div id="screen" tabindex="0" role="group" aria-label="Écran interactif du navigateur CARL"><img id="image" alt="Écran du navigateur CARL exécuté dans WSL" draggable="false"></div></main>
<script nonce="${nonce}">
const token=${JSON.stringify(token)},img=document.getElementById('image'),screen=document.getElementById('screen'),status=document.getElementById('status');
let stopped=false,pending=Promise.resolve();
function action(data){pending=pending.catch(()=>{}).then(async()=>{const r=await fetch('/action?t='+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error('Action impossible');});pending.catch(()=>{status.textContent='Connexion au navigateur interrompue.';});return pending;}
function refresh(){if(!stopped)img.src='/image?t='+token+'&n='+Date.now();}
img.onload=()=>{status.textContent='Affichage connecté — cliquez dans CARL pour interagir.';status.className='';setTimeout(refresh,700);};
img.onerror=()=>{if(!stopped){status.textContent='En attente du navigateur…';status.className='error';setTimeout(refresh,1500);}};
img.addEventListener('click',e=>{screen.focus({preventScroll:true});const r=img.getBoundingClientRect();action({kind:'click',x:Math.floor((e.clientX-r.left)*1280/r.width),y:Math.floor((e.clientY-r.top)*900/r.height)});});
screen.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='a'){e.preventDefault();action({kind:'key',key:'Control+a'});}return;}
if(e.key.length===1&&!e.altKey){e.preventDefault();action({kind:'text',text:e.key});}else if(['Enter','Tab','Backspace','Delete','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){e.preventDefault();action({kind:'key',key:e.key==='Tab'&&e.shiftKey?'Shift+Tab':e.key});}});
screen.addEventListener('paste',e=>{e.preventDefault();action({kind:'text',text:e.clipboardData.getData('text')});});
screen.addEventListener('wheel',e=>{e.preventDefault();action({kind:'scroll',delta:e.deltaY});},{passive:false});
document.getElementById('stop').onclick=async()=>{stopped=true;await action({kind:'stop'});status.textContent='Programme fermé. Vous pouvez fermer cet onglet.';};refresh();
</script></html>`;
}
module.exports = {startLocalDisplay};
