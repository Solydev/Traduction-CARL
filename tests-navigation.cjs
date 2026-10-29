'use strict';
// Intégration sur un faux serveur local, sans connexion à CARL ni identifiants.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {captureCarlAjax,checkCarlResponse} = require('./reseau.cjs');
const {waitForLanguageTransition} = require('./langues.cjs');
const {refreshAndWait}=require('./attentes.cjs');
const {saveAndVerify}=require('./core.cjs');
const {readFields,fillWidgetField}=require('./champs.cjs');
const {PROFILE_LIST_SELECTOR,waitForProfileList,waitForWidgetReady,waitForPager}=require('./ecrans.cjs');
function playwright() {
  try {return require('playwright');}
  catch {return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
}
function editableRowsFixture(family,alter='',realIds=false){
  const favorite=family==='FAVORITEROW',code=favorite?'form':'funct';
  const suffix=favorite?'da_ConfigFavPortlet_Favorites_Formdescription':'da_ConfigRepPortlet_Reports_Formdescription';
  const rows=[1,2].map(i=>`<tr><td><span title="[${family}.component]">${i}</span></td>
    <td><span id="${realIds?'table:'+i+':'+suffix:'label'+i}" title="[${family}.label]">Libellé ${i}</span></td>
    <td><span title="[${family}.${code}]">${favorite?'Document_SEL':'BUDGACC'}</span></td>
    <td><span title="[${family}.${favorite?'customForm':'report'}]">${favorite?'':'BUDGACC_REPORT'}</span></td></tr>`).join('');
  return `<div role="dialog"><table>${rows}</table></div><script>
    for(const label of document.querySelectorAll('span[title="[${family}.label]"]'))label.onclick=()=>{
      const row=label.closest('tr'),text=label.textContent,id=label.id,component=row.firstElementChild.textContent;
      setTimeout(()=>{
        row.innerHTML='<td><input title="[${family}.component]" value="'+component+'"></td>'+
          '<td><input type="text" maxlength="60" id="'+id+'" title="[${family}.label]" value="'+text+'"></td>'+
          '<td><span title="[${family}.${code}]"><input title="[${family}.${code}]" value="${favorite?'Document_SEL':'BUDGACC'}"></span>'+
          '<button title="[${family}.${code}]">Rechercher</button></td>'+
          '<td>${favorite?'':'<input title="[REPORTROW.report]" value="BUDGACC_REPORT">'}</td>';
        ${alter}
      },120);
    };
  </script>`;
}
for(const family of ['FAVORITEROW','REPORTROW'])test(`Chrome : deux lignes ${family} restent identifiables du texte à la saisie`,async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.setContent(editableRowsFixture(family));
    const dialog=page.getByRole('dialog'),initial=await readFields(dialog);
    assert.equal(initial.length,2);
    const post=async action=>action();
    for(const field of initial)await fillWidgetField({field,desired:'Traduit '+field.id,dialog,post,byId:id=>page.locator('[id="'+id+'"]')});
    const final=await readFields(dialog);
    assert.deepEqual(final.map(f=>f.rowKey),initial.map(f=>f.rowKey));
    assert.deepEqual(final.map(f=>f.text),['Traduit label1','Traduit label2']);
  }finally{await browser.close();}
});
for(const family of ['FAVORITEROW','REPORTROW'])test(`Chrome : ${family} reste lisible sans type ou infobulle HTML après activation`,async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    for(const attributes of [['type'],['title'],['type','title']]){
      const alter=`for(const attr of ${JSON.stringify(attributes)})row.children[1].querySelector('input').removeAttribute(attr);`;
      await page.setContent(editableRowsFixture(family,alter,true));
      const dialog=page.getByRole('dialog'),initial=await readFields(dialog);
      assert.equal(initial.length,2);
      for(const field of initial)await fillWidgetField({field,desired:'Traduction '+family,dialog,post:action=>action(),byId:id=>page.locator('[id="'+id+'"]')});
      const final=await readFields(dialog);
      assert.equal(final.length,2);
      assert.deepEqual(final.map(f=>f.rowKey),initial.map(f=>f.rowKey));
      assert.ok(final.every(f=>f.text==='Traduction '+family));
    }
  }finally{await browser.close();}
});
test('Chrome : un widget complet accepte les attributs HTML absents sur ses champs',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<div role="dialog"><input title="[FAVORITEPORTLETANIMATOR.configTitle]" value="Favoris"><button id="defaultButton">OK</button><button id="button-0">Annuler</button><span id="x:s-stbLines">de 1 à 1 sur 1</span><input id="x:da_ConfigFavPortlet_Favorites_Formdescription" value="Traduit"></div>');
    await waitForWidgetReady(page,2000);
  }finally{await browser.close();}
});
test('Chrome : une vraie modification du code ou du texte bloque avant remplissage',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    for(const alter of [
      'row.querySelector(\'input[title="[FAVORITEROW.form]"]\').value="AUTRE_FORMULAIRE";',
      'row.querySelector(\'input[id^="label"]\').value="Texte concurrent";'
    ]){
      await page.setContent(editableRowsFixture('FAVORITEROW',alter));
      const dialog=page.getByRole('dialog'),field=(await readFields(dialog))[0];
      await assert.rejects(fillWidgetField({field,desired:'INTERDIT',dialog,post:action=>action(),byId:id=>page.locator('[id="'+id+'"]')}),
        error=>/La ligne a changé/.test(error.message)&&!!error.details.live);
      assert.notEqual(await page.locator('#label1').inputValue(),'INTERDIT');
    }
  }finally{await browser.close();}
});
test('Chrome : deux codes non vides contradictoires ne sont jamais fusionnés',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.setContent(editableRowsFixture('FAVORITEROW'));
    await page.locator('tr').first().evaluate(row=>{
      const code=document.createElement('input');code.title='[FAVORITEROW.form]';code.value='AUTRE';row.lastElementChild.append(code);
    });
    await assert.rejects(readFields(page.getByRole('dialog')),/Codes contradictoires/);
  }finally{await browser.close();}
});
test('Chrome : réponse AJAX contrôlée après navigation et une seule transmission POST',async()=>{
  let posts=0;
  const server=http.createServer((req,res)=>{
    if(req.method==='POST'){
      posts++;
      if(req.url==='/gmao/form'){res.writeHead(302,{Location:'/gmao/done'});return res.end();}
      res.writeHead(200,{'Content-Type':'text/xml'});
      return res.end('<partial-response><redirect url="/gmao/done"/></partial-response>');
    }
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end('<button id="ajax" onclick="fetch(\'/gmao/ajax\',{method:\'POST\',body:\'javax.faces.partial.ajax=true\'}).then(r=>r.text()).then(()=>location=\'/gmao/done\')">AJAX fictif</button><form method="POST" action="/gmao/form"><button id="form">Navigation fictive</button></form>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await playwright().chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage();
    await page.goto(origin+'/gmao/');
    const readBody=await captureCarlAjax(page,new URL(origin+'/gmao/'));
    const ajax=page.waitForResponse(r=>r.request().method()==='POST');
    await page.locator('#ajax').click();
    const response=await ajax;
    await page.waitForURL(origin+'/gmao/done');
    const facade={finished:()=>response.finished(),status:()=>response.status(),headers:()=>response.headers(),request:()=>response.request(),
      text:async()=>{throw Error('Network.getResponseBody: No resource with given identifier found');}};
    await checkCarlResponse(facade,readBody);
    assert.equal(posts,1);
    const navigation=page.waitForResponse(r=>r.request().method()==='POST');
    await page.locator('#form').click();
    await checkCarlResponse(await navigation,readBody);
    await page.waitForURL(origin+'/gmao/done');
    assert.equal(posts,2);
  }finally{
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
});
function languageFixture(script) {
  return `<div id="user-detail-lang-dropdown-button">Français, France</div>
    <input id="dashboard_DET:da_Dashboard_Code" value="BUYER">
    <form id="ignore-tpl-switch-lang"><script type="application/json">{"locale":"fr_FR"}</script></form>
    <script>${script}</script>`;
}
const languageOptions={target:'en_GB',screenId:'dashboard_DET:da_Dashboard_Code',screenValue:'BUYER'};

for(const mode of ['navigation','remplacement AJAX'])test(`Chrome : correction, sauvegarde puis ${mode} retardé, sans répéter les écritures`,async()=>{
  let saves=0,refreshes=0,saved='Ancien titre';
  const document=description=>languageFixture('')+`<input id="description" value="${description}">`;
  const server=http.createServer((req,res)=>{
    if(req.method==='POST'){
      if(req.url==='/save'){saves++;saved='Titre corrigé';}
      else if(req.url==='/refresh')refreshes++;
      res.writeHead(200,{'Content-Type':'text/plain'});return res.end(saved);
    }
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(document(req.url==='/saved'?saved:'Ancien titre'));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await playwright().chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage();
    await page.goto(origin);
    const expected={description:'Titre corrigé',widgets:[]};
    let ready=0;
    await saveAndVerify({expected,locale:'fr_FR',
      save:()=>page.evaluate(()=>fetch('/save',{method:'POST'}).then(r=>r.text())),
      refresh:()=>refreshAndWait(page,{
        anchor:page.locator('#description'),timeout:4000,
        action:()=>page.evaluate(async mode=>{
          const text=await fetch('/refresh',{method:'POST'}).then(r=>r.text());
          setTimeout(()=>{
            if(mode==='navigation')location='/saved';
            else {const e=document.getElementById('description'),n=e.cloneNode();n.value=text;e.replaceWith(n);}
          },350);
        },mode),
        ready:async()=>{
          await waitForLanguageTransition(page,{target:'fr_FR',screenId:'dashboard_DET:da_Dashboard_Code',screenValue:'BUYER'},4000);
          ready++;
        }
      }),
      read:async()=>({description:await page.locator('#description').inputValue(),widgets:[]})
    });
    assert.equal(saves,1);assert.equal(refreshes,1);assert.equal(ready,1);
  }finally{
    await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});

test('Chrome : un rafraîchissement sans remplacement échoue sans rejouer le clic',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();await page.setContent('<input id="description">');
    let clicks=0,reads=0;
    await assert.rejects(refreshAndWait(page,{anchor:page.locator('#description'),
      action:async()=>{clicks++;},ready:async()=>{reads++;},timeout:250}),/Timeout/);
    assert.equal(clicks,1);assert.equal(reads,0);
  }finally{await browser.close();}
});
test('Chrome : attendre la langue après une page intermédiaire sans code de langue',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(languageFixture(`
      document.getElementById('ignore-tpl-switch-lang').innerHTML='';
      document.getElementById('dashboard_DET:da_Dashboard_Code').style.display='none';
      setTimeout(()=>{
        document.getElementById('ignore-tpl-switch-lang').innerHTML='<script type="application/json">{"locale":"en_GB"}<'+'/script>';
        document.getElementById('user-detail-lang-dropdown-button').textContent='English, United Kingdom';
        document.getElementById('dashboard_DET:da_Dashboard_Code').style.display='';
      },350);
    `));
    assert.deepEqual(await waitForLanguageTransition(page,languageOptions,3000),{kind:'ready',locale:'en_GB'});
  } finally {await browser.close();}
});
test('Chrome : une confirmation tardive est détectée puis la langue finale est attendue',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(languageFixture(`
      setTimeout(()=>{
        const dialog=document.createElement('div');dialog.setAttribute('role','dialog');
        dialog.innerHTML='Le changement de langue ne sera effectif que sur cette page.<button id="confirm">Valider</button>';
        document.body.append(dialog);
        document.getElementById('confirm').onclick=()=>{dialog.remove();setTimeout(()=>{
          document.querySelector('#ignore-tpl-switch-lang script').textContent='{"locale":"en_GB"}';
          document.getElementById('user-detail-lang-dropdown-button').textContent='English, United Kingdom';
        },250);};
      },200);
    `));
    assert.equal((await waitForLanguageTransition(page,languageOptions,3000)).kind,'dialog');
    await page.locator('#confirm').click();
    assert.deepEqual(await waitForLanguageTransition(page,languageOptions,3000),{kind:'ready',locale:'en_GB'});
  } finally {await browser.close();}
});
test('Chrome : un mauvais profil ou une mauvaise langue ne sont jamais confirmés',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(languageFixture(`document.querySelector('#ignore-tpl-switch-lang script').textContent='{"locale":"en_GB"}';
      document.getElementById('dashboard_DET:da_Dashboard_Code').value='CFO';`));
    await assert.rejects(waitForLanguageTransition(page,languageOptions,300),/Timeout/);
    await page.setContent(languageFixture(''));
    await assert.rejects(waitForLanguageTransition(page,languageOptions,300),/Timeout/);
  } finally {await browser.close();}
});
test('Chrome : attendre le retour à une liste dont le conteneur et les lignes arrivent tardivement',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent(`<input id="dashboard_DET:da_Dashboard_Code" value="BUYER"><button id="back">Retour</button><script>
      document.getElementById('back').onclick=()=>{
        document.getElementById('dashboard_DET:da_Dashboard_Code').remove();
        setTimeout(()=>{
          const root=document.createElement('div');root.id='dashboard_SEL:cs_999:tb_Dashboard_SEL_result';
          root.innerHTML='<span id="result:s-stbLines">de 1 à 2 sur 2</span>';
          document.body.append(root);
          setTimeout(()=>{root.innerHTML+='<a id="result:0:0:cl_Dashboard_Code">BUYER</a><a id="result:1:1:cl_Dashboard_Code">  BUYER_LABO  </a>';},250);
        },200);
      };
    </script>`);
    await page.locator('#back').click();
    const state=await waitForProfileList(page,3000);
    assert.deepEqual(state.items,['BUYER','BUYER_LABO']);
    assert.equal(state.rootId,'dashboard_SEL:cs_999:tb_Dashboard_SEL_result');
    assert.equal(await page.locator(PROFILE_LIST_SELECTOR).locator('a[id$=":cl_Dashboard_Code"]')
      .filter({hasText:/^\s*BUYER_LABO\s*$/}).count(),1);
  }finally{await browser.close();}
});
test('Chrome : ne pas accepter une liste partiellement chargée ou encore cachée',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<div id="dashboard_SEL:cs_1:tb_Dashboard_SEL_result"><span id="result:s-stbLines">de 1 à 2 sur 2</span><a id="result:0:0:cl_Dashboard_Code">BUYER</a></div>');
    await assert.rejects(waitForProfileList(page,300),/Timeout/);
    await page.setContent('<div style="display:none" id="dashboard_SEL:cs_1:tb_Dashboard_SEL_result"><span id="result:s-stbLines">de 1 à 1 sur 1</span><a id="result:0:0:cl_Dashboard_Code">BUYER_LABO</a></div>');
    await assert.rejects(waitForProfileList(page,300),/Timeout/);
  }finally{await browser.close();}
});
test('Chrome : le widget reste ouvert jusqu’à la disponibilité de toutes ses lignes',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent(`<div role="dialog"><input type="text" title="[FAVORITEPORTLETANIMATOR.configTitle]" value="Favoris"><button id="defaultButton">Valider</button><button id="button-0">Annuler</button><div id="rows"></div></div><script>
      const rows=document.getElementById('rows');
      setTimeout(()=>{
        rows.innerHTML='<span id="favorites:s-stbLines">de 1 à 7 sur 7</span>';
        for(let i=0;i<3;i++)rows.innerHTML+='<span id="label'+i+'" title="[FAVORITEROW.label]">Libellé '+i+'</span>';
        setTimeout(()=>{for(let i=3;i<7;i++)rows.innerHTML+='<span id="label'+i+'" title="[FAVORITEROW.label]">Libellé '+i+'</span>';},250);
      },200);
      document.getElementById('button-0').onclick=()=>document.querySelector('[role="dialog"]').remove();
    </script>`);
    await waitForWidgetReady(page,3000);
    const values=await page.locator('span[title="[FAVORITEROW.label]"]').allTextContents();
    assert.equal(values.length,7);
    assert.equal(await page.getByRole('dialog').count(),1);
    await page.locator('[id="button-0"]').click();
    assert.equal(await page.getByRole('dialog').count(),0);
  }finally{await browser.close();}
});
test('Chrome : la pagination attend son nouveau numéro après une mise à jour retardée',async()=>{
  const browser=await playwright().chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<span id="result:s-stbLines">de 1 à 25 sur 30</span><script>setTimeout(()=>document.getElementById("result:s-stbLines").textContent="de 26 à 30 sur 30",250)</script>');
    assert.deepEqual(await waitForPager(page,{id:'result:s-stbLines',after:1},3000),[26,30,30]);
  }finally{await browser.close();}
});
