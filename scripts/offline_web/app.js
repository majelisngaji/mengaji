const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],base='https://app.local/';
let C,Q,pdfDoc,pageNum=1,pdfScale=1.35,arabSize=34,currentList={title:'',entries:[],nav:'home'};
pdfjsLib.GlobalWorkerOptions.workerSrc=base+'vendor/pdf.worker.min.js';
const local=p=>base+String(p||'').replace(/^\/+/,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function shell(x){$('#content').innerHTML=x;window.scrollTo(0,0)}
function active(n){$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.nav===n))}
function bind(selector='[data-go]'){$$(selector).forEach(x=>x.onclick=()=>route(x.dataset.go))}
async function boot(){try{C=await fetch(local('catalog.json')).then(r=>r.json());Q=await fetch(local('quran/index.json')).then(r=>r.json());renderHome()}catch(e){shell('<div class="empty"><h3>Data offline gagal dibaca</h3><p>'+esc(e.message)+'</p></div>')}}
function allEntries(){let o=[];Object.entries(C.sources).forEach(([k,s])=>{if(k==='rawi_complete')return;o=o.concat(s.pdfs||[],s.html||[])});return o}
function keyword(keys,src){return allEntries().filter(e=>{let h=(e.title+' '+(e.sourcePath||'')).toLowerCase();return(!src||e.source===src)&&keys.some(k=>h.includes(k.toLowerCase()))})}
function menucard(icon,title,desc,go){return '<button class="menu-card" data-go="'+go+'"><div class="micon">'+icon+'</div><div class="menucopy"><h3>'+title+'</h3><p>'+desc+'</p></div><span class="chev">›</span></button>'}
function renderHome(){active('home');let total=allEntries().length;
shell('<section class="hero"><div class="eyebrow">MAJELIS TA\'LIM ANWARUL HABIB</div><h1>Majelis<br>Mengaji</h1><div class="herochips"><button class="herochip" data-go="quran">Al-Qur\'an</button><button class="herochip" data-go="tahlil">Yasin & Tahlil</button><button class="herochip" data-go="maulid">Maulid & Ratib</button></div><div class="guides"><small>DI BAWAH ASUHAN</small><strong>Alhabib Ahmad bin Alwi Alkaff<br><span style="color:#e6c65f;font-size:12px">dan</span><br>Habib Husein Al-Khered</strong></div></section>'+
'<h2 class="sectiontitle">Menu Utama</h2><p class="sectionsub">Pilih bacaan</p><div class="menu-grid">'+
menucard('▣','Al-Qur\'an','114 surah • Arab • Terjemahan','quran')+
menucard('☾','Surat Yasin','Bacaan Yasin lengkap','yasin')+
menucard('◉','Tahlil','Tahlil dan doa lengkap','tahlil')+
menucard('☆','Simtud Duror','Maulid Simthud Duror','simtud')+
menucard('✦','Maulid & Ratib','Barzanji, Diba\', Burdah dan Ratib','maulid')+
menucard('⌂','Jadwal Sholat','Jadwal Palembang dihitung offline','shalat')+
menucard('▤','BaAlwi','Koleksi kitab lokal','baalwi')+
menucard('✧','Al-Khulasah','Dzikir, wirid dan doa lokal','khulasah')+
'</div><h2 class="sectiontitle" style="font-size:19px">Koleksi Offline</h2><div class="collection-row"><div class="pillcard"><strong>'+Q.length+' Surah</strong><span>Al-Qur\'an lokal</span></div><div class="pillcard"><strong>'+C.sources.baalwi.pdfs.length+' Kitab</strong><span>BaAlwi lokal</span></div><div class="pillcard"><strong>'+C.sources.khulasah.pdfs.length+' Bacaan</strong><span>Al-Khulasah lokal</span></div><div class="pillcard"><strong>'+total+' Entri</strong><span>Tanpa internet</span></div></div>');
bind();$$('.herochip').forEach(x=>x.onclick=()=>route(x.dataset.go))}
function route(r){if(r==='home')return renderHome();if(r==='quran')return renderQuran();if(r==='yasin')return renderKeyword('Surat Yasin',['yasin','yaseen','يس'],'tahlil');if(r==='tahlil')return renderKeyword('Tahlil',['tahlil','تهليل'],'tahlil');if(r==='simtud'){let e=(C.sources.rawindroid?.html||[]).find(x=>x.title.includes('Simthud'));if(e){currentList={title:'Maulid & Ratib',entries:C.sources.rawindroid.html,nav:'simtud'};return openHtml(e)}return renderKeyword('Simtud Duror',['simt','simth','duror','durar','سمط','الدرر'],'simtud');}if(r==='maulid'){let exact=C.sources.rawindroid?.html||[],other=keyword(['ratib','haddad','attas','مولد','راتب']).filter(x=>x.source!=='rawindroid');return renderList('Maulid & Ratib',[...exact,...other],'home');}if(r==='baalwi')return renderList('Koleksi BaAlwi',C.sources.baalwi.pdfs,'home');if(r==='khulasah')return renderList('Al-Khulasah',C.sources.khulasah.pdfs,'home');if(r==='shalat')return renderPrayer()}
function renderKeyword(title,keys,nav){let e=keyword(keys);e.sort((x,y)=>(x.source==='rawindroid'?-1:0)-(y.source==='rawindroid'?-1:0));renderList(title,e,nav)}
function sourceLabel(e){if(e.source==='baalwi')return 'BaAlwi';if(e.source==='khulasah')return 'Al-Khulasah';if(e.source==='rawindroid')return 'Maulid';return 'Bacaan Offline'}
function cleanDisplayTitle(e){let t=String(e.title||'').trim();let m=t.match(/^Kitab\s+(\d{1,4})(?:_(?:in|id|en|ar))?$/i);if(m)return 'Kitab Koleksi No. '+m[1];return t}
function itemRow(e){let lang=e.lang?(' • '+e.lang):'',ico=e.type==='html'?'☆':'▤';return '<div class="item tap" role="button" tabindex="0" data-open="'+encodeURIComponent(JSON.stringify(e))+'"><div class="item-icon">'+ico+'</div><div class="grow"><div class="ititle">'+esc(cleanDisplayTitle(e))+'</div><div class="imeta">'+esc(sourceLabel(e))+lang+'</div></div><div class="rowchev">›</div></div>'}
function renderList(title,entries,nav='home'){currentList={title,entries,nav};active(nav);shell('<div class="toolbar"><button class="back" id="back">←</button><h2>'+esc(title)+'</h2></div><input class="search" id="search" placeholder="Cari judul bacaan…"><span class="badge">'+entries.length+' bacaan offline</span><div class="list" id="list"></div>');$('#back').onclick=renderHome;let draw=()=>{let q=$('#search').value.toLowerCase().trim(),f=entries.filter(e=>(e.title+' '+(e.sourcePath||'')).toLowerCase().includes(q)).slice(0,900);$('#list').innerHTML=f.length?f.map(itemRow).join(''):'<div class="empty">Tidak ada hasil.</div>';$('[data-open]').forEach(b=>{b.onclick=()=>openEntry(JSON.parse(decodeURIComponent(b.dataset.open)));b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}}})};$('#search').oninput=draw;draw()}
function openEntry(e){return e.type==='html'?openHtml(e):openPdf(e)}
function openHtml(e){shell('<div class="toolbar"><button class="back" id="back">←</button><h2>'+esc(e.title)+'</h2></div><div class="htmlreader"><iframe id="rawframe" scrolling="no" src="'+local(e.path)+'"></iframe></div>');$('#back').onclick=()=>renderList(currentList.title,currentList.entries,currentList.nav);const f=$('#rawframe');const fit=()=>{try{const d=f.contentDocument,h=Math.max(d.body?.scrollHeight||0,d.documentElement?.scrollHeight||0);if(h>0)f.style.height=(h+24)+'px'}catch(_){}};f.onload=()=>{fit();setTimeout(fit,250);setTimeout(fit,900)}}
async function openPdf(e){
 shell('<div class="toolbar"><button class="back" id="back">←</button><h2>'+esc(e.title)+'</h2></div><div class="reader"><div id="pdfpages" class="pdfpages"><div class="empty">Memuat kitab offline…</div></div></div>');
 $('#back').onclick=()=>renderList(currentList.title,currentList.entries,currentList.nav);
 try{
   pdfDoc=await pdfjsLib.getDocument({url:local(e.path),disableRange:true,disableStream:true}).promise;
   const holder=$('#pdfpages');
   holder.innerHTML='';
   for(let i=1;i<=pdfDoc.numPages;i++){
     const sec=document.createElement('section');
     sec.className='pdfpage';
     sec.dataset.page=String(i);
     sec.innerHTML='<div class="pageno">Halaman '+i+' / '+pdfDoc.numPages+'</div><canvas></canvas>';
     holder.appendChild(sec);
   }
   const renderPage=async sec=>{
     if(sec.dataset.rendered==='1'||sec.dataset.rendered==='loading')return;
     sec.dataset.rendered='loading';
     try{
       const p=await pdfDoc.getPage(Number(sec.dataset.page));
       const v=p.getViewport({scale:1.55});
       const c=sec.querySelector('canvas');
       c.width=Math.floor(v.width);
       c.height=Math.floor(v.height);
       await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;
       sec.dataset.rendered='1';
     }catch(err){
       sec.dataset.rendered='error';
       sec.innerHTML='<div class="pageno">Halaman '+sec.dataset.page+'</div><div class="empty">Halaman gagal dimuat.</div>';
     }
   };
   const obs=new IntersectionObserver(entries=>{
     entries.forEach(x=>{if(x.isIntersecting)renderPage(x.target)});
   },{root:null,rootMargin:'900px 0px',threshold:0.01});
   $$('.pdfpage').forEach(sec=>obs.observe(sec));
   const first=$('.pdfpage');
   if(first)renderPage(first);
 }catch(err){
   $('.reader').innerHTML='<div class="empty">Bacaan tidak dapat dimuat.<br>'+esc(err.message)+'</div>';
 }
}

function renderQuran(){active('quran');shell('<div class="toolbar"><button class="back" id="back">←</button><h2>Al-Qur\'an</h2></div><input class="search" id="search" placeholder="Cari surah…"><div class="list" id="qlist"></div>');$('#back').onclick=renderHome;let draw=()=>{let q=$('#search').value.toLowerCase(),f=Q.filter(s=>(s.name+' '+s.arabic+' '+s.meaning).toLowerCase().includes(q));$('#qlist').innerHTML=f.map(s=>'<div class="item tap" role="button" tabindex="0" data-s="'+s.number+'"><div class="num">'+s.number+'</div><div class="grow"><div class="ititle">'+esc(s.name)+' — '+esc(s.arabic)+'</div><div class="imeta">'+esc(s.meaning)+' • '+s.ayah+' ayat</div></div><div class="rowchev">›</div></div>').join('');$('[data-s]').forEach(b=>{b.onclick=()=>openSurah(+b.dataset.s);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}}})};$('#search').oninput=draw;draw()}
async function openSurah(n){let s=await fetch(local('quran/'+n+'.json')).then(r=>r.json());localStorage.setItem('lastSurah',n);shell('<div class="toolbar"><button class="back" id="back">←</button><h2>'+esc(s.name)+'</h2><button class="smallbtn" id="minus">A−</button><button class="smallbtn" id="plus">A+</button></div><div class="reader" id="surah">'+(s.verses||[]).map(v=>'<div class="ayah"><div class="arab" style="font-size:'+arabSize+'px">'+esc(v.text)+' <span class="num">'+v.number+'</span></div><div class="trans">'+esc(v.translation_id||'')+'</div></div>').join('')+'</div><div class="toolbar"><button class="back" id="prev">← Surah</button><h2>'+n+' / 114</h2><button class="back" id="next">Surah →</button></div>');$('#back').onclick=renderQuran;$('#minus').onclick=()=>{arabSize=Math.max(24,arabSize-2);openSurah(n)};$('#plus').onclick=()=>{arabSize=Math.min(54,arabSize+2);openSurah(n)};$('#prev').onclick=()=>n>1&&openSurah(n-1);$('#next').onclick=()=>n<114&&openSurah(n+1)}
function renderPrayer(){active('home');let d=new Date(),times=prayTimes(d);shell('<div class="toolbar"><button class="back" id="back">←</button><h2>Jadwal Sholat Palembang</h2></div><div class="hero" style="min-height:190px"><div class="eyebrow">DIHITUNG LANGSUNG DI HP</div><h1 style="font-size:38px">Jadwal<br>Sholat</h1><div class="guides"><small>LOKASI TETAP</small><strong>Palembang, Sumatera Selatan</strong></div></div><div class="praybox">'+Object.entries(times).map(([k,v])=>'<div class="pray"><b>'+k+'</b><span>'+v+'</span></div>').join('')+'</div><p class="sectionsub" style="margin-top:14px">Perhitungan astronomis offline; tidak memakai internet atau API.</p>');$('#back').onclick=renderHome}
function prayTimes(date){let lat=-2.99,lon=104.76,tz=7,N=Math.floor((date-Date.UTC(date.getUTCFullYear(),0,0))/86400000),g=2*Math.PI/365*(N-1+(12-12)/24),eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g)),dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);function hm(x){x=(x+24)%24;let h=Math.floor(x),m=Math.round((x-h)*60);if(m===60){h=(h+1)%24;m=0}return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')}function ha(alt){let a=alt*Math.PI/180,phi=lat*Math.PI/180,c=(Math.sin(a)-Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec));c=Math.max(-1,Math.min(1,c));return Math.acos(c)*180/Math.PI/15}let noon=(720-4*lon-eq+tz*60)/60,f=ha(-20),sun=ha(-.833),isha=ha(-18),asr=ha(-Math.atan(1/(1+Math.tan(Math.abs(lat*Math.PI/180-dec))))*180/Math.PI);return{Imsak:hm(noon-f-.17),Subuh:hm(noon-f),Terbit:hm(noon-sun),Dzuhur:hm(noon+.03),Ashar:hm(noon+asr),Maghrib:hm(noon+sun),Isya:hm(noon+isha)}}
document.addEventListener('click',e=>{let n=e.target.closest('.nav');if(n)route(n.dataset.nav)});
$('#fontQuick').onclick=()=>{arabSize=arabSize>=44?30:arabSize+4};
$('#nightQuick').onclick=()=>document.documentElement.classList.toggle('dark');
boot();