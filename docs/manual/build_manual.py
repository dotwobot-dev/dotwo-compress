"""Render the editable Spanish quick guide as two A4 pages."""
import json
from pathlib import Path
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DATA = json.loads((HERE / "content.json").read_text(encoding="utf-8"))
OUT = ROOT / f"output/pdf/DoTwo_Compress_Manual_Rapido_{DATA['version']}.pdf"
W, H = A4
M = 32
WIDTH = W - 2 * M
GAP = 22
COL = (WIDTH - GAP) / 2
INK = colors.HexColor("#1c232b")
BLUE = colors.HexColor("#0878ff")
MUTED = colors.HexColor("#53606d")
LINE = colors.HexColor("#d9e2e9")
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("Manual", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("ManualBold", str(FONT_DIR / "Arial Bold.ttf")))
pdfmetrics.registerFontFamily("Manual", normal="Manual", bold="ManualBold", italic="Manual", boldItalic="ManualBold")
BODY = ParagraphStyle("body", fontName="Manual", fontSize=9.3, leading=12.2, textColor=INK)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8, leading=10.5, textColor=MUTED)

def text(c, value, x, top, width, style=BODY, limit=792):
    p = Paragraph(value, style)
    _, height = p.wrap(width, H)
    if top + height > limit:
        raise ValueError(f"Layout overflow: {value[:70]} ({top + height:.1f})")
    p.drawOn(c, x, H - top - height)
    return top + height

def picture(c, name, top, height=244):
    file = HERE / "assets" / name
    with Image.open(file) as image:
        iw, ih = image.size
    draw_w = min(WIDTH, height * iw / ih)
    draw_h = draw_w * ih / iw
    x = M + (WIDTH - draw_w) / 2
    c.drawImage(str(file), x, H - top - draw_h, width=draw_w, height=draw_h)
    c.setStrokeColor(LINE)
    c.rect(x, H - top - draw_h, draw_w, draw_h, fill=0, stroke=1)
    return top + draw_h

def header(c, chapter, subtitle):
    c.setFillColor(BLUE)
    c.rect(M, H - 39, 28, 3, fill=1, stroke=0)
    c.setFont("ManualBold", 8.5)
    c.setFillColor(MUTED)
    c.drawString(M + 38, H - 40, "GUÍA RÁPIDA / MACOS")
    c.setFillColor(INK)
    c.setFont("ManualBold", 24)
    c.drawString(M, H - 73, "DoTwo Compress")
    c.setFillColor(MUTED)
    c.setFont("Manual", 10.5)
    c.drawString(M, H - 93, subtitle)
    c.setFillColor(LINE)
    c.setFont("ManualBold", 30)
    c.drawRightString(W - M, H - 73, f"0{chapter}")

def footer(c, page):
    c.setStrokeColor(LINE)
    c.line(M, 31, W - M, 31)
    c.setFillColor(MUTED)
    c.setFont("Manual", 7.8)
    c.drawString(M, 18, f"DoTwo / v{DATA['version']} / {DATA['date']} / Capturas reales con vídeos de demostración")
    c.drawRightString(W - M, 18, f"{page} / 2")

def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle(f"DoTwo Compress - Manual rápido {DATA['version']}")
    c.setAuthor("Domingo Moreno / DoTwo")
    c.setSubject("Instalación, revisión, recortes, cola y conversión K2/H.264")
    for number, filename, caption in [(1, "review-detail.png", "Proxy, inspector y selección IN/OUT de un clip de demostración."),
                                     (2, "queue-detail.png", "Cola real y salida guardada: orden, recortes y acceso al archivo en Finder.")]:
        data = DATA[f"page{number}"]
        header(c, number, data["subtitle"])
        bottom = picture(c, filename, 110, 242)
        if number == 2:
            bottom = picture(c, "result-detail.png", bottom + 10, 92)
        text(c, caption, M, bottom + 6, WIDTH, SMALL)
        start = bottom + 31
        for side, x in [("left", M), ("right", M + COL + GAP)]:
            top = start
            for item in data[side]:
                c.setFillColor(BLUE)
                c.setFont("ManualBold", 11)
                c.drawString(x, H - top - 11, item["title"])
                top = text(c, item["text"], x, top + 19, COL) + 16
        footer(c, number)
        if number == 1:
            c.showPage()
    c.save()
    print(OUT)

if __name__ == "__main__":
    build()
