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
        "pages": [
            "https://apkpure.net/baalwi/com.baalwi/download",
            "https://apkpure.net/id/baalwi/com.baalwi",
            "https://baalwi.en.uptodown.com/android/download"
        ]
    },
    "khulasah": {
        "urls": [
            "https://d.apkpure.com/b/XAPK/com.praylatest.activities?version=latest",
            "https://d.apkpure.com/b/APK/com.praylatest.activities?version=latest"
        ],
        "pages": [
            "https://apkpure.net/alkhulasah/com.praylatest.activities/download",
            "https://apkpure.net/id/alkhulasah/com.praylatest.activities/download/4.2.2",
            "https://www.apkturbo.com/apps/alkhulasah/com.praylatest.activities/"
        ]
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
            pdfs.append({"title":slug(p.stem,120),"path":"library/%s/pdf/%s"%(name,rel),"source":name,"type":"pdf","sourcePath":str(p.relative_to(root))[:300]})
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

def main():
    shutil.rmtree(ASSETS,ignore_errors=True); ASSETS.mkdir(parents=True,exist_ok=True)
    shutil.rmtree(WORK,ignore_errors=True); WORK.mkdir(parents=True,exist_ok=True)
    vendor(); quran()
    catalog={"version":"1.9.4","offline":True,"sources":{}}
    for name,urls in SOURCES.items():
        arc=WORK/(name+".zip"); download(name,urls,arc); ext=WORK/(name+"_extracted"); explode(arc,ext); catalog["sources"][name]=collect(name,ext)
    for f in ["index.html","style.css","app.js"]:
        shutil.copy2(WEBTPL/f,ASSETS/f)
    (ASSETS/"catalog.json").write_text(json.dumps(catalog,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    totalpdf=sum(len(v["pdfs"]) for v in catalog["sources"].values())
    totalhtml=sum(len(v["html"]) for v in catalog["sources"].values())
    print("[done] PDF",totalpdf,"HTML",totalhtml)
    if totalpdf<20: raise RuntimeError("incomplete sources: too few PDFs")
    if len(catalog["sources"]["rawindroid"]["pdfs"])<4: raise RuntimeError("Rawindroid overlapping maulid titles incomplete")
    if len(json.loads((ASSETS/"quran/index.json").read_text("utf-8")))!=114: raise RuntimeError("Quran incomplete")

if __name__=="__main__": main()
