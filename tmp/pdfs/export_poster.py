from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
TMP_DIR = ROOT / "tmp" / "pdfs"
OUTPUT_DIR = ROOT / "output" / "pdf"
A3_PDF = TMP_DIR / "liquidcache-poster-a3-vector.pdf"
BACKGROUND_PDF = TMP_DIR / "poster-background-36x48.pdf"
FINAL_PDF = OUTPUT_DIR / "liquidcache-vldb-2026-poster-36x48.pdf"

PAGE_WIDTH = 36 * 72
PAGE_HEIGHT = 48 * 72


def main() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    source_reader = PdfReader(str(A3_PDF))
    if len(source_reader.pages) != 1:
        raise RuntimeError(f"Expected one poster page, got {len(source_reader.pages)}")
    source_page = source_reader.pages[0]
    source_width = float(source_page.mediabox.width)
    source_height = float(source_page.mediabox.height)

    scale = min(PAGE_WIDTH / source_width, PAGE_HEIGHT / source_height)
    placed_width = source_width * scale
    placed_height = source_height * scale
    offset_x = (PAGE_WIDTH - placed_width) / 2
    offset_y = (PAGE_HEIGHT - placed_height) / 2

    background = canvas.Canvas(
        str(BACKGROUND_PDF), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), invariant=1
    )
    background.setFillColor(Color(251 / 255, 250 / 255, 247 / 255))
    background.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
    background.showPage()
    background.save()

    output_page = PdfReader(str(BACKGROUND_PDF)).pages[0]
    output_page.merge_transformed_page(
        source_page,
        Transformation(ctm=(scale, 0, 0, scale, offset_x, offset_y)),
        over=True,
    )

    writer = PdfWriter()
    writer.add_page(output_page)
    writer.add_metadata(
        {
            "/Title": "LiquidCache - VLDB 2026 Poster",
            "/Author": "Xiangpeng Hao et al.",
            "/Subject": "36 x 48 inch print-ready conference poster",
        }
    )
    with FINAL_PDF.open("wb") as stream:
        writer.write(stream)

    print(FINAL_PDF)
    print(f"source_points={source_width:.2f}x{source_height:.2f}")
    print(f"page_points={PAGE_WIDTH:.2f}x{PAGE_HEIGHT:.2f}")
    print(f"placed_inches={placed_width / 72:.3f}x{placed_height / 72:.3f}")
    print(f"side_margin_inches={offset_x / 72:.3f}")


if __name__ == "__main__":
    main()
