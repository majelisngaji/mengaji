#!/usr/bin/env python3
import hashlib
import json
import re
import shutil
import time
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

def collect(name, root):
    base=ASSETS/"library"/name
    usedp={}; useda={}
    pdfs=[]; audios=[]; htmls=[]
    files=[p for p in root.rglob("*") if p.is_file()]
    print("[scan]",name,len(files),"files")
    for p in files:
        ext=p.suffix.lower()
        if ext==".pdf":
            rel=copy_unique(p,base/"pdf",usedp)
            title=pdf_title(p,p.stem)
            lang=""
            low=p.stem.lower()
            if low.endswith("_in") or low.endswith("_id"): lang="Indonesia"
            elif low.endswith("_en"): lang="English"
            pdfs.append({"title":title,"path":"library/%s/pdf/%s"%(name,rel),"source":name,"type":"pdf","sourcePath":str(p.relative_to(root))[:300],"lang":lang})
        elif ext in AUDIO_EXT:
            rel=copy_unique(p,base/"audio",useda)
            audios.append({"title":slug(p.stem,120),"path":"library/%s/audio/%s"%(name,rel),"source":name,"type":"audio","sourcePath":str(p.relative_to(root))[:300]})
    pdfs.sort(key=lambda x:x["title"].lower()); audios.sort(key=lambda x:x["title"].lower()); htmls.sort(key=lambda x:x["title"].lower())
    print("[catalog]",name,len(pdfs),"PDF",len(audios),"audio",len(htmls),"HTML")
    return {"pdfs":pdfs,"audios":audios,"html":htmls}

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
    # Rawindroid's six Maulid titles overlap with the embedded BaAlwi/Al-Khulasah library.
    # Search filename/path first, then PDF metadata + first pages, and reuse the same local bytes.
    pool = catalog["sources"]["baalwi"]["pdfs"] + catalog["sources"]["khulasah"]["pdfs"]
    wanted = [
        ("Maulid Barzanji", ["barzan", "barzanji", "برزنجي", "البرزنجي"]),
        ("Maulid Simthud Durar", ["simt", "simth", "simtudduror", "simtuddurar", "سمط", "الدرر"]),
        ("Maulid Adh-Dhiyaul Lami", ["dhiya", "dhiy", "lami", "ضياء", "الضياء", "اللامع"]),
        ("Maulid Azab", ["azab", "azb", "عزب", "العزب"]),
        ("Maulid Ad-Diba'i", ["diba", "dibai", "الدباعي", "ديبع"]),
        ("Qasidah Burdah", ["burd", "burdah", "البردة", "بردة"])
    ]
    aliases = []
    used_paths = set()

    def searchable(e):
        return (e.get("title","") + " " + e.get("sourcePath","")).lower()

    def pdf_probe(e):
        try:
            p = ASSETS / e["path"]
            rd = PdfReader(str(p))
            parts = []
            meta = rd.metadata
            if meta:
                parts.extend([str(getattr(meta,"title","") or ""), str(getattr(meta,"subject","") or "")])
            for pg in rd.pages[:2]:
                try:
                    parts.append(pg.extract_text() or "")
                except Exception:
                    pass
            return " ".join(parts).lower()
        except Exception:
            return ""

    probes = {}
    for label, keys in wanted:
        hit = None
        # fast path: filename/source path
        for e in pool:
            if e["path"] in used_paths: continue
            hay = searchable(e)
            if any(k.lower() in hay for k in keys):
                hit = e; break

        # slow path: inspect PDF metadata/text
        if hit is None:
            print("[rawindroid-scan-text]", label)
            for i,e in enumerate(pool):
                if e["path"] in used_paths: continue
                path=e["path"]
                if path not in probes:
                    probes[path]=pdf_probe(e)
                hay=probes[path]
                if any(k.lower() in hay for k in keys):
                    hit=e; break
                if i and i % 150 == 0:
                    print("[rawindroid-scan]", label, i, "/", len(pool))

        if hit is not None:
            alias = dict(hit)
            alias["title"] = label
            alias["source"] = "rawindroid"
            alias["deduplicated"] = True
            aliases.append(alias)
            used_paths.add(hit["path"])
            print("[rawindroid]", label, "->", hit.get("title"), hit.get("path"))
        else:
            print("[rawindroid-missing]", label)

    catalog["sources"]["rawindroid"] = {"pdfs": aliases, "audios": [], "html": []}
    return len(aliases)

def main():
    shutil.rmtree(ASSETS,ignore_errors=True); ASSETS.mkdir(parents=True,exist_ok=True)
    shutil.rmtree(WORK,ignore_errors=True); WORK.mkdir(parents=True,exist_ok=True)
    vendor(); quran()
    catalog={"version":"2.0.0","offline":True,"sources":{}}
    for name,cfg in SOURCES.items():
        arc=WORK/(name+".zip")
        download(name,cfg,arc)
        ext=WORK/(name+"_extracted")
        explode(arc,ext)
        catalog["sources"][name]=collect(name,ext)

    alias_count = add_rawindroid_aliases(catalog)

    for f in ["index.html","style.css","app.js"]:
        shutil.copy2(WEBTPL/f,ASSETS/f)
    (ASSETS/"catalog.json").write_text(
        json.dumps(catalog,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8"
    )

    totalpdf=sum(len(v["pdfs"]) for v in catalog["sources"].values())
    totalaudio=sum(len(v["audios"]) for v in catalog["sources"].values())
    print("[done] PDF",totalpdf,"audio",totalaudio,"Rawindroid aliases",alias_count)

    # Hard build gates: never publish an empty/partial APK again.
    if len(catalog["sources"]["baalwi"]["pdfs"]) < 700:
        raise RuntimeError("BaAlwi incomplete")
    if len(catalog["sources"]["khulasah"]["pdfs"]) < 50:
        raise RuntimeError("Al-Khulasah incomplete")
    if len(json.loads((ASSETS/"quran/index.json").read_text("utf-8"))) != 114:
        raise RuntimeError("Quran incomplete")
    if not (ASSETS/"index.html").exists() or not (ASSETS/"catalog.json").exists():
        raise RuntimeError("Offline UI missing")

if __name__=="__main__":
    main()
