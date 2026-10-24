"""Subset the two display fonts (both SIL OFL 1.1).

ZCOOL KuaiLe covers the Chinese characters the UI code uses; Fredoka (bold
instance) covers ASCII so digits and Latin letters stay round and upright.

Usage: python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
       /tmp/fontenv/bin/python scripts/subset-font.py ZCOOLKuaiLe-Regular.ttf "Fredoka[wdth,wght].ttf"
Sources: https://github.com/google/fonts/tree/main/ofl/zcoolkuaile
         https://github.com/google/fonts/tree/main/ofl/fredoka
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = [*ROOT.glob("web/src/**/*.ts"), *ROOT.glob("web/src/**/*.tsx"),
           ROOT / "shared/catalog.ts", ROOT / "shared/games/red-thread/levels.ts",
           ROOT / "shared/games/heartbeat/chart.ts"]
EXTRA = "，。！？：；、「」…—·（）《》“”‘’～♥♡★☆✓×＋－"
text = "".join(p.read_text(encoding="utf-8") for p in SOURCES)
chars = sorted({c for c in text if "㐀" <= c <= "鿿"} | set(EXTRA))
out = ROOT / "web/src/assets/fonts"
(out / "duo-display.chars.txt").write_text("".join(chars), encoding="utf-8")
tool = pathlib.Path(sys.executable).with_name("pyftsubset")
subprocess.run([str(tool), sys.argv[1], "--text-file=" + str(out / "duo-display.chars.txt"),
                "--flavor=woff2", "--layout-features=*",
                "--output-file=" + str(out / "duo-display.woff2")], check=True)
print(len(chars), "glyphs ->", (out / "duo-display.woff2").stat().st_size, "bytes")
if len(sys.argv) > 2:
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    bold = out / "fredoka-bold.ttf"
    instancer.instantiateVariableFont(TTFont(sys.argv[2]), {"wght": 650, "wdth": 100}).save(bold)
    subprocess.run([str(tool), str(bold), "--unicodes=U+0020-007E,U+00B7,U+2022",
                    "--flavor=woff2", "--layout-features=*",
                    "--output-file=" + str(out / "duo-latin.woff2")], check=True)
    bold.unlink()
    print("latin ->", (out / "duo-latin.woff2").stat().st_size, "bytes")
