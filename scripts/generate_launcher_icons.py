from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "app" / "icon-source.webp"
RES = ROOT / "app" / "src" / "main" / "res"

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

img = Image.open(SRC).convert("RGB")

for folder, size in DENSITIES.items():
    out_dir = RES / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    icon = img.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(out_dir / "ic_launcher.png", optimize=True)
    icon.save(out_dir / "ic_launcher_round.png", optimize=True)

print("Majelis Mengaji launcher icons generated.")
