(function(){
const Q=s=>document.querySelector(s);
const QA=s=>[...document.querySelectorAll(s)];
const svg=(body,view='0 0 100 100')=>'<svg viewBox="'+view+'" aria-hidden="true">'+body+'</svg>';

const ICONS={
 quran:svg('<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 23c14-8 27-6 38 2v48c-11-8-24-10-38-2z"/><path d="M88 23c-14-8-27-6-38 2v48c11-8 24-10 38-2z"/><path d="M50 25v48"/><path d="M24 33c8-3 15-2 21 1M24 42c8-3 15-2 21 1M76 33c-8-3-15-2-21 1M76 42c-8-3-15-2-21 1"/><path d="M28 75 18 90M72 75l10 15M34 80h32"/></g>'),
 yasin:svg('<g fill="none" stroke="currentColor" stroke-width="3"><rect x="25" y="16" width="50" height="68" rx="5"/><rect x="31" y="22" width="38" height="56" rx="2"/><path d="M39 37h22M39 45h22M39 53h22"/><circle cx="50" cy="65" r="7"/></g>'),
 beads:svg('<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="20" r="6"/><circle cx="68" cy="25" r="6"/><circle cx="80" cy="40" r="6"/><circle cx="80" cy="58" r="6"/><circle cx="67" cy="72" r="6"/><circle cx="50" cy="77" r="6"/><circle cx="33" cy="72" r="6"/><circle cx="20" cy="58" r="6"/><circle cx="20" cy="40" r="6"/><circle cx="32" cy="25" r="6"/><path d="M50 83v9M46 92h8M47 97h6"/></g>'),
 dome:svg('<g fill="none" stroke="currentColor" stroke-width="3"><path d="M18 75h64M25 75V57h50v18M31 57c0-20 12-34 19-34s19 14 19 34z"/><path d="M50 12v11M46 15h8"/><path d="M20 75v8h60v-8M16 83h68"/><path d="M72 31h7v44h-7M70 31c2-9 4-14 5-14s3 5 5 14"/></g>'),
 books:svg('<g fill="none" stroke="currentColor" stroke-width="3"><path d="M22 24h52l6 8-6 8H22l-6-8z"/><path d="M26 43h48l6 8-6 8H26l-6-8z"/><path d="M22 62h52l6 8-6 8H22l-6-8z"/></g>'),
 clock:svg('<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="51" r="30"/><path d="M50 34v18l12 8M50 14v7M50 82v7M13 51h7M80 51h7"/></g>'),
 scholar:svg('<g fill="none" stroke="currentColor" stroke-width="3"><path d="M35 31c2-12 9-19 15-19s13 7 15 19"/><path d="M31 30c8 5 30 5 38 0"/><circle cx="50" cy="42" r="13"/><path d="M33 45c-1 11 3 18 10 22M67 45c1 11-3 18-10 22M28 85c4-13 12-21 22-21s18 8 22 21"/></g>')
};

const MOSQUE='<svg class="ah-mosque-real" viewBox="0 0 900 520" preserveAspectRatio="xMidYMax meet" aria-hidden="true">'+
'<defs><linearGradient id="mg" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fffdf0"/><stop offset="1" stop-color="#e8d8a5"/></linearGradient><linearGradient id="dg" x1="0" x2="1"><stop stop-color="#0c714f"/><stop offset="1" stop-color="#07543c"/></linearGradient></defs>'+
'<g opacity=".98"><rect x="110" y="320" width="680" height="145" rx="8" fill="url(#mg)"/>'+
'<path d="M340 320c0-98 50-158 110-158s110 60 110 158z" fill="url(#dg)"/><path d="M448 129h6v34h-6z" fill="#d5aa36"/><circle cx="451" cy="124" r="7" fill="#d5aa36"/>'+
'<path d="M230 330c0-61 36-99 78-99s78 38 78 99zM514 330c0-61 36-99 78-99s78 38 78 99z" fill="#0a6548"/>'+
'<g fill="#f3e5bb"><rect x="130" y="184" width="30" height="281"/><rect x="740" y="184" width="30" height="281"/><rect x="205" y="236" width="24" height="229"/><rect x="671" y="236" width="24" height="229"/></g>'+
'<g fill="#d8b34b"><path d="M124 184c7-42 15-62 21-62s14 20 21 62zM734 184c7-42 15-62 21-62s14 20 21 62z"/><path d="M201 236c5-31 11-47 16-47s11 16 16 47zM667 236c5-31 11-47 16-47s11 16 16 47z"/></g>'+
'<g fill="#0a6648"><circle cx="92" cy="422" r="60"/><circle cx="146" cy="433" r="52"/><circle cx="790" cy="420" r="64"/><circle cx="742" cy="442" r="50"/></g>'+
'<g fill="#f7efd6"><path d="M155 370h590v95H155z"/><path d="M190 370c0-35 23-62 52-62s52 27 52 62zM303 370c0-35 23-62 52-62s52 27 52 62zM493 370c0-35 23-62 52-62s52 27 52 62zM606 370c0-35 23-62 52-62s52 27 52 62z"/></g>'+
'<g fill="#0a6045"><path d="M215 465v-62c0-22 15-38 30-38s30 16 30 38v62zM420 465v-70c0-26 16-44 30-44s30 18 30 44v70zM625 465v-62c0-22 15-38 30-38s30 16 30 38v62z"/></g></g></svg>';

function patchHome(){
 const hero=Q('.mn-hero'); if(!hero||hero.dataset.ahPatched)return;
 hero.dataset.ahPatched='1';
 const old=Q('.mn-hero-art'); if(old) old.outerHTML=MOSQUE;
 const quick=QA('.mn-quick-card .mn-quick-icon');
 if(quick[0])quick[0].innerHTML=ICONS.quran;
 if(quick[1])quick[1].innerHTML=ICONS.beads;
 if(quick[2])quick[2].innerHTML=ICONS.dome;

 const menu=QA('.mn-menu-card .mn-menu-icon');
 const list=[ICONS.quran,ICONS.yasin,ICONS.beads,ICONS.books,ICONS.dome,ICONS.clock,ICONS.scholar,ICONS.books];
 menu.forEach((e,i)=>{if(list[i])e.innerHTML=list[i]});

 const nav=QA('.mn-nav-ico');
 if(nav[0])nav[0].innerHTML=svg('<path d="M18 44 50 16l32 28v36H59V58H41v22H18z" fill="currentColor"/>');
 if(nav[1])nav[1].innerHTML=ICONS.quran;
 if(nav[2])nav[2].innerHTML=ICONS.beads;
 if(nav[3])nav[3].innerHTML=ICONS.books;
}

const root=Q('#content');
if(root){
 new MutationObserver(patchHome).observe(root,{childList:true,subtree:true});
 setTimeout(patchHome,50);
}
})();