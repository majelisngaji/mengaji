const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const BASE=(location.hostname==='app.local'&&location.protocol==='https:')?'https://app.local/':(location.origin.replace(/\/$/,'')+'/');
let C=null,Q=null,pdfDoc=null,arabSize=34,currentList={title:'',entries:[],nav:'home'};
let nativeBackAction=null;
window.handleNativeBack=()=>{
  if(typeof nativeBackAction==='function'){nativeBackAction();return true;}
  if(typeof renderHome==='function'){renderHome();return true;}
  return false;
};
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
function sourceName(e){if(e.source==='baalwi')return 'BaAlwi';if(e.source==='khulasah')return 'Al-Khulasah';if(e.source==='rawindroid')return 'Maulid';return 'Bacaan'}
function displayTitle(e){let t=String(e.title||'').trim();const m=t.match(/^Kitab\s+(\d{1,4})(?:_(?:in|id|en|ar))?$/i);return m?'Kitab Koleksi No. '+m[1]:t}
function visibleEntries(list){return (list||[]).filter(e=>!e.hidden)}
function allEntries(){let out=[];Object.entries(C.sources).forEach(([k,s])=>{if(k==='rawi_complete')return;out=out.concat(visibleEntries(s.pdfs),visibleEntries(s.html))});return out}
function keyword(keys){return allEntries().filter(e=>{const h=(e.title+' '+(e.sourcePath||'')).toLowerCase();return keys.some(k=>h.includes(k.toLowerCase()))})}

async function boot(){
 try{
  C=await fetch(local('catalog.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog '+r.status);return r.json()});
  Q=await fetch(local('quran/index.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('quran '+r.status);return r.json()});
  renderHome();
  const pv=new URLSearchParams(location.search).get('preview');
  if(pv){setTimeout(()=>route(pv),50);}
 }catch(e){setHtml('<div class="mn-empty"><h3>Data gagal dimuat</h3></div>')}
}

function menuCard(type,title,desc,go){
 return '<button class="mn-menu-card" data-go="'+go+'"><div class="mn-menu-icon">'+icon(type)+'</div><h3>'+title+'</h3><div class="mn-card-chevron">›</div></button>';
}

function renderHome(){
 nativeBackAction=null;
 setNav('home');
 setHtml(
 '<section class="mn-hero">'+
   '<svg class="mn-hero-art" viewBox="0 0 420 280" aria-hidden="true">'+
     '<defs><linearGradient id="dome" x1="0" x2="1"><stop stop-color="#d8c176"/><stop offset="1" stop-color="#f2df9c"/></linearGradient></defs>'+
     '<g opacity=".95">'+
       '<path d="M220 188h160v62H220z" fill="#eadca8"/>'+
       '<path d="M250 188c0-42 24-72 50-72s50 30 50 72z" fill="url(#dome)"/>'+
       '<path d="M296 100h8v18h-8z" fill="#e7cc74"/><circle cx="300" cy="98" r="4" fill="#e7cc74"/>'+
       '<path d="M232 139h12v111h-12zM356 139h12v111h-12z" fill="#e8d596"/>'+
       '<path d="M229 139c3-20 7-30 9-30s6 10 9 30zM353 139c3-20 7-30 9-30s6 10 9 30z" fill="#e7ca72"/>'+
       '<rect x="270" y="210" width="60" height="40" rx="26" fill="#0a6248"/>'+
       '<g fill="#0b6d50" opacity=".92"><circle cx="225" cy="225" r="22"/><circle cx="240" cy="220" r="20"/><circle cx="370" cy="225" r="24"/></g>'+
     '</g>'+
   '</svg>'+
   '<div class="mn-hero-copy"><h1>Majelis<br>Mengaji</h1></div>'+
 '</section>'+
 '<div class="mn-quick-cards">'+
   '<button class="mn-quick-card" data-go="quran"><div class="mn-quick-icon">'+icon('book')+'</div><span>Al-Qur\'an</span></button>'+
   '<button class="mn-quick-card" data-go="tahlil"><div class="mn-quick-icon">'+icon('beads')+'</div><span>Yasin & Tahlil</span></button>'+
   '<button class="mn-quick-card" data-go="maulid"><div class="mn-quick-icon">'+icon('library')+'</div><span>Maulid & Ratib</span></button>'+
 '</div>'+
 '<div class="mn-section-head"><h2>Menu Utama</h2></div>'+
 '<div class="mn-menu-grid">'+
   menuCard('book','Al-Qur\'an','', 'quran')+
   menuCard('moon','Surat Yasin','', 'yasin')+
   menuCard('beads','Tahlil','', 'tahlil')+
   menuCard('star','Simtud Duror','', 'simtud')+
   menuCard('library','Maulid & Ratib','', 'maulid')+
   menuCard('clock','Jadwal Sholat','', 'shalat')+
   menuCard('library','BaAlwi','', 'baalwi')+
   menuCard('book','Al-Khulasah','', 'khulasah')+
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
 if(r==='baalwi')return renderList('BaAlwi',visibleEntries(C.sources.baalwi.pdfs),'home');
 if(r==='khulasah')return renderList('Al-Khulasah',visibleEntries(C.sources.khulasah.pdfs),'home');
 if(r==='shalat')return renderPrayer();
 if(r==='search')return renderGlobalSearch();
}

function renderGlobalSearch(){
 nativeBackAction=renderHome;
 setNav('home');
 const entries=allEntries();
 setHtml('<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>Cari Bacaan</h2></div><input class="mn-search" id="search" placeholder="Cari judul…"><div class="mn-list" id="list"></div>');
 $('#back').onclick=renderHome;
 const draw=()=>{
  const q=$('#search').value.toLowerCase().trim();
  if(!q){$('#list').innerHTML='';return}
  const f=entries.filter(e=>(displayTitle(e)+' '+(e.sourcePath||'')).toLowerCase().includes(q)).slice(0,80);
  $('#list').innerHTML=f.length?f.map(row).join(''):'<div class="mn-empty">Tidak ada hasil.</div>';
  bindRows();
 };
 $('#search').oninput=draw;setTimeout(()=>$('#search').focus(),50);
}

function renderKeyword(title,keys,nav){
 const entries=keyword(keys);
 entries.sort((a,b)=>(a.source==='rawindroid'?-1:0)-(b.source==='rawindroid'?-1:0));
 renderList(title,entries,nav);
}

function row(e){
 const ico=e.type==='html'?'star':'file';
 return '<div class="mn-row" role="button" tabindex="0" data-open="'+encodeURIComponent(JSON.stringify(e))+'">'+
   '<div class="mn-row-icon">'+icon(ico)+'</div>'+
   '<div><div class="mn-row-title">'+esc(displayTitle(e))+'</div></div>'+
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
 nativeBackAction=renderHome;
 currentList={title,entries,nav};setNav(nav);
 setHtml(
  '<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(title)+'</h2></div>'+
  '<input class="mn-search" id="search" placeholder="Cari bacaan…">'+
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
 nativeBackAction=()=>renderList(currentList.title,currentList.entries,currentList.nav);
 setHtml('<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(e.title)+'</h2></div><div class="mn-html-reader"><iframe id="rawframe" scrolling="no" src="'+local(e.path)+'"></iframe></div>');
 $('#back').onclick=nativeBackAction;

 const f=$('#rawframe');
 const fixReader=()=>{
  try{
   const d=f.contentDocument;
   if(!d)return;
   let st=d.getElementById('mn-force-reader-style');
   if(!st){
    st=d.createElement('style');
    st.id='mn-force-reader-style';
    st.textContent=
      'html,body{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:10px 8px 28px!important;overflow-x:hidden!important;box-sizing:border-box!important;background:#fff!important;}'+
      '*,*:before,*:after{box-sizing:border-box!important;max-width:100%!important;}'+
      'body,div,p,section,article,main{min-width:0!important;white-space:normal!important;overflow-wrap:break-word!important;word-wrap:break-word!important;}'+
      'img,svg,video,canvas{max-width:100%!important;height:auto!important;}'+
      'table{width:100%!important;max-width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;}'+
      'td,th{white-space:normal!important;overflow-wrap:break-word!important;}'+
      'pre,code{white-space:pre-wrap!important;overflow-wrap:anywhere!important;}'+
      '[dir="rtl"],.arabic,.arab,.ayat,.teks-arab{direction:rtl!important;text-align:right!important;white-space:normal!important;word-break:normal!important;overflow-wrap:normal!important;line-height:1.95!important;}';
    (d.head||d.documentElement).appendChild(st);
   }
   const h=Math.max(
    d.body?.scrollHeight||0,
    d.documentElement?.scrollHeight||0,
    d.body?.offsetHeight||0,
    d.documentElement?.offsetHeight||0
   );
   if(h>0)f.style.height=(h+36)+'px';
  }catch(_){}
 };
 f.onload=()=>{
  fixReader();
  setTimeout(fixReader,150);
  setTimeout(fixReader,500);
  setTimeout(fixReader,1200);
  try{
   const d=f.contentDocument;
   if(d&&window.ResizeObserver){
    const ro=new ResizeObserver(fixReader);
    ro.observe(d.documentElement);
    if(d.body)ro.observe(d.body);
   }
  }catch(_){}
 };
}

async function openPdf(e){
 nativeBackAction=()=>renderList(currentList.title,currentList.entries,currentList.nav);
 setHtml('<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>'+esc(displayTitle(e))+'</h2></div><div class="mn-reader"><div id="pdfpages" class="mn-pdf-pages"><div class="mn-empty">Memuat kitab…</div></div></div>');
 $('#back').onclick=()=>renderList(currentList.title,currentList.entries,currentList.nav);
 try{
  pdfDoc=await pdfjsLib.getDocument({url:local(e.path),disableRange:true,disableStream:true}).promise;
  const holder=$('#pdfpages');holder.innerHTML='';
  for(let i=1;i<=pdfDoc.numPages;i++){
   const sec=document.createElement('section');sec.className='mn-pdf-page';sec.dataset.page=String(i);
   sec.innerHTML='<canvas></canvas>';
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
   }catch(_){sec.dataset.rendered='error';sec.innerHTML='<div class="mn-empty">Tidak dapat dimuat.</div>'}
  };
  const obs=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting)renderPage(x.target)}),{root:null,rootMargin:'900px 0px',threshold:.01});
  $$('.mn-pdf-page').forEach(sec=>obs.observe(sec));
  const first=$('.mn-pdf-page');if(first)renderPage(first);
 }catch(err){$('.mn-reader').innerHTML='<div class="mn-empty">Tidak dapat dimuat.<br>'+esc(err.message)+'</div>'}
}

function renderQuran(){
 nativeBackAction=renderHome;
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
 nativeBackAction=renderQuran;
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
 nativeBackAction=renderHome;
 setNav('home');
 const times=prayTimes(new Date());
 setHtml(
  '<div class="mn-toolbar"><button class="mn-back" id="back">←</button><h2>Jadwal Sholat Palembang</h2></div>'+
  ''+
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
const topSearch=$('#topSearch');if(topSearch)topSearch.onclick=()=>route('search');
boot();