const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const BASE='https://app.local/';
let C=null,Q=null,pdfDoc=null,arabSize=34,currentList={title:'',entries:[],nav:'home'};
pdfjsLib.GlobalWorkerOptions.workerSrc=BASE+'vendor/pdf.worker.min.js';

const local=p=>BASE+String(p||'').replace(/^\/+/, '');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const icon=n=>{
 const common='viewBox="0 0 24 24" aria-hidden="true"';
 const p={
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z"/>',
  moon:'<path d="M20 15.5A8 8 0 1 1 8.5 4 6.5 6.5 0 0 0 20 15.5z"/>',
  beads:'<circle cx="12" cy="5" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="18" cy="15" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="6" cy="9" r="2"/><path d="M12 7v2M16.4 10l-1.7 1M16.4 14l-1.7-1M12 17v-2M7.6 14l1.7-1M7.6 10l1.7 1"/>',
  star:'<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  library:'<path d="M5 4h3v16H5zM10 4h3v16h-3zM15 5l3-.8L21.5 18l-3 .8z"/>',
  spark:'<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>'
 }[n]||'';
 return '<svg '+common+'>'+p+'</svg>';
};

function setHtml(x){$('#content').innerHTML=x;window.scrollTo(0,0)}
function setNav(n){$$('.mn-nav').forEach(x=>x.classList.toggle('active',x.dataset.nav===n))}
function bindGo(){$$('[data-go]').forEach(x=>x.onclick=()=>route(x.dataset.go))}
function sourceName(e){if(e.source==='baalwi')return 'BaAlwi';if(e.source==='khulasah')return 'Al-Khulasah';if(e.source==='rawindroid')return 'Maulid';return 'Bacaan Offline'}
function displayTitle(e){let t=String(e.title||'').trim();const m=t.match(/^Kitab\s+(\d{1,4})(?:_(?:in|id|en|ar))?$/i);return m?'Kitab Koleksi No. '+m[1]:t}
function allEntries(){let out=[];Object.entries(C.sources).forEach(([k,s])=>{if(k==='rawi_complete')return;out=out.concat(s.pdfs||[],s.html||[])});return out}
function keyword(keys){return allEntries().filter(e=>{const h=(e.title+' '+(e.sourcePath||'')).toLowerCase();return keys.some(k=>h.includes(k.toLowerCase()))})}

async function boot(){
 try{
  C=await fetch(local('catalog.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog '+r.status);return r.json()});
  Q=await fetch(local('quran/index.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('quran '+r.status);return r.json()});
  renderHome();
 }catch(e){setHtml('<div class="mn-empty"><h3>Data offline gagal dimuat</h3><p>'+esc(e.message)+'</p></div>')}
}

function menuCard(type,title,desc,go){
 return '<button class="mn-menu-card" data-go="'+go+'"><div class="mn-menu-icon">'+icon(type)+'</div><h3>'+title+'</h3><p>'+desc+'</p></button>';
}

function renderHome(){
 setNav('home');
 const total=allEntries().length;
 setHtml(
 '<section class="mn-hero">'+
   '<div class="mn-hero-kicker">MAJELIS TA\'LIM QIROATUL QUR\'AN</div>'+
   '<h1>Majelis<br>Mengaji</h1>'+
   '<div class="mn-quick">'+
     '<button data-go="quran">Al-Qur\'an</button>'+
     '<button data-go="tahlil">Yasin & Tahlil</button>'+
     '<button data-go="maulid">Maulid & Ratib</button>'+
   '</div>'+
   '<div class="mn-guidance">'+
     '<div class="mn-guidance-mark">م</div>'+
     '<small>DI BAWAH ASUHAN</small>'+
     '<strong>Alhabib Ahmad bin Alwi Alkaff<br><span style="color:#e7c55d;font-size:12px">dan</span><br>Habib Husein Al-Khered</strong>'+
   '</div>'+
 '</section>'+
 '<div class="mn-section-head"><h2>Menu Utama</h2><p>Pilih bacaan</p></div>'+
 '<div class="mn-menu-grid">'+
   menuCard('book','Al-Qur\'an','114 surah • Arab • Terjemahan','quran')+
   menuCard('moon','Surat Yasin','Bacaan Yasin lengkap','yasin')+
   menuCard('beads','Tahlil','Tahlil dan doa lengkap','tahlil')+
   menuCard('star','Simtud Duror','Maulid Simthud Duror','simtud')+
   menuCard('spark','Maulid & Ratib','Barzanji, Diba\', Burdah, Ratib','maulid')+
   menuCard('clock','Jadwal Sholat','Perhitungan Palembang offline','shalat')+
   menuCard('library','BaAlwi','Koleksi kitab lokal','baalwi')+
   menuCard('spark','Al-Khulasah','Dzikir, wirid dan doa','khulasah')+
 '</div>'+
 '<div class="mn-section-head"><h2 style="font-size:21px">Koleksi Offline</h2><p>Seluruh data tersimpan di APK</p></div>'+
 '<div class="mn-offline-stack">'+
   '<div class="mn-offline-card"><strong>'+Q.length+' Surah Al-Qur\'an</strong><span>Data lokal tanpa API</span></div>'+
   '<div class="mn-offline-card"><strong>'+C.sources.baalwi.pdfs.length+' Kitab BaAlwi</strong><span>PDF lokal</span></div>'+
   '<div class="mn-offline-card"><strong>'+C.sources.khulasah.pdfs.length+' Bacaan Al-Khulasah</strong><span>PDF lokal</span></div>'+
   '<div class="mn-offline-card"><strong>'+total+' Entri Bacaan</strong><span>Tidak memerlukan internet</span></div>'+
 '</div>'
 );
 bindGo();
}

function route(r){
 if(r==='home')return renderHome();
 if(r==='quran')return renderQuran();
 if(r==='yasin')return renderKeyword('Surat Yasin',['yasin','yaseen','يس'],'tahlil');
 if(r==='tahlil')return renderKeyword('Tahlil',['tahlil','تهليل'],'tahlil');
 if(r==='simtud'){
  const e=(C.sources.rawindroid?.html||[]).find(x=>x.title.toLowerCase().includes('simthud'));
  if(e){currentList={title:'Maulid & Ratib',entries:C.sources.rawindroid.html,nav:'simtud'};return openHtml(e)}
  return renderKeyword('Simtud Duror',['simt','simth','duror','durar','سمط','الدرر'],'simtud');
 }
 if(r==='maulid'){
  const exact=C.sources.rawindroid?.html||[];
  const other=keyword(['ratib','haddad','attas','مولد','راتب']).filter(x=>x.source!=='rawindroid');
  return renderList('Maulid & Ratib',[...exact,...other],'home');
 }
 if(r==='baalwi')return renderList('Koleksi BaAlwi',C.sources.baalwi.pdfs,'home');
 if(r==='khulasah')return renderList('Al-Khulasah',C.sources.khulasah.pdfs,'home');
 if(r==='shalat')return renderPrayer();
}

function renderKeyword(title,keys,nav){
 const entries=keyword(keys);
 entries.sort((a,b)=>(a.source==='rawindroid'?-1:0)-(b.source==='rawindroid'?-1:0));
 renderList(title,entries,nav);
}

function row(e){
 const ico=e.type==='html'?'star':'file';
 const meta=sourceName(e)+(e.lang?' • '+e.lang:'');
 return '<div class="mn-row" role="button" tabindex="0" data-open="'+encodeURIComponent(JSON.stringify(e))+'">'+
   '<div class="mn-row-icon">'+icon(ico)+'</div>'+
   '<div><div class="mn-row-title">'+esc(displayTitle(e))+'</div><div class="mn-row-meta">'+esc(meta)+'</div></div>'+
   '<div class="mn-chevron">›</div>'+
 '</div>';
}

function bindRows(){
 $$('[data-open]').forEach(el=>{
  el.onclick=()=>openEntry(JSON.parse(decodeURIComponent(el.dataset.open)));
  el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}};
 });
}

function renderList(title,entries,nav='home'){
 currentList={title,entries,nav};setNav(nav);
 setHtml(
  '<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(title)+'</h2></div>'+
  '<input class="mn-search" id="search" placeholder="Cari judul bacaan…">'+
  '<span class="mn-badge">'+entries.length+' bacaan offline</span>'+
  '<div class="mn-list" id="list"></div>'
 );
 $('#back').onclick=renderHome;
 const draw=()=>{
  const q=$('#search').value.toLowerCase().trim();
  const f=entries.filter(e=>(e.title+' '+(e.sourcePath||'')).toLowerCase().includes(q)).slice(0,900);
  $('#list').innerHTML=f.length?f.map(row).join(''):'<div class="mn-empty">Tidak ada hasil.</div>';
  bindRows();
 };
 $('#search').oninput=draw;draw();
}

function openEntry(e){return e.type==='html'?openHtml(e):openPdf(e)}

function openHtml(e){
 setHtml('<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(e.title)+'</h2></div><div class="mn-html-reader"><iframe id="rawframe" scrolling="no" src="'+local(e.path)+'"></iframe></div>');
 $('#back').onclick=()=>renderList(currentList.title,currentList.entries,currentList.nav);
 const f=$('#rawframe');
 const fit=()=>{try{const d=f.contentDocument;const h=Math.max(d.body?.scrollHeight||0,d.documentElement?.scrollHeight||0);if(h>0)f.style.height=(h+24)+'px'}catch(_){}};
 f.onload=()=>{fit();setTimeout(fit,250);setTimeout(fit,1000)};
}

async function openPdf(e){
 setHtml('<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(displayTitle(e))+'</h2></div><div class="mn-reader"><div id="pdfpages" class="mn-pdf-pages"><div class="mn-empty">Memuat kitab offline…</div></div></div>');
 $('#back').onclick=()=>renderList(currentList.title,currentList.entries,currentList.nav);
 try{
  pdfDoc=await pdfjsLib.getDocument({url:local(e.path),disableRange:true,disableStream:true}).promise;
  const holder=$('#pdfpages');holder.innerHTML='';
  for(let i=1;i<=pdfDoc.numPages;i++){
   const sec=document.createElement('section');sec.className='mn-pdf-page';sec.dataset.page=String(i);
   sec.innerHTML='<div class="mn-pageno">Halaman '+i+' / '+pdfDoc.numPages+'</div><canvas></canvas>';
   holder.appendChild(sec);
  }
  const renderPage=async sec=>{
   if(sec.dataset.rendered==='1'||sec.dataset.rendered==='loading')return;
   sec.dataset.rendered='loading';
   try{
    const p=await pdfDoc.getPage(Number(sec.dataset.page));
    const v=p.getViewport({scale:1.55});
    const c=sec.querySelector('canvas');c.width=Math.floor(v.width);c.height=Math.floor(v.height);
    await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;sec.dataset.rendered='1';
   }catch(_){sec.dataset.rendered='error';sec.innerHTML='<div class="mn-empty">Halaman gagal dimuat.</div>'}
  };
  const obs=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting)renderPage(x.target)}),{root:null,rootMargin:'900px 0px',threshold:.01});
  $$('.mn-pdf-page').forEach(sec=>obs.observe(sec));
  const first=$('.mn-pdf-page');if(first)renderPage(first);
 }catch(err){$('.mn-reader').innerHTML='<div class="mn-empty">Bacaan tidak dapat dimuat.<br>'+esc(err.message)+'</div>'}
}

function renderQuran(){
 setNav('quran');
 setHtml('<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>Al-Qur\'an</h2></div><input class="mn-search" id="search" placeholder="Cari surah…"><div class="mn-list mn-quran-list" id="qlist"></div>');
 $('#back').onclick=renderHome;
 const draw=()=>{
  const q=$('#search').value.toLowerCase();
  const f=Q.filter(s=>(s.name+' '+s.arabic+' '+s.meaning).toLowerCase().includes(q));
  $('#qlist').innerHTML=f.map(s=>'<div class="mn-row" role="button" tabindex="0" data-s="'+s.number+'"><div class="mn-surah-num">'+s.number+'</div><div><div class="mn-row-title">'+esc(s.name)+' — '+esc(s.arabic)+'</div><div class="mn-row-meta">'+esc(s.meaning)+' • '+s.ayah+' ayat</div></div><div class="mn-chevron">›</div></div>').join('');
  $$('[data-s]').forEach(el=>{el.onclick=()=>openSurah(+el.dataset.s);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}}});
 };
 $('#search').oninput=draw;draw();
}

async function openSurah(n){
 const s=await fetch(local('quran/'+n+'.json'),{cache:'no-store'}).then(r=>r.json());
 localStorage.setItem('lastSurah',n);
 setHtml(
  '<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(s.name)+'</h2><button class="mn-small" id="minus">A−</button><button class="mn-small" id="plus">A+</button></div>'+
  '<div class="mn-reader" id="surah">'+
  (s.verses||[]).map(v=>'<article class="mn-verse"><div class="mn-arabic" style="font-size:'+arabSize+'px">'+esc(v.text)+' <span class="mn-verse-num">'+v.number+'</span></div><div class="mn-translation">'+esc(v.translation_id||'')+'</div></article>').join('')+
  '</div>'
 );
 $('#back').onclick=renderQuran;
 $('#minus').onclick=()=>{arabSize=Math.max(24,arabSize-2);openSurah(n)};
 $('#plus').onclick=()=>{arabSize=Math.min(54,arabSize+2);openSurah(n)};
}

function renderPrayer(){
 setNav('home');
 const times=prayTimes(new Date());
 setHtml(
  '<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>Jadwal Sholat Palembang</h2></div>'+
  '<div class="mn-section-head" style="margin-top:6px"><h2 style="font-size:24px">Jadwal Hari Ini</h2><p>Dihitung langsung di HP, tanpa internet</p></div>'+
  '<div class="mn-prayer-list">'+Object.entries(times).map(([k,v])=>'<div class="mn-prayer"><b>'+k+'</b><span>'+v+'</span></div>').join('')+'</div>'
 );
 $('#back').onclick=renderHome;
}

function prayTimes(date){
 let lat=-2.99,lon=104.76,tz=7,N=Math.floor((date-Date.UTC(date.getUTCFullYear(),0,0))/86400000);
 let g=2*Math.PI/365*(N-1),eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 let dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const hm=x=>{x=(x+24)%24;let h=Math.floor(x),m=Math.round((x-h)*60);if(m===60){h=(h+1)%24;m=0}return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')};
 const ha=alt=>{let a=alt*Math.PI/180,phi=lat*Math.PI/180,c=(Math.sin(a)-Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec));c=Math.max(-1,Math.min(1,c));return Math.acos(c)*180/Math.PI/15};
 let noon=(720-4*lon-eq+tz*60)/60,f=ha(-20),sun=ha(-.833),isha=ha(-18),asr=ha(-Math.atan(1/(1+Math.tan(Math.abs(lat*Math.PI/180-dec))))*180/Math.PI);
 return{Imsak:hm(noon-f-.17),Subuh:hm(noon-f),Terbit:hm(noon-sun),Dzuhur:hm(noon+.03),Ashar:hm(noon+asr),Maghrib:hm(noon+sun),Isya:hm(noon+isha)};
}

document.addEventListener('click',e=>{const n=e.target.closest('.mn-nav');if(n)route(n.dataset.nav)});
$('#fontQuick').onclick=()=>{arabSize=arabSize>=44?30:arabSize+4};
$('#nightQuick').onclick=()=>document.documentElement.classList.toggle('mn-dark');
boot();