#!/usr/bin/env python3
import hashlib
import html as htmlmod
import json
import re
import shutil
import sqlite3
import time
import unicodedata
import zipfile
from pathlib import Path
from urllib.parse import unquote
import requests
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
WORK = ROOT / ".offline_build"
WEBTPL = ROOT / "scripts" / "offline_web"
UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/155 Safari/537.36"

SOURCES = {
    "rawi_complete": {
        "urls": [
            "https://d.apkpure.com/b/APK/com.ichwan.android.rawiandroid?version=latest",
            "https://d.apkpure.com/b/XAPK/com.ichwan.android.rawiandroid?version=latest"
        ],
        "pages": []
    },
    "baalwi": {
        "urls": [
            "https://d.apkpure.com/b/XAPK/com.baalwi?version=latest",
            "https://d.apkpure.com/b/APK/com.baalwi?version=latest"
        ],
        "pages": []
    },
    "khulasah": {
        "urls": [
            "https://d.apkpure.com/b/XAPK/com.praylatest.activities?version=latest",
            "https://d.apkpure.com/b/APK/com.praylatest.activities?version=latest"
        ],
        "pages": []
    }
}
PDFJS = {
    "vendor/pdf.min.js": [
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"
    ],
    "vendor/pdf.worker.min.js": [
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
    ]
}
QURAN = "https://raw.githubusercontent.com/penggguna/QuranJSON/master/surah/{n}.json"
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav"}
WEB_EXT = {".html",".htm",".css",".js",".mjs",".json",".png",".jpg",".jpeg",".webp",".gif",".svg",".ttf",".otf",".woff",".woff2",".mp3",".m4a",".aac",".ogg",".oga",".wav",".mp4"}
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept": "*/*"})

def slug(v, limit=90):
    v = unquote(str(v)).replace("\\"," ").replace("/"," ")
    v = re.sub(r"\s+"," ",v).strip()
    v = re.sub(r"[^\w\u0600-\u06FF .()\-]+","_",v,flags=re.UNICODE)
    return (v[:limit].strip(" ._-") or "file")

def _try_archive(name, url, out):
    print("[download]", name, url)
    r = S.get(url, timeout=240, allow_redirects=True, stream=True)
    r.raise_for_status()
    size = 0
    first = b""
    with open(out,"wb") as f:
        for chunk in r.iter_content(1024*1024):
            if not chunk: continue
            if not first: first = chunk[:16]
            f.write(chunk); size += len(chunk)
    if size < 50000 or first.startswith(b"<!") or not zipfile.is_zipfile(out):
        raise RuntimeError("invalid archive, size=%s content-type=%s" % (size, r.headers.get("content-type")))
    print("[ok]", name, round(size/1024/1024,1), "MB")
    return True

def _scrape_download_links(page):
    print("[scrape]", page)
    r=S.get(page,timeout=90,allow_redirects=True)
    r.raise_for_status()
    txt=htmlmod.unescape(r.text).replace("\\/","/")
    links=[]
    for m in re.findall(r'https?://[^"\'<> ]+',txt):
        if ("apkpure" in m and ("download" in m or "/b/APK/" in m or "/b/XAPK/" in m)):
            links.append(m.replace("&amp;","&"))
    for m in re.findall(r'href=["\']([^"\']+)["\']',txt,re.I):
        if "download.apkpure" in m or "d.apkpure.com" in m:
            links.append(m.replace("&amp;","&"))
    out=[]
    for u in links:
        if u not in out: out.append(u)
    print("[scrape-links]", len(out))
    return out

def download(name, cfg, out):
    last=None
    candidates=list(cfg.get("urls",[]))
    for page in cfg.get("pages",[]):
        try:
            candidates.extend(_scrape_download_links(page))
        except Exception as e:
            print("[warn] scrape",page,e)
    seen=[]
    for url in candidates:
        if url in seen: continue
        seen.append(url)
        try:
            if _try_archive(name,url,out): return
        except Exception as e:
            last=e; print("[warn]",name,e); out.unlink(missing_ok=True)
    raise RuntimeError("download failed %s: %s" % (name,last))

def unzip(path, dest):
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path) as z: z.extractall(dest)

def explode(path, dest):
    unzip(path,dest)
    done=set()
    while True:
        found=False
        for p in list(dest.rglob("*")):
            if not p.is_file() or p in done or p.suffix.lower() not in {".apk",".xapk",".zip"}: continue
            done.add(p)
            try:
                if zipfile.is_zipfile(p):
                    sub=p.parent/(p.stem+"_unzipped")
                    if not sub.exists(): unzip(p,sub); found=True
            except Exception: pass
        if not found: break

def digest(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for c in iter(lambda:f.read(1024*1024),b""): h.update(c)
    return h.hexdigest()

def copy_unique(src,dest,used):
    d=digest(src)
    if d in used: return used[d]
    rel=d[:12]+"-"+slug(src.stem,55)+src.suffix.lower()
    dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dest/rel)
    used[d]=rel
    return rel

def _looks_code_title(s):
    s=(s or "").strip()
    if not s: return True
    if re.fullmatch(r"\d{1,4}(_(in|en|ar|id))?", s.lower()): return True
    if re.fullmatch(r"[a-z]{0,3}\d{2,4}[a-z_\-]*", s.lower()): return True
    return False

def _clean_title_line(s):
    s=re.sub(r"\s+"," ",str(s or "")).strip(" ._-|")
    if len(s)<4 or len(s)>120: return ""
    if "http://" in s.lower() or "https://" in s.lower() or "www." in s.lower(): return ""
    if re.fullmatch(r"[\d\W_]+",s): return ""
    return s

def normalize_title_text(value):
    s=htmlmod.unescape(str(value or ""))
    s=unicodedata.normalize("NFKC",s)
    if any(x in s for x in ["Ã","Â","â€","â€™","â€œ","â€","�"]):
        try:
            fixed=s.encode("latin1",errors="ignore").decode("utf-8",errors="ignore")
            if fixed and fixed.count("�")<=s.count("�"):
                s=fixed
        except Exception:
            pass
    s=re.sub(r"[\x00-\x1f\x7f]+"," ",s)
    s=re.sub(r"\.(pdf|epub|html?|txt)$","",s,flags=re.I)
    s=s.replace("_"," ")
    s=re.sub(r"\s+"," ",s).strip(" ._\-|:;")
    s=re.sub(r"^(?:file|book|kitab)\s*[:#-]?\s*(?=\d)", "", s, flags=re.I)
    s=re.sub(r"^\d{1,4}\s*[-_.:]\s*", "", s)
    s=re.sub(r"\s*\((?:en|english)\)\s*$","",s,flags=re.I)
    s=re.sub(r"\s*[-_. ](?:en|english)\s*$","",s,flags=re.I)
    return s.strip()

def title_is_clear(s):
    s=normalize_title_text(s)
    if not s or len(s)<3 or len(s)>95:
        return False
    if any(x in s for x in ["�","Ã","Â","â€","http://","https://","www."]):
        return False
    if re.fullmatch(r"\d{1,4}(?:\s+(?:en|in|id|ar))?",s,re.I):
        return False
    letters=sum(1 for ch in s if ch.isalpha())
    marks=sum(1 for ch in s if unicodedata.category(ch).startswith("M"))
    if letters+marks<3:
        return False
    punct=sum(1 for ch in s if not ch.isalnum() and not ch.isspace() and not unicodedata.category(ch).startswith("M"))
    if punct>max(8,int(len(s)*0.28)):
        return False
    if len(s.split())>16:
        return False
    return True

def mostly_arabic(s):
    arab=latin=0
    for ch in str(s or ""):
        o=ord(ch)
        if 0x0600<=o<=0x06ff or 0x0750<=o<=0x077f or 0x08a0<=o<=0x08ff:
            arab+=1
        elif ("A"<=ch<="Z") or ("a"<=ch<="z"):
            latin+=1
    return arab>=4 and arab>latin*2

def source_label(name):
    return {"baalwi":"BaAlwi","khulasah":"Al-Khulasah"}.get(name,name.replace("_"," ").title())

def debug_sqlite_catalog(root, source_name):
    dbs=[p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in {".db",".sqlite",".sqlite3"}]
    print("[catalog-debug]",source_name,"db-count",len(dbs))
    for db in dbs:
        try:
            conn=sqlite3.connect("file:"+str(db)+"?mode=ro",uri=True)
            tables=[r[0] for r in conn.execute("select name from sqlite_master where type='table'")]
            print("[catalog-db]",source_name,db.name,"tables",tables[:30])
            if source_name=="khulasah" and "category_Details" in tables:
                try:
                    rows=list(conn.execute('select invocationIndex,title from category_Details where invocationIndex is not null order by invocationIndex'))
                    print("[khulasah-all]",db.name,[(str(a),str(b)) for a,b in rows])
                except Exception as e:
                    print("[khulasah-all-warn]",db.name,e)
            if source_name=="baalwi" and "ba_master_pdf" in tables and "ba_title_pdf_relation" in tables and "ba_titles" in tables:
                try:
                    rows=list(conn.execute("""
                        select mp.id,mp.file_name_arabic,mp.file_name_indonesian,
                               t.title_indonesian,t.title_english,t.title_arabic,
                               r.sort_order,t.list_level,t.list_rank
                        from ba_master_pdf mp
                        join ba_title_pdf_relation r on r.pdf_id=mp.id
                        join ba_titles t on t.title_id=r.title_id
                        where mp.file_name_arabic is not null
                        order by mp.id,r.sort_order,t.id
                        limit 120
                    """))
                    print("[baalwi-join-sample]",[(str(x[0]),str(x[1]),str(x[2]),str(x[3]),str(x[4]),str(x[5]),str(x[6]),str(x[7]),str(x[8])) for x in rows])
                except Exception as e:
                    print("[baalwi-join-warn]",e)
            for table in tables[:20]:
                try:
                    info=list(conn.execute('pragma table_info("'+table.replace('"','""')+'")'))
                    cols=[r[1] for r in info]
                    print("[catalog-table]",source_name,table,"cols",cols)
                    if cols:
                        q='select '+','.join('"'+x.replace('"','""')+'"' for x in cols[:8])+' from "'+table.replace('"','""')+'" limit 8'
                        rows=list(conn.execute(q))
                        for row in rows:
                            print("[catalog-row]",source_name,table,[str(x)[:180] if x is not None else None for x in row])
                except Exception as e:
                    print("[catalog-table-warn]",source_name,table,e)
            conn.close()
        except Exception as e:
            print("[catalog-db-warn]",source_name,db,e)

def load_sqlite_title_map(root):
    out={}
    dbs=[p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in {".db",".sqlite",".sqlite3"}]
    print("[title-db] found",len(dbs),"database files")
    title_names=["title","judul","book_title","booktitle","name","book_name","kitab","kitab_name"]
    file_tokens=["file","filename","path","pdf","asset","url","book_file"]
    id_tokens=["id","book_id","bookid","no","number","nomor"]
    for db in dbs:
        try:
            conn=sqlite3.connect("file:"+str(db)+"?mode=ro",uri=True)
            tables=[r[0] for r in conn.execute("select name from sqlite_master where type='table'")]
            for table in tables:
                try:
                    info=list(conn.execute('pragma table_info("'+table.replace('"','""')+'")'))
                except Exception:
                    continue
                cols=[r[1] for r in info]
                lowers=[x.lower() for x in cols]
                tcol=None
                for wanted in title_names:
                    if wanted in lowers:
                        tcol=cols[lowers.index(wanted)];break
                if not tcol:
                    for col in cols:
                        low=col.lower()
                        if "title" in low or "judul" in low or ("name" in low and "file" not in low):
                            tcol=col;break
                if not tcol:
                    continue
                fcol=None
                for col in cols:
                    low=col.lower()
                    if any(tok==low or tok in low for tok in file_tokens):
                        fcol=col;break
                icol=None
                for col in cols:
                    low=col.lower()
                    if low in id_tokens or low.endswith("_id"):
                        icol=col;break
                selected=[tcol]+([fcol] if fcol and fcol!=tcol else [])+([icol] if icol and icol not in {tcol,fcol} else [])
                q='select '+','.join('"'+x.replace('"','""')+'"' for x in selected)+' from "'+table.replace('"','""')+'" limit 20000'
                try:
                    rows=conn.execute(q)
                except Exception:
                    continue
                for row in rows:
                    title=normalize_title_text(row[0])
                    if not title_is_clear(title):
                        continue
                    vals=list(row[1:])
                    keys=[]
                    for v in vals:
                        if v is None: continue
                        sv=str(v).strip()
                        if not sv: continue
                        keys += [sv.lower(),Path(sv).name.lower(),Path(sv).stem.lower()]
                        m=re.search(r"\d+",sv)
                        if m:
                            n=str(int(m.group()))
                            keys += [n,n.zfill(2),n.zfill(3),n.zfill(4)]
                    for k in keys:
                        if k and k not in out:
                            out[k]=title
            conn.close()
        except Exception as e:
            print("[title-db-warn]",db,e)
    print("[title-db] mapped keys",len(out))
    return out

def mapped_title_for_file(path,title_map):
    stem=path.stem.lower()
    base=re.sub(r"_(?:en|in|id|ar)$","",stem)
    keys=[path.name.lower(),stem,base]
    m=re.match(r"0*(\d+)",base)
    if m:
        n=str(int(m.group(1)))
        keys += [n,n.zfill(2),n.zfill(3),n.zfill(4)]
    for k in keys:
        t=title_map.get(k)
        if t and title_is_clear(t):
            return normalize_title_text(t)
    return ""

def final_display_title(raw, source, seq):
    t=normalize_title_text(raw)
    # Do not expose unreadable OCR/file-code/foreign-only titles in the UI.
    if not title_is_clear(t) or mostly_arabic(t):
        return "Kitab "+source_label(source)+" Bagian "+str(seq)
    return t

def pdf_title(path, fallback):
    stem=slug(fallback,120)
    try:
        rd=PdfReader(str(path))
        meta=rd.metadata
        if meta:
            mt=_clean_title_line(getattr(meta,"title","") or "")
            if mt and not _looks_code_title(mt):
                return mt
        text=""
        for pg in rd.pages[:2]:
            try:
                text += "\n" + (pg.extract_text() or "")
            except Exception:
                pass
        lines=[_clean_title_line(x) for x in text.splitlines()]
        lines=[x for x in lines if x]
        preferred=[]
        for x in lines[:40]:
            low=x.lower()
            if any(k in low for k in ["maulid","ratib","yasin","tahlil","burdah","barzan","simt","haddad","attas","hizb","wirid","wird","dua","doa","sholawat","shalawat","safinat","fiqh","tauhid","aqidah","sirah","hadith","hadis","quran","قرآن","مولد","راتب","دعاء","ورد","حزب","بردة"]):
                preferred.append(x)
        if preferred:
            return preferred[0]
        for x in lines[:20]:
            if not _looks_code_title(x):
                return x
    except Exception:
        pass
    return "Kitab " + stem if _looks_code_title(stem) else stem

KHULASAH_ID_TITLES = {
"A1":"Dzikir setelah Subuh",
"A2":"Wirid Syekh Abu Bakar bin Salim",
"A3":"Al-Wird Al-Lathif",
"A4":"Surah Yasin",
"A5":"Doa setelah Surah Yasin dan Wirid Imam Abu Bakar As-Sakran",
"A6":"Wirid Imam An-Nawawi",
"A7":"Doa setelah Shalat Dhuha dan Doa Istikharah",
"A8":"Niat Belajar dan Mengajar serta Doa Persaudaraan karena Allah",
"B1":"Dzikir setelah Shalat",
"C1":"Doa Bangun Tidur",
"C2":"Akhir Surah Ali 'Imran",
"C3":"Doa setelah Wudhu dan Pembukaan Tahajud",
"C4":"Dzikir Akhir Malam setelah Witir",
"C5":"Doa dengan Asmaul Husna",
"C6":"Qasidah Imam Abu Bakar Al-Adni",
"C7":"Qasidah An-Nafhah Al-'Anbariyyah",
"C8":"Qasidah Ya Arhamar Rahimin dan Qad Kafani",
"C9":"Doa Habib Muhammad Al-Haddar",
"C10":"Wirid Syekh Abu Bakar bin Salim",
"C11":"Beberapa Bacaan Istighfar",
"C12":"Doa Keluar Rumah dan Menuju Masjid",
"C13":"Dzikir Sebelum Shalat Subuh",
"D1":"Al-Wird Al-Lathif",
"D2":"Beberapa Bacaan Istighfar",
"D3":"Ratib Habib Umar bin Abdurrahman Al-Attas",
"D4":"Ratib Habib Abdullah bin Alawi Al-Haddad",
"E1":"Surah Al-Waqi'ah",
"E2":"Doa setelah Surah Al-Waqi'ah",
"E3":"Hizib Al-Bahr Imam Asy-Syadzili",
"F1":"Hizib An-Nashr Imam Al-Haddad",
"G1":"Doa Shalat Tasbih",
"G2":"Doa Perjalanan",
"G3":"Niat Belajar dan Mengajar serta Doa Persaudaraan karena Allah",
"G4":"Manzhumah Al-Mashrab Al-Ahna",
"G5":"Penutup Qasidah At-Ta'iyah Imam Al-Haddad",
"G6":"Doa Penutup Majelis dan Pelajaran",
"H1":"Dzikir Malam dan Hari Jumat",
"H2":"Surah Al-Kahfi",
"H3":"Surah Ad-Dukhan",
"H4":"Surah Al-Muzzammil",
"H5":"Surah Al-Buruj",
"H6":"Kumpulan Surah Pendek",
"H7":"Qasidah Ilahi Nas'aluka bil-Ismil A'zham",
"H8":"Qasidah Qad Kafani 'Ilmu Rabbi",
"H9":"Shalawat Ibrahimiyah",
"H10":"Shalawat Tajiyah Syekh Abu Bakar bin Salim",
"H11":"Wirid Syekh Abu Bakar bin Salim",
"H12":"Qasidah Ya Rabbana Ya Rabbana",
"H13":"Dzikir setelah Ashar Hari Jumat",
"H14":"Shalawat Tajiyah Syekh Abu Bakar bin Salim",
"H15":"Beberapa Bacaan Shalawat Nabi",
"H16":"Wirid Syekh Abu Bakar bin Salim",
"H17":"Beberapa Bacaan Shalawat Nabi",
"H18":"Doa Penutup Majelis dan Pelajaran",
"I1":"Wirid Imam Abu Bakar As-Sakran",
"I2":"Wirid Imam An-Nawawi",
"I3":"Beberapa Dzikir setelah Isya",
"I4":"Surah As-Sajdah",
"I5":"Surah Al-Mulk",
"I6":"Doa Sujud Tilawah dan Sujud Syukur",
"I7":"Doa Sebelum Tidur"
}

def load_baalwi_exact_titles(root):
    dbs=[p for p in root.rglob("*") if p.is_file() and p.name=="ba_alwi_v4_4_1.sqlite"]
    if not dbs:
        return {},set()
    db=dbs[0]
    conn=sqlite3.connect("file:"+str(db)+"?mode=ro",uri=True)
    rows=list(conn.execute("""
        select mp.id,
               mp.file_name_arabic,mp.file_name_english,mp.file_name_indonesian,
               mp.file_name_french,mp.file_name_urdu,mp.file_name_malayalam,
               mp.file_name_swahili,mp.file_name_turkish,mp.file_name_german,
               mp.file_name_portuguese,mp.file_name_spanish,
               t.title_indonesian,t.title_english,t.title_arabic,
               p.title_indonesian,p.title_english,
               r.sort_order,t.id
        from ba_master_pdf mp
        join ba_title_pdf_relation r on r.pdf_id=mp.id
        join ba_titles t on t.title_id=r.title_id
        left join ba_titles p on cast(p.title_id as text)=cast(t.parent_title_id as text)
        order by mp.id,r.sort_order,t.id
    """))
    conn.close()

    groups={}
    for row in rows:
        pid=row[0]
        g=groups.setdefault(pid,{"files":set(),"children":[],"parents":[],"ind_file":None,"arab_file":None})
        filevals=row[1:12]
        for fv in filevals:
            if fv and str(fv).strip():
                g["files"].add(Path(str(fv)).name.lower())
        if row[3]: g["ind_file"]=Path(str(row[3])).name.lower()
        if row[1]: g["arab_file"]=Path(str(row[1])).name.lower()
        child=normalize_title_text(row[12])
        parent=normalize_title_text(row[15])
        if title_is_clear(child) and not mostly_arabic(child):
            g["children"].append(child)
        if title_is_clear(parent) and not mostly_arabic(parent):
            g["parents"].append(parent)

    title_map={}
    arabic_has_indonesian=set()
    for pid,g in groups.items():
        children=list(dict.fromkeys(g["children"]))
        parents=list(dict.fromkeys(g["parents"]))
        title=""
        if len(children)==1:
            title=children[0]
        elif len(children)>1 and len(parents)==1:
            title=parents[0]
        elif children:
            # For a PDF containing several sub-bacaan, choose a concise common parent if available.
            title=parents[0] if parents else children[0]
        elif parents:
            title=parents[0]
        if not title:
            title="Kitab BaAlwi"
        for fn in g["files"]:
            title_map[fn]=title
        if g["arab_file"] and g["ind_file"]:
            arabic_has_indonesian.add(g["arab_file"])
    print("[baalwi-exact-map]",len(title_map),"file names","arabic-with-indonesian",len(arabic_has_indonesian))
    return title_map,arabic_has_indonesian

def detect_pdf_language(path):
    low=str(path).lower().replace("\\","/")
    stem=path.stem.lower()
    if "/indonesian_pdf/" in low or stem.endswith("_in") or stem.endswith("_id"):
        return "Indonesia"
    if "/english_pdf/" in low or stem.endswith("_en"):
        return "English"
    if "/spanish_pdf/" in low or stem.endswith("_sp"):
        return "Spanish"
    if "/malayalam_pdf/" in low or stem.endswith("_ml"):
        return "Malayalam"
    if "/french_pdf/" in low or stem.endswith("_fr"):
        return "French"
    if "/urdu_pdf/" in low or stem.endswith("_ur"):
        return "Urdu"
    if "/swhaili_pdf/" in low or "/swahili_pdf/" in low or stem.endswith("_sw"):
        return "Swahili"
    if "/turkish_pdf/" in low or stem.endswith("_tr"):
        return "Turkish"
    if "/german_pdf/" in low or stem.endswith("_de"):
        return "German"
    if "/portuguese_pdf/" in low or stem.endswith("_pt"):
        return "Portuguese"
    if "/arabic_pdf/" in low:
        return "Arab"
    return "Arab"

def collect(name, root):
    base=ASSETS/"library"/name
    usedp={}; useda={}
    pdfs=[]; audios=[]; htmls=[]
    files=[p for p in root.rglob("*") if p.is_file()]
    print("[scan]",name,len(files),"files")

    ba_titles={}
    ba_arab_with_id=set()
    if name=="baalwi":
        ba_titles,ba_arab_with_id=load_baalwi_exact_titles(root)

    seq=0
    for p in files:
        ext=p.suffix.lower()
        if ext==".pdf":
            seq+=1
            rel=copy_unique(p,base/"pdf",usedp)
            lang=detect_pdf_language(p)
            hidden=False
            raw_title=""

            if name=="baalwi":
                raw_title=ba_titles.get(p.name.lower(),"")
                # Show Indonesian PDFs, plus Arabic-only books that have no Indonesian PDF.
                hidden = lang not in {"Indonesia","Arab"} or (lang=="Arab" and p.name.lower() in ba_arab_with_id)
                title=normalize_title_text(raw_title)
                if not title_is_clear(title) or mostly_arabic(title):
                    title="Kitab BaAlwi"
            elif name=="khulasah":
                key=p.stem.upper()
                raw_title=KHULASAH_ID_TITLES.get(key,"")
                title=normalize_title_text(raw_title)
                hidden=False
                lang="Indonesia"
                if not title_is_clear(title):
                    title="Bacaan Al-Khulasah"
            else:
                mapped=load_sqlite_title_map(root) if False else ""
                raw_title=pdf_title(p,p.stem)
                title=final_display_title(raw_title,name,seq)

            pdfs.append({
                "title":title,
                "rawTitle":normalize_title_text(raw_title),
                "path":"library/%s/pdf/%s"%(name,rel),
                "source":name,
                "type":"pdf",
                "sourcePath":str(p.relative_to(root))[:300],
                "lang":lang,
                "hidden":bool(hidden)
            })
        elif ext in AUDIO_EXT:
            rel=copy_unique(p,base/"audio",useda)
            audios.append({"title":slug(p.stem,120),"path":"library/%s/audio/%s"%(name,rel),"source":name,"type":"audio","sourcePath":str(p.relative_to(root))[:300]})

    pdfs.sort(key=lambda x:x["title"].lower())
    audios.sort(key=lambda x:x["title"].lower())
    htmls.sort(key=lambda x:x["title"].lower())
    visible=[e for e in pdfs if not e.get("hidden")]
    generic=[e for e in visible if e["title"] in {"Kitab BaAlwi","Bacaan Al-Khulasah"}]
    bad=[e for e in visible if not title_is_clear(e["title"]) or mostly_arabic(e["title"]) or any(x in e["title"] for x in ["�","Ã","Â","â€"])]
    print("[title-audit]",name,"total",len(pdfs),"visible",len(visible),"hidden",len(pdfs)-len(visible),"generic",len(generic),"bad",len(bad))
    if bad:
        print("[title-audit-bad]",[(e["title"],e.get("rawTitle",""),e.get("sourcePath","")) for e in bad[:25]])
        raise RuntimeError("Unreadable visible titles remain in "+name)
    if name in {"baalwi","khulasah"} and generic:
        print("[title-generic]",name,[(e["sourcePath"],e["rawTitle"]) for e in generic[:30]])
        raise RuntimeError("Unmapped visible titles remain in "+name)

    return {"pdfs":pdfs,"audios":audios,"html":htmls}

def collect_rawi_complete(root):
    base=ASSETS/"library"/"rawi_complete"
    text_ext={".html",".htm",".js",".json",".txt",".xml",".css",".dart"}
    markers={
        "Maulid Barzanji":[r"barzanji",r"barzan"],
        "Maulid Simthud Durar":[r"simt.{0,12}dur",r"simth.{0,12}dur"],
        "Maulid Adh-Dhiyaul Lami":[r"dhiya.{0,14}lami",r"dhiy.{0,14}lami"],
        "Maulid Azab":[r"maulid.{0,30}azab",r"rawi.{0,30}azab",r"al[- ]?azab",r"azab"],
        "Maulid Ad-Diba'i":[r"maulid.{0,30}diba",r"rawi.{0,30}diba",r"ad[- ]?diba",r"dibai"],
        "Qasidah Burdah":[r"burdah",r"burda"]
    }
    matches={k:[] for k in markers}
    entry_candidates=[]
    asset_dirs=[p for p in root.rglob("assets") if p.is_dir()]
    copied=[]
    for idx,ad in enumerate(sorted(asset_dirs,key=lambda p:len(p.parts))):
        dst=base/("assets%d"%idx)
        try:
            shutil.copytree(ad,dst,dirs_exist_ok=True);copied.append(dst)
        except Exception as e: print("[rawi-copy-warn]",ad,e)
    for dstroot in copied:
        for p in dstroot.rglob("*"):
            if not p.is_file(): continue
            rel=str(p.relative_to(ASSETS)).replace("\\","/")
            if p.name.lower()=="index.html": entry_candidates.append(rel)
            if p.suffix.lower() in text_ext and p.stat().st_size<=15*1024*1024:
                try: txt=p.read_text("utf-8",errors="ignore").lower()
                except Exception: continue
                for label,pats in markers.items():
                    if any(re.search(pat,txt,re.I|re.S) for pat in pats):
                        if len(matches[label])<20: matches[label].append(rel)
    generic=collect("rawi_complete",root)
    ranked=sorted(entry_candidates,key=lambda x:(0 if "/www/" in x or "/public/" in x else 1,len(x)))
    generic["appEntry"]=ranked[0] if ranked else ""
    generic["matches"]=matches
    for label,arr in matches.items(): print("[rawi-match]",label,"=>",arr[:8])
    print("[rawi-entry]",generic["appEntry"])
    return generic

def quran():
    qdir=ASSETS/"quran"; qdir.mkdir(parents=True,exist_ok=True); idx=[]
    for n in range(1,115):
        last=None
        for k in range(4):
            try:
                r=S.get(QURAN.format(n=n),timeout=60); r.raise_for_status(); data=r.json()
                (qdir/("%d.json"%n)).write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
                tr=data.get("name_translations") or {}
                idx.append({"number":data.get("number_of_surah",n),"name":data.get("name","Surah %d"%n),"arabic":tr.get("ar",""),"meaning":tr.get("id",""),"ayah":data.get("number_of_ayah",0)})
                break
            except Exception as e:
                last=e; time.sleep(k+1)
        else: raise RuntimeError("Quran %d failed: %s"%(n,last))
        if n%10==0 or n==114: print("[quran]",n,"/114")
    (qdir/"index.json").write_text(json.dumps(idx,ensure_ascii=False),encoding="utf-8")

def vendor():
    for rel,urls in PDFJS.items():
        out=ASSETS/rel; out.parent.mkdir(parents=True,exist_ok=True); last=None
        for u in urls:
            try:
                r=S.get(u,timeout=90); r.raise_for_status()
                if len(r.content)<50000: raise RuntimeError("too small")
                out.write_bytes(r.content); print("[vendor]",rel,len(r.content)); break
            except Exception as e: last=e
        else: raise RuntimeError("vendor %s failed: %s"%(rel,last))

def add_rawindroid_aliases(catalog):
    pool = catalog["sources"]["baalwi"]["pdfs"] + catalog["sources"]["khulasah"]["pdfs"]

    wanted = [
        ("Maulid Barzanji", [
            r"\bbarzanji\b", r"\bbarzan\b", r"البرزنجي", r"مولد.{0,40}برزنجي"
        ]),
        ("Maulid Simthud Durar", [
            r"simt.{0,12}dur", r"simth.{0,12}dur", r"سمط.{0,12}الدرر", r"مولد.{0,40}سمط"
        ]),
        ("Maulid Adh-Dhiyaul Lami", [
            r"dhiya.{0,12}lami", r"dhiyā.{0,12}lāmi", r"الضياء.{0,12}اللامع", r"مولد.{0,40}الضياء"
        ]),
        ("Maulid Azab", [
            r"maulid.{0,25}(al[- ]?)?azab", r"maulid.{0,25}(al[- ]?)?azb",
            r"مولد.{0,25}العزب", r"مولد.{0,25}عزب"
        ]),
        ("Maulid Ad-Diba'i", [
            r"maulid.{0,25}(ad[- ]?)?diba", r"maulid.{0,25}(al[- ]?)?diba",
            r"مولد.{0,25}الديبعي", r"مولد.{0,25}الدباعي", r"الديبعي"
        ]),
        ("Qasidah Burdah", [
            r"qash?i?dah.{0,15}burdah", r"qasida.{0,15}burda", r"قصيدة.{0,15}البردة", r"البردة"
        ])
    ]

    cache = {}
    def probe(e):
        path=e["path"]
        if path in cache:
            return cache[path]
        pieces=[e.get("title",""),e.get("sourcePath","")]
        try:
            p=ASSETS/path
            rd=PdfReader(str(p))
            meta=rd.metadata
            if meta:
                pieces += [
                    str(getattr(meta,"title","") or ""),
                    str(getattr(meta,"subject","") or ""),
                    str(getattr(meta,"author","") or "")
                ]
            for pg in rd.pages[:4]:
                try:
                    pieces.append(pg.extract_text() or "")
                except Exception:
                    pass
        except Exception:
            pass
        text=re.sub(r"\s+"," "," ".join(pieces)).lower()
        cache[path]=text
        return text

    aliases=[]
    used=set()
    for label,patterns in wanted:
        best=None
        for i,e in enumerate(pool):
            if e["path"] in used:
                continue
            hay=probe(e)
            if any(re.search(p,hay,re.I|re.S) for p in patterns):
                best=e
                break
            if i and i%200==0:
                print("[rawindroid-scan]",label,i,"/",len(pool))
        if best is None:
            print("[rawindroid-missing]",label)
            continue
        alias=dict(best)
        alias["title"]=label
        alias["source"]="rawindroid"
        alias["deduplicated"]=True
        aliases.append(alias)
        used.add(best["path"])
        print("[rawindroid]",label,"->",best.get("title"),best.get("path"))
    catalog["sources"]["rawindroid"]={"pdfs":aliases,"audios":[],"html":[]}
    return len(aliases)

def main():
    shutil.rmtree(ASSETS,ignore_errors=True); ASSETS.mkdir(parents=True,exist_ok=True)
    shutil.rmtree(WORK,ignore_errors=True); WORK.mkdir(parents=True,exist_ok=True)
    vendor(); quran()
    catalog={"version":"2.4.0","offline":True,"sources":{}}
    for name,cfg in SOURCES.items():
        arc=WORK/(name+".zip")
        download(name,cfg,arc)
        ext=WORK/(name+"_extracted")
        explode(arc,ext)
        if name=="rawi_complete":
            catalog["sources"][name]=collect_rawi_complete(ext)
        else:
            catalog["sources"][name]=collect(name,ext)

    # Build the six Rawindroid/Maulid entries from the exact local HTML books.
    exact_files = [
        ("Maulid Simthud Durar", "1.sim.html"),
        ("Maulid Barzanji", "2.bar.html"),
        ("Maulid Adh-Dhiyaul Lami'", "3.dhi.html"),
        ("Maulid Ad-Diba'i", "4.diba.html"),
        ("Maulid Azab", "5.azab.html"),
        ("Qasidah Burdah", "6.burdah.html"),
    ]
    raw_html=[]
    all_match_paths=set()
    for arr in catalog["sources"]["rawi_complete"].get("matches",{}).values():
        all_match_paths.update(arr)
    for label,filename in exact_files:
        candidates=[p for p in all_match_paths if p.endswith("/"+filename)]
        if not candidates:
            # fallback to the copied asset tree if the marker scanner missed one
            candidates=[
                str(p.relative_to(ASSETS)).replace("\\","/")
                for p in (ASSETS/"library"/"rawi_complete").rglob(filename)
            ]
        if not candidates:
            raise RuntimeError("Missing exact local Maulid file: "+filename)
        raw_html.append({
            "title":label,
            "path":sorted(candidates,key=len)[0],
            "source":"rawindroid",
            "type":"html"
        })
    catalog["sources"]["rawindroid"]={"pdfs":[],"audios":[],"html":raw_html}
    alias_count=len(raw_html)
    print("[rawindroid-exact]",[(e["title"],e["path"]) for e in raw_html])

    for f in ["index.html","style.css","app.js"]:
        shutil.copy2(WEBTPL/f,ASSETS/f)

    # Reuse the app's own local logo inside the offline WebView.
    brand_dir=ASSETS/"brand"
    brand_dir.mkdir(parents=True,exist_ok=True)
    logo_src=ROOT/"app"/"icon-source.webp"
    if not logo_src.exists():
        raise RuntimeError("Majelis Mengaji logo asset missing")
    shutil.copy2(logo_src,brand_dir/"logo.webp")
    (ASSETS/"catalog.json").write_text(
        json.dumps(catalog,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8"
    )
    audit={}
    for src in ["baalwi","khulasah"]:
        entries=catalog["sources"][src]["pdfs"]
        audit[src]={
            "total":len(entries),
            "visible":sum(1 for e in entries if not e.get("hidden")),
            "hiddenEnglish":sum(1 for e in entries if e.get("hidden")),
            "generic":sum(1 for e in entries if e["title"] in {"Kitab BaAlwi","Bacaan Al-Khulasah"}),
            "titles":[e["title"] for e in entries if not e.get("hidden")]
        }
    (ASSETS/"title_audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding="utf-8")

    totalpdf=sum(len(v["pdfs"]) for v in catalog["sources"].values())
    totalaudio=sum(len(v["audios"]) for v in catalog["sources"].values())
    print("[done] PDF",totalpdf,"audio",totalaudio,"Rawindroid exact HTML",alias_count)

    # Hard build gates: never publish an empty/partial APK again.
    if len(catalog["sources"]["baalwi"]["pdfs"]) < 700:
        raise RuntimeError("BaAlwi incomplete")
    if len(catalog["sources"]["khulasah"]["pdfs"]) < 50:
        raise RuntimeError("Al-Khulasah incomplete")
    if len(catalog["sources"]["rawindroid"]["html"]) != 6:
        raise RuntimeError("Rawindroid exact HTML incomplete")
    if len(json.loads((ASSETS/"quran/index.json").read_text("utf-8"))) != 114:
        raise RuntimeError("Quran incomplete")
    if not (ASSETS/"index.html").exists() or not (ASSETS/"catalog.json").exists():
        raise RuntimeError("Offline UI missing")
    if not (ASSETS/"brand"/"logo.webp").exists():
        raise RuntimeError("Brand logo missing")

if __name__=="__main__":
    main()
