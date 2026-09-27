package com.mrobbie.majelismengaji;

import android.content.Context;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class SyncManager {
    public interface Listener {
        void onCoreReady();
        void onProgress(String message);
        void onFinished();
    }

    private static final String BASE = "https://mrobbie.com";
    private static final String PAGE_URL = BASE + "/majelis-ngaji/";
    private static final String ASSET_BASE = BASE + "/wp-content/plugins/majelis-ngaji/assets/";
    private static final String REST_BASE = BASE + "/wp-json/majelis-ngaji/v1";
    private static final String AUDIO_BASE = BASE + "/?mngaji_audio=1";

    private final Context context;
    private final File root;
    private final File assetsDir;
    private final File apiDir;
    private final File audioDir;

    public SyncManager(Context context) {
        this.context = context.getApplicationContext();
        this.root = new File(context.getFilesDir(), "majelis-offline");
        this.assetsDir = new File(root, "assets");
        this.apiDir = new File(root, "api");
        this.audioDir = new File(root, "audio");
        ensureDirs();
    }

    private void ensureDirs() {
        root.mkdirs();
        assetsDir.mkdirs();
        apiDir.mkdirs();
        audioDir.mkdirs();
    }

    public File getCachedIndex() {
        return new File(root, "index.html");
    }

    public boolean hasOfflineCore() {
        return getCachedIndex().isFile()
                && new File(assetsDir, "app.js").isFile()
                && new File(assetsDir, "app.css").isFile()
                && new File(apiDir, "surahs.json").isFile();
    }

    public void startFullSync(Listener listener) {
        new Thread(() -> {
            try {
                ensureDirs();
                syncCore(listener);
                if (listener != null) listener.onCoreReady();
                syncAudio(listener);
            } catch (Exception ignored) {
            } finally {
                if (listener != null) listener.onFinished();
            }
        }, "MajelisSync").start();
    }

    private void syncCore(Listener listener) {
        tryDownload(PAGE_URL, getCachedIndex());

        List<String> files = new ArrayList<>();
        files.add("app.css");
        files.add("app.js");
        files.add("logo-majelis.png");
        files.add("habib-husein.jpg");
        files.add("poster-majelis.jpg");
        files.add("data/haddad.json");
        files.add("data/attas.json");
        files.add("data/birrul.json");

        for (int p = 2; p <= 16; p++) files.add("books/yasin/" + pad3(p) + ".webp");
        for (int p = 17; p <= 38; p++) files.add("books/tahlil/" + pad3(p) + ".webp");
        for (int p = 3; p <= 64; p++) files.add("books/simtud/" + pad3(p) + ".webp");

        int i = 0;
        for (String rel : files) {
            i++;
            File dest = new File(assetsDir, rel);
            tryDownload(ASSET_BASE + rel, dest);
            if (listener != null && i % 10 == 0) listener.onProgress("Menyimpan bacaan offline " + i + "/" + files.size());
        }

        File surahs = new File(apiDir, "surahs.json");
        tryDownload(REST_BASE + "/surahs", surahs);

        for (int s = 1; s <= 114; s++) {
            File dest = new File(apiDir, "surah-" + pad3(s) + ".json");
            tryDownload(REST_BASE + "/surah/" + s, dest);
            if (listener != null && (s == 1 || s % 10 == 0 || s == 114)) {
                listener.onProgress("Al-Qur'an offline " + s + "/114 surah");
            }
        }
    }

    private void syncAudio(Listener listener) {
        for (int s = 1; s <= 114; s++) {
            int total = getAyahCount(s);
            if (total <= 0) continue;
            File surahAudio = new File(audioDir, pad3(s));
            surahAudio.mkdirs();

            for (int a = 1; a <= total; a++) {
                File dest = new File(surahAudio, pad3(a) + ".mp3");
                if (dest.isFile() && dest.length() > 1024) continue;
                String url = AUDIO_BASE + "&surah=" + s + "&ayah=" + a;
                tryDownload(url, dest);
            }

            if (listener != null && (s == 1 || s % 5 == 0 || s == 114)) {
                listener.onProgress("Audio offline " + s + "/114 surah");
            }
        }
    }

    private int getAyahCount(int surah) {
        File f = new File(apiDir, "surah-" + pad3(surah) + ".json");
        if (!f.isFile()) return 0;
        try {
            String txt = readAll(f);
            JSONObject root = new JSONObject(txt);
            JSONObject data = root.optJSONObject("data");
            if (data == null) data = root;
            JSONArray ayat = data.optJSONArray("ayat");
            return ayat == null ? 0 : ayat.length();
        } catch (Exception e) {
            return 0;
        }
    }

    private boolean tryDownload(String url, File dest) {
        try {
            return download(url, dest);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean download(String source, File dest) throws IOException {
        dest.getParentFile().mkdirs();
        File part = new File(dest.getAbsolutePath() + ".part");

        HttpURLConnection c = null;
        InputStream in = null;
        BufferedOutputStream out = null;
        try {
            c = (HttpURLConnection) new URL(source).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "MajelisMengajiAndroid/1.1");
            c.setRequestProperty("Accept", "*/*");
            int code = c.getResponseCode();
            if (code < 200 || code >= 300) return false;

            in = new BufferedInputStream(c.getInputStream());
            out = new BufferedOutputStream(new FileOutputStream(part));
            byte[] buf = new byte[32768];
            int n;
            while ((n = in.read(buf)) >= 0) {
                if (n > 0) out.write(buf, 0, n);
            }
            out.flush();

            if (!part.isFile() || part.length() == 0) return false;
            if (dest.exists() && !dest.delete()) return false;
            return part.renameTo(dest);
        } finally {
            try { if (in != null) in.close(); } catch (Exception ignored) {}
            try { if (out != null) out.close(); } catch (Exception ignored) {}
            if (c != null) c.disconnect();
            if (part.exists() && (!dest.exists() || dest.length() == 0)) part.delete();
        }
    }

    public WebResourceResponse intercept(String url) {
        if (url == null) return null;
        try {
            Uri uri = Uri.parse(url);
            if (!"mrobbie.com".equalsIgnoreCase(uri.getHost())) return null;

            File f = null;
            String path = uri.getPath() == null ? "" : uri.getPath();

            if ("/majelis-ngaji/".equals(path) || "/majelis-ngaji".equals(path)) {
                f = getCachedIndex();
            } else if (path.contains("/wp-content/plugins/majelis-ngaji/assets/")) {
                String marker = "/wp-content/plugins/majelis-ngaji/assets/";
                int pos = path.indexOf(marker);
                String rel = path.substring(pos + marker.length());
                f = new File(assetsDir, rel);
            } else if (path.equals("/wp-json/majelis-ngaji/v1/surahs")) {
                f = new File(apiDir, "surahs.json");
            } else if (path.startsWith("/wp-json/majelis-ngaji/v1/surah/")) {
                String tail = path.substring(path.lastIndexOf('/') + 1);
                try {
                    int s = Integer.parseInt(tail);
                    f = new File(apiDir, "surah-" + pad3(s) + ".json");
                } catch (Exception ignored) {}
            } else if (path.equals("/") && "1".equals(uri.getQueryParameter("mngaji_audio"))) {
                try {
                    int s = Integer.parseInt(uri.getQueryParameter("surah"));
                    int a = Integer.parseInt(uri.getQueryParameter("ayah"));
                    f = new File(new File(audioDir, pad3(s)), pad3(a) + ".mp3");
                } catch (Exception ignored) {}
            }

            if (f == null || !f.isFile() || f.length() == 0) return null;
            String mime = mimeFor(f.getName());
            return new WebResourceResponse(mime, "UTF-8", new FileInputStream(f));
        } catch (Exception e) {
            return null;
        }
    }

    private String mimeFor(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        String ext = MimeTypeMap.getFileExtensionFromUrl(name);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime == null ? "application/octet-stream" : mime;
    }

    public static String fileUrl(File file) {
        return Uri.fromFile(file).toString();
    }

    private String readAll(File f) throws IOException {
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] data = new byte[(int) f.length()];
            int off = 0;
            while (off < data.length) {
                int n = in.read(data, off, data.length - off);
                if (n < 0) break;
                off += n;
            }
            return new String(data, 0, off, StandardCharsets.UTF_8);
        }
    }

    private static String pad3(int n) {
        return String.format(java.util.Locale.US, "%03d", n);
    }
}
