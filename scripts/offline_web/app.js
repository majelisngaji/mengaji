
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const base='https://app.local/';
let C=null,Q=null,pdfDoc=null,pageNum=1,pdfScale=1.35,currentListTitle='',currentListEntries=[],arabSize=32;
pdfjsLib.GlobalWorkerOptions.workerSrc=base+'vendor/pdf.worker.min.js';
function local(p){return base+String(p||'').replace(/^\/+/,'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shell(x){$('#content').innerHTML=x;window.scrollTo(0,0)}
function active(n){$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.nav===n))}
function card(i,t,p,g){return `<div class="card click" data-go="${g}"><div class="icon">${i}</div><h3>${t}</h3><p>${p}</p></div>`}
async function boot(){
 try{
  C=await fetch(local('catalog.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog '+r.status);return r.json()});
  Q=await fetch(local('quran/index.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('quran '+r.status);return r.json()});
  renderHome();
 }catch(e){shell(`<div class="empty"><h2>Data offline gagal dibaca</h2><p>${esc(e.message)}</p></div>`)}
}
function totals(){let p=0,a=0,h=0;Object.values(C.sources).forEach(s=>{p+=s.pdfs.length;a+=s.audios.length;h+=s.html.length});return{p,a,h}}
function bindCards(){$$('.card.click').forEach(e=>e.onclick=()=>route(e.dataset.go))}
function renderHome(){
 active('home');let x=totals();
 shell(`<div class="hero"><h1>Majelis Ta'lim Anwarul Habib</h1><p>Majelis Mengaji — seluruh data yang tampil disimpan di dalam APK.</p><span class="badge">100% OFFLINE • TANPA API • TANPA SINKRONISASI</span><div class="stat"><span class="pill">${Q.length} surah</span><span class="pill">${x.p} PDF</span><span class="pill">${x.a} audio lokal</span><span class="pill">${x.h} bacaan HTML</span></div></div>
 <div class="section">Bacaan Utama</div><div class="grid">
 ${card('📖','Al-Qur’an','114 surah Arab + terjemahan Indonesia','quran')}
 ${card('🌙','Maulid','Rawindroid dan koleksi maulid lokal','maulid')}
 ${card('🤲','Yasin & Tahlil','Pencarian otomatis dari koleksi lokal','yasin')}
 ${card('🕌','Ratib Al-Haddad','Bacaan lokal dari koleksi kitab','haddad')}
 ${card('📿','Ratib Al-Attas','Bacaan lokal dari koleksi kitab','attas')}
 ${card('📚','BaAlwi','PDF dan audio BaAlwi yang tertanam','baalwi')}
 ${card('✨','Al-Khulasah','Dzikir, wirid, doa dan bacaan lokal','khulasah')}
 ${card('🎧','Audio Offline','Putar file audio yang benar-benar lokal','audio')}
 </div>`);
 bindCards()
}
function route(r){
 if(r==='home')return renderHome();
 if(r==='quran')return renderQuran();
 if(r==='maulid')return renderKeyword('Maulid',['maulid','rawi','barzan','diba','simt','burd','dhiy','ضياء','مولد'],true);
 if(r==='yasin')return renderKeyword('Yasin & Tahlil',['yasin','yaseen','tahlil','يس']);
 if(r==='haddad')return renderKeyword('Ratib Al-Haddad',['haddad','حداد']);
 if(r==='attas')return renderKeyword('Ratib Al-Attas',['attas','عطاس']);
 if(r==='baalwi')return renderSource('baalwi','BaAlwi');
 if(r==='khulasah')return renderSource('khulasah','Al-Khulasah');
 if(r==='audio')return renderAudio();
 if(r==='kajian')return renderKajian();
 if(r==='donasi')return renderDonasi()
}
function allEntries(){let o=[];Object.values(C.sources).forEach(s=>o=o.concat(s.pdfs,s.html));return o}
function renderKeyword(title,keys,raw=false){
 let e=allEntries().filter(v=>{let t=(v.title+' '+(v.sourcePath||'')).toLowerCase();return (raw&&v.source==='rawindroid')||keys.some(k=>t.includes(k.toLowerCase()))});
 renderList(title,e,title==='Maulid'?'maulid':'home')
}
function renderSource(src,title){renderList(title,[...C.sources[src].pdfs,...C.sources[src].html],'kajian')}
function row(e){let icon=e.type==='pdf'?'📄':'📖';return `<div class="item"><div>${icon}</div><div class="grow"><div class="t">${esc(e.title)}</div><div class="m">${esc((e.source||'').toUpperCase())} • ${esc(e.type.toUpperCase())}</div></div><button class="btn" data-open="${encodeURIComponent(JSON.stringify(e))}">Buka</button></div>`}
function renderList(title,entries,nav='kajian'){
 currentListTitle=title;currentListEntries=entries;active(nav);
 shell(`<div class="toolbar"><button class="btn alt" id="back">←</button><div class="title">${esc(title)}</div></div><input class="search" id="search" placeholder="Cari judul bacaan…"><div class="stat"><span class="pill">${entries.length} bacaan offline</span></div><div class="list" id="list"></div>`);
 $('#back').onclick=renderHome;
 function draw(){let q=$('#search').value.toLowerCase().trim();let f=entries.filter(e=>(e.title+' '+(e.sourcePath||'')).toLowerCase().includes(q)).slice(0,900);$('#list').innerHTML=f.length?f.map(row).join(''):'<div class="empty">Tidak ada hasil.</div>';$$('[data-open]').forEach(b=>b.onclick=()=>openEntry(JSON.parse(decodeURIComponent(b.dataset.open))))}
 $('#search').oninput=draw;draw()
}
function openEntry(e){e.type==='pdf'?openPdf(e):openHtml(e)}
async function openPdf(e){
 shell(`<div class="toolbar"><button class="btn alt" id="back">←</button><div class="title">${esc(e.title)}</div><button class="btn alt" id="minus">A−</button><button class="btn alt" id="plus">A+</button></div><div class="reader"><div class="pdfwrap"><canvas id="pdfc"></canvas></div><div class="toolbar"><button class="btn alt" id="prev">← Hal</button><div class="title" id="pageinfo">Memuat…</div><button class="btn alt" id="next">Hal →</button></div></div>`);
 $('#back').onclick=()=>renderList(currentListTitle,currentListEntries);$('#minus').onclick=()=>{pdfScale=Math.max(.7,pdfScale-.2);renderPdfPage()};$('#plus').onclick=()=>{pdfScale=Math.min(3,pdfScale+.2);renderPdfPage()};
 try{
  pdfDoc=await pdfjsLib.getDocument({url:local(e.path),disableRange:true,disableStream:true,disableAutoFetch:false}).promise;pageNum=1;await renderPdfPage();
  $('#prev').onclick=()=>{if(pageNum>1){pageNum--;renderPdfPage()}};
  $('#next').onclick=()=>{if(pageNum<pdfDoc.numPages){pageNum++;renderPdfPage()}};
  setupSwipe($('#pdfc'),()=>$('#next').click(),()=>$('#prev').click())
 }catch(err){$('.reader').innerHTML=`<div class="empty"><h3>PDF tidak dapat dibuka</h3><p>${esc(err.message)}</p></div>`}
}
async function renderPdfPage(){let p=await pdfDoc.getPage(pageNum),v=p.getViewport({scale:pdfScale}),c=$('#pdfc'),ctx=c.getContext('2d');c.width=v.width;c.height=v.height;await p.render({canvasContext:ctx,viewport:v}).promise;$('#pageinfo').textContent=`${pageNum} / ${pdfDoc.numPages}`}
function openHtml(e){shell(`<div class="toolbar"><button class="btn alt" id="back">←</button><div class="title">${esc(e.title)}</div></div><iframe src="${local(e.path)}"></iframe>`);$('#back').onclick=()=>renderList(currentListTitle,currentListEntries)}
function renderQuran(){
 active('quran');shell(`<div class="toolbar"><button class="btn alt" id="back">←</button><div class="title">Al-Qur’an Offline</div></div><input class="search" id="search" placeholder="Cari nama surah…"><div class="list" id="qlist"></div>`);$('#back').onclick=renderHome;
 function draw(){let q=$('#search').value.toLowerCase();let f=Q.filter(s=>(s.name+' '+s.arabic+' '+s.meaning).toLowerCase().includes(q));$('#qlist').innerHTML=f.map(s=>`<div class="item"><div class="num">${s.number}</div><div class="grow"><div class="t">${esc(s.name)} — ${esc(s.arabic)}</div><div class="m">${esc(s.meaning)} • ${s.ayah} ayat</div></div><button class="btn" data-s="${s.number}">Baca</button></div>`).join('');$$('[data-s]').forEach(b=>b.onclick=()=>openSurah(+b.dataset.s))}
 $('#search').oninput=draw;draw()
}
async function openSurah(n){
 let s=await fetch(local('quran/'+n+'.json'),{cache:'no-store'}).then(r=>r.json());localStorage.setItem('lastSurah',n);
 shell(`<div class="toolbar"><button class="btn alt" id="back">←</button><div class="title">${esc(s.name)} — ${esc((s.name_translations||{}).ar||'')}</div><button class="btn alt" id="minus">A−</button><button class="btn alt" id="plus">A+</button></div><div class="reader" id="surah">${(s.verses||[]).map(v=>`<div class="ayah"><div class="arab" style="font-size:${arabSize}px">${esc(v.text)} <span class="num">${v.number}</span></div><div class="trans">${esc(v.translation_id||'')}</div></div>`).join('')}</div><div class="toolbar"><button class="btn alt" id="prev">← Surah</button><div class="title">${n} / 114</div><button class="btn alt" id="next">Surah →</button></div>`);
 $('#back').onclick=renderQuran;$('#minus').onclick=()=>{arabSize=Math.max(22,arabSize-2);openSurah(n)};$('#plus').onclick=()=>{arabSize=Math.min(52,arabSize+2);openSurah(n)};$('#prev').onclick=()=>{if(n>1)openSurah(n-1)};$('#next').onclick=()=>{if(n<114)openSurah(n+1)};setupSwipe($('#surah'),()=>$('#next').click(),()=>$('#prev').click())
}
function renderAudio(){
 active('kajian');let e=[];Object.values(C.sources).forEach(s=>e=e.concat(s.audios));
 shell(`<div class="toolbar"><button class="btn alt" id="back">←</button><div class="title">Audio Offline</div></div><input class="search" id="search" placeholder="Cari audio…"><div class="stat"><span class="pill">${e.length} audio lokal</span></div><div class="list" id="alist"></div>`);$('#back').onclick=renderHome;
 function draw(){let q=$('#search').value.toLowerCase();let f=e.filter(v=>v.title.toLowerCase().includes(q)).slice(0,600);$('#alist').innerHTML=f.length?f.map(v=>`<div class="item"><div>🎧</div><div class="grow"><div class="t">${esc(v.title)}</div><div class="m">${esc(v.source.toUpperCase())}</div><audio controls preload="none"><source src="${local(v.path)}"></audio></div></div>`).join(''):'<div class="empty">Tidak ada audio lokal pada sumber.</div>'}
 $('#search').oninput=draw;draw()
}
function renderKajian(){active('kajian');shell(`<div class="section">Koleksi Kajian & Kitab</div><div class="grid">${card('📚','BaAlwi','Koleksi kitab dan audio lokal','baalwi')}${card('✨','Al-Khulasah','Dzikir, wirid dan doa lokal','khulasah')}${card('🎧','Audio Offline','File suara yang tertanam','audio')}</div>`);bindCards()}
function renderDonasi(){active('donasi');shell(`<div class="card"><div class="icon">🤍</div><h3>Donasi</h3><p>Versi APK offline ini tidak membuka situs, formulir, tracker, atau transaksi internet. Informasi donasi dapat ditambahkan sebagai data lokal pada revisi berikutnya.</p></div>`)}
function setupSwipe(el,onLeft,onRight){let x=0,y=0;el.addEventListener('touchstart',e=>{x=e.touches[0].clientX;y=e.touches[0].clientY},{passive:true});el.addEventListener('touchend',e=>{let dx=e.changedTouches[0].clientX-x,dy=e.changedTouches[0].clientY-y;if(Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)*1.2){dx<0?onLeft():onRight()}},{passive:true})}
document.addEventListener('click',e=>{let n=e.target.closest('.nav');if(n)route(n.dataset.nav)});
boot();
