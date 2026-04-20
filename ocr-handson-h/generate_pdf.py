import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, PageBreak, NextPageTemplate, KeepTogether
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors

OUT = os.path.join(os.path.dirname(__file__), "ocr_tech_scan.pdf")
W, H = letter
MARGIN = 0.85 * inch
FRAME_W = W - 2 * MARGIN

ACCENT = HexColor("#1F4E79")
ACCENT2 = HexColor("#2E75B6")
LIGHT_BG = HexColor("#EAF0F7")
HDR_BG = HexColor("#1F4E79")
HDR_FG = colors.white
ROW_ALT = HexColor("#F5F7FA")
BORDER_C = HexColor("#B4C6E7")
GRAY = HexColor("#666666")
DARK = HexColor("#222222")


# ── Styles ──────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

s_title = ParagraphStyle("CoverTitle", parent=styles["Title"],
    fontName="Helvetica-Bold", fontSize=36, leading=44,
    textColor=ACCENT, alignment=TA_CENTER, spaceAfter=10)

s_subtitle = ParagraphStyle("CoverSub", parent=styles["Normal"],
    fontName="Helvetica", fontSize=16, leading=22,
    textColor=GRAY, alignment=TA_CENTER, spaceAfter=6)

s_cover_tag = ParagraphStyle("CoverTag", parent=styles["Normal"],
    fontName="Helvetica-Oblique", fontSize=12, leading=16,
    textColor=HexColor("#999999"), alignment=TA_CENTER, spaceAfter=0)

s_h1 = ParagraphStyle("H1", parent=styles["Heading1"],
    fontName="Helvetica-Bold", fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=28, spaceAfter=10,
    borderPadding=(0, 0, 4, 0),
    borderWidth=0, borderColor=ACCENT)

s_h2 = ParagraphStyle("H2", parent=styles["Heading2"],
    fontName="Helvetica-Bold", fontSize=15, leading=20,
    textColor=ACCENT2, spaceBefore=18, spaceAfter=8)

s_h3 = ParagraphStyle("H3", parent=styles["Heading3"],
    fontName="Helvetica-Bold", fontSize=12, leading=16,
    textColor=HexColor("#404040"), spaceBefore=14, spaceAfter=6)

s_body = ParagraphStyle("Body", parent=styles["Normal"],
    fontName="Helvetica", fontSize=10, leading=14.5,
    textColor=DARK, alignment=TA_JUSTIFY, spaceBefore=3, spaceAfter=6)

s_bullet = ParagraphStyle("Bullet", parent=s_body,
    leftIndent=18, bulletIndent=6, spaceBefore=2, spaceAfter=3,
    bulletFontName="Helvetica", bulletFontSize=10)

s_num = ParagraphStyle("Numbered", parent=s_body,
    leftIndent=22, bulletIndent=4, spaceBefore=2, spaceAfter=3)

s_link = ParagraphStyle("Link", parent=s_body,
    fontName="Helvetica", fontSize=9, leading=12.5,
    textColor=ACCENT2, leftIndent=12, spaceBefore=1, spaceAfter=1)

s_cell = ParagraphStyle("Cell", fontName="Helvetica", fontSize=8,
    leading=10.5, textColor=DARK, alignment=TA_LEFT)

s_cell_hdr = ParagraphStyle("CellHdr", fontName="Helvetica-Bold", fontSize=8,
    leading=10.5, textColor=HDR_FG, alignment=TA_LEFT)

s_toc_h1 = ParagraphStyle("TOC1", fontName="Helvetica-Bold", fontSize=12,
    leading=18, leftIndent=0, textColor=ACCENT)
s_toc_h2 = ParagraphStyle("TOC2", fontName="Helvetica", fontSize=10,
    leading=16, leftIndent=18, textColor=DARK)


# ── Header / Footer drawing ────────────────────────────────────────────
def draw_header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFont("Helvetica-Oblique", 8.5)
        canvas.setFillColor(GRAY)
        canvas.drawString(MARGIN, H - 0.55 * inch,
                          "OCR Technology Landscape Scan \u2014 April 2026")
        canvas.setStrokeColor(BORDER_C)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 0.62 * inch, W - MARGIN, H - 0.62 * inch)
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(GRAY)
    canvas.drawCentredString(W / 2, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(ACCENT)
    canvas.rect(0, H - 0.18 * inch, W, 0.18 * inch, fill=True, stroke=False)
    canvas.setFillColor(ACCENT2)
    canvas.rect(0, 0, W, 0.08 * inch, fill=True, stroke=False)
    canvas.restoreState()


# ── Table helper ────────────────────────────────────────────────────────
def make_table(headers, rows, col_widths):
    data = [[Paragraph(h, s_cell_hdr) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, s_cell) for c in row])

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HDR_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), HDR_FG),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER_C),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))

    t = Table(data, colWidths=col_widths, repeatRows=1, splitInRow=False)
    t.setStyle(TableStyle(style_cmds))
    return t


# ── Shorthand builders ─────────────────────────────────────────────────
def h1(t):
    return Paragraph(t, s_h1)

def h2(t):
    return Paragraph(t, s_h2)

def h3(t):
    return Paragraph(t, s_h3)

def body(t):
    return Paragraph(t, s_body)

def bullet(t):
    return Paragraph(t, s_bullet, bulletText="\u2022")

def bbold(label, text):
    return Paragraph(f"<b>{label}</b>{text}", s_bullet, bulletText="\u2022")

def numbered(label, text, n):
    return Paragraph(f"<b>{label}</b>{text}", s_num, bulletText=f"{n}.")

def link(title, url):
    return Paragraph(f'<a href="{url}" color="#2E75B6">{title}</a>', s_link, bulletText="\u2022")

def divider():
    t = Table([[""]],  colWidths=[FRAME_W], rowHeights=[1])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, BORDER_C),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


# ── Comparison matrix data ──────────────────────────────────────────────
comp_headers = ["Tool", "Category", "Accuracy", "Cost/1K Pg", "Lang.", "Best For", "Maturity", "License"]
comp_widths = [82, 70, 80, 62, 36, 130, 58, 60]
comp_rows = [
    ["PaddleOCR-VL 1.5", "Open-source VLM", "94.5% OmniDocBench", "~$0.09", "109", "Complex docs, tables, formulas", "Production", "Apache 2.0"],
    ["Chandra v0.1.0", "Open-source VLM", "83.1% olmOCR", "Self-hosted", "90+", "Layout-aware extraction", "Early prod.", "Open-source"],
    ["Tesseract 5.5", "OS engine", "Moderate", "Free", "116", "Printed text, edge/offline", "Legacy", "Apache 2.0"],
    ["Mistral OCR v3", "Commercial API", "High (ELO 1409)", "$1.00", "Multi", "Structured docs, HWR", "Production", "Proprietary"],
    ["DeepSeek-OCR", "Open-source VLM", "75.7% olmOCR", "Self-hosted", "Multi", "On-premises deployment", "Production", "Open-source"],
    ["olmOCR-2", "Open-source", "82.4% olmOCR", "Self-hosted", "Multi", "High-throughput PDF", "Production", "Open-source"],
    ["Google Doc AI", "Cloud service", "95.8%", "$0.60\u2013$1.50", "200+", "Degraded docs, GCP", "Mature", "Proprietary"],
    ["AWS Textract", "Cloud service", "94.2%", "$1.50\u2013$65", "100+", "Table extraction, AWS", "Mature", "Proprietary"],
    ["Azure Doc Intel.", "Cloud service", "High", "$0.53\u2013$10", "100+", "Custom models, MSFT", "Mature", "Proprietary"],
    ["GPT-5.4", "Proprietary LLM", "Very high", "~$15", "50+", "Complex reasoning", "Mature", "Proprietary"],
    ["Gemini Flash 2.0", "Proprietary LLM", "High", "~$0.17", "100+", "Cost-effective LLM OCR", "Production", "Proprietary"],
    ["Qwen3-VL-235B", "Open-source LLM", "Near GPT-5", "Self-hosted", "32", "Multimodal understanding", "Production", "Open-source"],
    ["ABBYY Vantage", "Enterprise IDP", "Very high", "Enterprise", "200+", "Multilingual enterprise", "Mature", "Commercial"],
    ["Nanonets", "IDP platform", "High", "SaaS tiers", "Multi", "Doc automation", "Production", "Commercial"],
    ["Rossum", "IDP platform", "Self-improving", "$18K+/yr", "Multi", "Zero-template AP", "Production", "Commercial"],
    ["Veryfi", "IDP API", "98.7% invoice", "API tiers", "38", "Real-time receipts", "Production", "Commercial"],
    ["Transkribus", "Specialized", "High (trained)", "Freemium", "100+", "Historical handwriting", "Mature", "Commercial"],
]

rec_headers = ["Use Case", "Recommended Solution", "Why"]
rec_widths = [190, 150, 238]
rec_rows = [
    ["High-volume digitization (budget)", "PaddleOCR-VL 1.5", "Best accuracy at $0.09/1K pages; open-source"],
    ["Simple text extraction (edge)", "Tesseract 5.5", "Zero-cost; CPU-only; 10MB; 116 languages"],
    ["Enterprise AP automation", "Rossum / ABBYY Vantage", "Zero-template; compliance; HITL review"],
    ["Developer API for invoices", "Veryfi / Mindee", "98%+ accuracy; sub-3s; API-first"],
    ["Complex doc understanding + Q&A", "GPT-5 / Claude 4", "Best reasoning over document content"],
    ["Cost-effective LLM OCR at scale", "Gemini Flash 2.0", "6,000 pages/$1; strong accuracy"],
    ["On-premises / air-gapped", "DeepSeek-OCR / PaddleOCR-VL", "Self-hosted; data stays on-prem"],
    ["Historical handwriting", "Transkribus", "Custom model training; 100+ languages"],
    ["ID/passport/KYC", "Microblink / OCR Studio", "Purpose-built; regulatory compliance"],
    ["Microsoft ecosystem", "Azure Document Intelligence", "Custom training 30 min; on-prem containers"],
    ["AWS ecosystem", "AWS Textract", "Best table extraction; S3; serverless"],
    ["Multilingual (200+ languages)", "ABBYY FineReader Engine", "Unmatched language coverage"],
    ["Layout-critical documents", "Surya / Chandra", "Best reading-order; multi-column"],
    ["Handwriting-heavy forms", "Mistral OCR v3", "Outperforms alternatives; $1/1K pages"],
]

sources = [
    ("Best Open-Source OCR Tools in 2025 \u2014 Unstract", "https://unstract.com/blog/best-opensource-ocr-tools-in-2025/"),
    ("8 Top Open-Source OCR Models Compared \u2014 Modal", "https://modal.com/blog/8-top-open-source-ocr-models-compared"),
    ("Best OCR Models 2026: Benchmarks \u2014 CodeSOTA", "https://www.codesota.com/ocr"),
    ("7 Best Open-Source OCR Models 2025 \u2014 E2E Networks", "https://www.e2enetworks.com/blog/complete-guide-open-source-ocr-models-2025"),
    ("10 Awesome OCR Models for 2025 \u2014 KDnuggets", "https://www.kdnuggets.com/10-awesome-ocr-models-for-2025"),
    ("Technical Analysis of Non-LLM OCR Engines \u2014 IntuitionLabs", "https://intuitionlabs.ai/articles/non-llm-ocr-technologies"),
    ("AWS Textract vs Google Document AI vs Azure", "https://invoicedataextraction.com/blog/aws-textract-vs-google-document-ai-vs-azure-document-intelligence"),
    ("Best OCR Tools 2026 \u2014 AI Productivity", "https://aiproductivity.ai/blog/best-ocr-tools-2026/"),
    ("Document AI Cost Comparison \u2014 AI Productivity", "https://aiproductivity.ai/blog/document-ai-cost-comparison/"),
    ("Document Data Extraction 2026: LLMs vs OCRs \u2014 Vellum AI", "https://www.vellum.ai/blog/document-data-extraction-llms-vs-ocrs"),
    ("Top 10 Vision Language Models 2026 \u2014 DataCamp", "https://www.datacamp.com/blog/top-vision-language-models"),
    ("DeepSeek OCR vs Qwen-3 VL vs Mistral OCR \u2014 Analytics Vidhya", "https://www.analyticsvidhya.com/blog/2025/11/deepseek-ocr-vs-qwen-3-vl-vs-mistral-ocr/"),
    ("Mistral OCR \u2014 Mistral AI", "https://mistral.ai/news/mistral-ocr"),
    ("ABBYY Ascend 2025.2 AI Enhancements", "https://www.abbyy.com/company/news/abbyy-ascend-2025-2-ai-enterprise-automation/"),
    ("Invoice OCR Benchmark: Veryfi vs Google vs Mindee", "https://www.veryfi.com/ai-insights/invoice-ocr-competitors-veryfi/"),
    ("Rossum \u2014 Intelligent Document Processing", "https://rossum.ai/intelligent-document-processing/"),
    ("Best OCR APIs of 2026 \u2014 Mindee", "https://www.mindee.com/blog/leading-ocr-api-solutions"),
    ("Handwriting OCR \u2014 Transkribus", "https://www.transkribus.org/handwriting-ocr"),
    ("OCR Studio 2025 \u2014 ID Scanning Breakthroughs", "https://ocrstudio.ai/news/ocr-studio-announces-2025-results-marking-id-scanning-breakthroughs/"),
    ("ID Card OCR Technology \u2014 Microblink", "https://microblink.com/identity/id-card-ocr-technology/"),
    ("Comparing Top 6 OCR Systems 2025 \u2014 MarkTechPost", "https://www.marktechpost.com/2025/11/02/comparing-the-top-6-ocr-optical-character-recognition-models-systems-in-2025/"),
    ("Best Python OCR Library 2026 \u2014 CodeSOTA", "https://www.codesota.com/ocr/best-for-python"),
    ("OCR Technology in 2026 \u2014 Pixno", "https://photes.io/blog/posts/ocr-research-trend"),
]


# ── Build story ─────────────────────────────────────────────────────────
story = []

# -- Cover page --
story.append(Spacer(1, 2.2 * inch))
story.append(Paragraph("OCR Technology", s_title))
story.append(Paragraph("Landscape Scan", s_title))
story.append(Spacer(1, 0.15 * inch))

rule = Table([[""]],  colWidths=[3.2 * inch], rowHeights=[1])
rule.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 2.5, ACCENT), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
rule.hAlign = "CENTER"
story.append(rule)

story.append(Spacer(1, 0.25 * inch))
story.append(Paragraph("April 2026", s_subtitle))
story.append(Spacer(1, 0.2 * inch))
story.append(Paragraph("A comprehensive analysis of OCR tools, platforms, and approaches", s_cover_tag))

story.append(NextPageTemplate("content"))
story.append(PageBreak())

# -- Executive Summary --
story.append(h1("Executive Summary"))
story.append(body(
    "The OCR landscape in 2026 has undergone a paradigm shift: vision-language models (VLMs) now "
    "decisively outperform traditional OCR pipelines on complex documents, while costing orders of "
    "magnitude less at scale. Open-source models like PaddleOCR-VL 7B lead benchmarks ahead of "
    "GPT-5.4 and Gemini 2.5 Pro at $0.09/1K pages versus $15 for proprietary APIs \u2014 a 167x cost reduction."
))
story.append(body(
    "Traditional engines like Tesseract remain relevant only for edge/offline deployments, while the "
    "enterprise IDP market is consolidating around AI-native platforms that combine OCR with end-to-end "
    "document understanding. The October 2025 inflection point \u2014 when six major open-source OCR models "
    "launched in a single month \u2014 marked the moment open-source OCR became unambiguously superior to "
    "commercial APIs for most use cases."
))
story.append(divider())

# -- Landscape Overview --
story.append(h1("Landscape Overview"))

story.append(h2("Slice 1: Open-Source OCR Engines &amp; Libraries"))
story.append(body(
    "The open-source OCR ecosystem has bifurcated into two tiers: legacy pipeline-based engines "
    "(Tesseract, EasyOCR) that remain useful for simple extraction tasks, and modern VLM-based models "
    "(PaddleOCR-VL, Chandra, DeepSeek-OCR) that handle tables, formulas, and complex layouts natively. "
    "PaddleOCR\u2019s January 2026 release of PaddleOCR-VL-1.5 \u2014 scoring 94.5% on OmniDocBench \u2014 "
    "represents the current state of the art. Datalab\u2019s Chandra (a Qwen-3-VL fine-tune) tops the "
    "olmOCR bench at 83.1%."
))

story.append(h2("Slice 2: Cloud-Managed OCR &amp; Document AI Services"))
story.append(body(
    "The big three cloud providers (AWS Textract, Google Document AI, Azure Document Intelligence) "
    "remain dominant for enterprises locked into their ecosystems but face unprecedented pressure from "
    "AI-native alternatives. Azure leads on custom model training (30-minute cycles), Google wins on "
    "degraded document handling (81.2% vs Textract\u2019s 76.3%), and AWS excels at table extraction. "
    "All three charge $1.50\u2013$65/1K pages while new entrants like Mistral OCR deliver comparable "
    "quality at $1/1K pages."
))

story.append(h2("Slice 3: LLM/Multimodal Vision Approaches"))
story.append(body(
    "Vision-language models have redefined what \u201COCR\u201D means \u2014 they don\u2019t just extract "
    "text but understand document semantics, spatial relationships, and context. Gemini 3 Flash leads "
    "vision benchmarks (79.0 MMMU Pro), while Qwen3-VL-235B rivals GPT-5 across all multimodal tasks. "
    "Gemini Flash 2.0 processes 6,000 pages for $1, making LLM-based OCR cheaper than many traditional "
    "solutions. The key tradeoff is hallucination risk."
))

story.append(h2("Slice 4: Specialized &amp; Vertical OCR Solutions"))
story.append(body(
    "Domain-specific OCR continues to thrive where general-purpose tools fall short. ABBYY (200+ languages) "
    "dominates enterprise multilingual needs. Rossum\u2019s zero-template approach eliminates per-vendor "
    "configuration. Transkribus remains unmatched for historical manuscripts. ID/passport scanning "
    "(Microblink, OCR Studio) serves KYC compliance workflows where accuracy requirements exceed 99.9%."
))
story.append(divider())

# -- Comparison Matrix --
story.append(h1("Comparison Matrix"))
story.append(body("Leading OCR tools ranked across key dimensions as of April 2026:"))
story.append(Spacer(1, 6))
story.append(make_table(comp_headers, comp_rows, comp_widths))
story.append(divider())

# -- Deep Dive: Slice 1 --
story.append(h1("Deep Dive: Open-Source OCR"))

for name, intro, bullets_data in [
    ("PaddleOCR (Baidu)",
     "PaddleOCR has emerged as the undisputed open-source benchmark leader. The May 2025 release of v3.0 introduced PP-OCRv5, followed by the January 2026 release of PaddleOCR-VL-1.5 \u2014 scoring 94.5% on OmniDocBench v1.5 and leading the leaderboard with a composite 92.86.",
     [("Strengths: ", "Benchmark-leading accuracy on tables/formulas/charts; lightweight models for mobile/edge; superior multilingual support; Apache 2.0 license"),
      ("Limitations: ", "Developer-focused; PaddlePaddle framework dependency; GPU recommended for VL models"),
      ("Cost: ", "Free (Apache 2.0); ~$0.09/1K pages self-hosted on consumer GPU"),
      ("2025\u20132026: ", "PaddleOCR-VL-1.5 (Jan 2026) outperforms GPT-5.4 and Gemini 2.5 Pro; PP-OCRv5 (May 2025); PP-StructureV3")]),
    ("Tesseract 5.x (Google/Community)",
     "Tesseract remains the most widely recognized OCR engine, serving as a baseline for simple deployments where complex layout analysis is unnecessary.",
     [("Strengths: ", "Zero-cost; 116 languages; CPU-only; ~10MB footprint; sub-second processing; massive community"),
      ("Limitations: ", "Struggles with tables, equations, multi-column layouts, handwriting; brittle multi-stage pipelines"),
      ("Cost: ", "Free (Apache 2.0)"),
      ("2025\u20132026: ", "v5.5.1 (May 2025), v5.5.2 (late 2025); incremental improvements; increasingly viewed as legacy")]),
    ("Surya / Chandra (Datalab)",
     "Surya emphasizes document layout analysis and reading-order detection. Its successor Chandra (October 2025) uses a fine-tuned Qwen-3-VL model with 9B parameters.",
     [("Strengths: ", "Best-in-class layout preservation; reading-order detection; 90+ languages; 50K+ combined GitHub stars with Marker"),
      ("Limitations: ", "GPU recommended; smaller community; pipeline approach in Surya (addressed by Chandra)"),
      ("2025\u20132026: ", "Chandra v0.1.0 scored 83.1% on olmOCR-Bench (highest open-source at time of release)")]),
    ("EasyOCR",
     "EasyOCR remains popular for quick-start scenarios but is no longer competitive for production workloads.",
     [("Strengths: ", "Simplest setup (pip install + 2 lines); 80+ languages; PyTorch-based"),
      ("Limitations: ", "Systematic failures on financial symbols; ~70% accuracy ceiling; no layout analysis")]),
    ("docTR (Mindee)",
     "A deep-learning OCR library using a two-stage detection+recognition pipeline with TensorFlow and PyTorch support.",
     [("Strengths: ", "Strong on structured documents (forms); dual-framework support; ~90% accuracy"),
      ("Limitations: ", "Weaker multilingual support out-of-box; smaller community")]),
    ("GOT-OCR 2.0 (General OCR Theory)",
     "A unified end-to-end model handling plain text, math formulas, molecular structures, tables, charts, sheet music, and geometric shapes.",
     [("Strengths: ", "Broadest scope of optical signals in a single model; research-grade capabilities"),
      ("Limitations: ", "Resource-heavy LVLM architecture; requires significant GPU resources")]),
    ("DeepSeek-OCR",
     "A purpose-built multimodal transformer with innovative token compression (DeepEncoder ~380M params + DeepSeek-3B-MoE decoder).",
     [("Strengths: ", "4.65 pages/sec; six resolution modes; on-premises deployment; strong text extraction"),
      ("Limitations: ", "Occasional hallucination; requires GPU; weaker layout than Mistral OCR")]),
    ("olmOCR-2 (Allen AI)",
     "Focused on high-throughput PDF-to-text conversion, supporting tables, equations, and handwriting.",
     [("Strengths: ", "82.4% accuracy at 1.78 pages/sec (153,792 pages/day); balanced accuracy + throughput"),
      ("Limitations: ", "Lacks layout-awareness; needs post-processing for structured extraction")]),
]:
    story.append(h2(name))
    story.append(body(intro))
    for lbl, txt in bullets_data:
        story.append(bbold(lbl, txt))

story.append(divider())

# -- Deep Dive: Slice 2 --
story.append(h1("Deep Dive: Cloud-Managed OCR Services"))

for name, bullets_data in [
    ("Google Document AI", [
        ("Strengths: ", "95.8% average accuracy; superior on degraded documents (+4.9pp vs Textract); end-to-end custom labeling; strong handwriting"),
        ("Limitations: ", "Table extraction collapsed to 40% on 12K PO benchmark; requires GCP expertise"),
        ("Pricing: ", "300 free pages/month; $0.60/1K pages above 5M/month; $4,500/M pages cheaper than Textract"),
        ("Best for: ", "Mixed scanned/digital PDFs with downstream Vertex AI or BigQuery pipelines")]),
    ("AWS Textract", [
        ("Strengths: ", "Industry-leading table extraction with cell-level mapping; 8.9/10 ease of use; tight serverless integration"),
        ("Limitations: ", "No custom training; image quality sensitivity; AWS lock-in; expensive forms ($65/1K pages)"),
        ("Pricing: ", "$1.50/1K pages basic; free tier 1,000 pages/month for 3 months; volume discounts 33\u201340%"),
        ("Best for: ", "AWS-first teams processing invoices/receipts in existing S3 pipelines")]),
    ("Azure AI Document Intelligence", [
        ("Strengths: ", "Custom training in 30 minutes; richest semantic output; expanded pre-built models 2026; containerized on-prem; 93% mortgage extraction"),
        ("Limitations: ", "QA needed on messy inputs; Microsoft ecosystem bias"),
        ("Pricing: ", "$1.50/1K read; $10/1K prebuilt; commitment tier $0.53/1K at 1M+ volume"),
        ("Best for: ", "Microsoft-centric enterprises; custom document types; hybrid/on-prem")]),
    ("Mistral OCR (API)", [
        ("Strengths: ", "Best layout understanding among API offerings; strong handwriting; fast processing; preserves structure"),
        ("Limitations: ", "Proprietary API; newer entrant with less ecosystem integration"),
        ("Pricing: ", "$1/1K pages \u2014 undercuts incumbents by 90%+"),
        ("Best for: ", "Document-processing where cost and quality both matter; handwriting-heavy forms")]),
]:
    story.append(h2(name))
    for lbl, txt in bullets_data:
        story.append(bbold(lbl, txt))

story.append(divider())

# -- Deep Dive: Slice 3 --
story.append(h1("Deep Dive: LLM/Multimodal Vision"))

for name, bullets_data in [
    ("GPT-4o / GPT-4.1 / GPT-5 (OpenAI)", [
        ("Strengths: ", "Highest absolute OCR benchmark performance; strong on charts, diagrams, visual math; 128K context"),
        ("Limitations: ", "Highest cost (~$15/1K pages); API-only; no fine-tuning; hallucination risk"),
        ("Best for: ", "High-stakes document understanding where accuracy justifies cost")]),
    ("Claude 4 / Sonnet 4.5 (Anthropic)", [
        ("Strengths: ", "200K token context (1M beta); shares highest OCR scores with Gemini 2.5 Pro; strong structured analysis"),
        ("Limitations: ", "API pricing; no self-hosting option"),
        ("Best for: ", "Long-document analysis; document Q&amp;A; extraction and reasoning tasks")]),
    ("Gemini 2.5 Pro / Gemini 3 (Google)", [
        ("Strengths: ", "Gemini 3 Flash leads vision benchmarks (79.0 MMMU Pro); Flash 2.0 does 6,000 pages/$1; strong complex layouts"),
        ("Limitations: ", "Latency on long documents; Google ecosystem preference"),
        ("Pricing: ", "~$0.17/1K pages (Flash 2.0) \u2014 cheaper than traditional OCR software"),
        ("Best for: ", "Cost-sensitive bulk processing; mixed layout documents; GCP teams")]),
    ("Qwen3-VL-235B (Alibaba)", [
        ("Strengths: ", "Rivals GPT-5 and Gemini 2.5 Pro; OCR in 32 languages; low-light/blurred/tilted images; fully open-source"),
        ("Limitations: ", "235B parameters requires substantial compute; latency concerns"),
        ("Best for: ", "Organizations needing GPT-5-class capabilities without API dependency")]),
    ("PaddleOCR-VL 7B (Open-Source)", [
        ("Strengths: ", "Leads OmniDocBench (92.86); outperforms GPT-5.4; Apache 2.0; runs on consumer GPU; 167x cheaper"),
        ("Limitations: ", "7B model less capable at reasoning/Q&amp;A than larger LLMs"),
        ("Best for: ", "High-volume extraction where cost matters more than document Q&amp;A")]),
]:
    story.append(h2(name))
    for lbl, txt in bullets_data:
        story.append(bbold(lbl, txt))

story.append(h2("Hybrid Approaches"))
story.append(body("Many production systems combine traditional OCR + LLM post-processing:"))
story.append(bullet("OCR engine for reliable text extraction \u2192 LLM for semantic understanding and structuring"))
story.append(bullet("Reduces hallucination risk while maintaining context awareness"))
story.append(bullet("Example: Tesseract/PaddleOCR for extraction \u2192 Claude/GPT for field mapping and validation"))
story.append(divider())

# -- Deep Dive: Slice 4 --
story.append(h1("Deep Dive: Specialized &amp; Vertical OCR"))

for name, bullets_data in [
    ("ABBYY Vantage / FineReader Engine 12", [
        ("Strengths: ", "200+ languages; joined handwriting (EN, FR, DE, ES, JA); Accurate Layout Analysis Mode; end-to-end IDP"),
        ("Limitations: ", "Enterprise pricing; complex deployment; legacy perception"),
        ("2025\u20132026: ", "FineReader Engine 12 R7; improved table/checkmark detection; Traditional Chinese; handwriting expansion"),
        ("Target: ", "Large enterprises with high-volume, multilingual document processing")]),
    ("Nanonets", [
        ("Strengths: ", "34% of Fortune 500; pre-trained models; custom models without coding; continuous improvement"),
        ("Limitations: ", "SaaS pricing at scale; less control than self-hosted"),
        ("2025\u20132026: ", "Released Nanonets OCR2-3B open-source model (October 2025)"),
        ("Target: ", "Enterprise document automation (AP, order processing, insurance)")]),
    ("Rossum", [
        ("Strengths: ", "Zero-template AI (Aurora engine); self-improving via HITL; enterprise security (ISO 27001, SOC 2 Type II, HIPAA)"),
        ("Limitations: ", "$18K+/year starting price; focused on AP/invoicing"),
        ("2025\u20132026: ", "SDK releases (rossum-api 3.8.0, rossum-agent-client 1.1.0); streaming; leading AI company in Eastern Europe"),
        ("Target: ", "Mid-market to enterprise accounts payable automation")]),
    ("Veryfi", [
        ("Strengths: ", "98.7% invoice accuracy; sub-3-second processing; 38 languages, 91 currencies; API-first"),
        ("Limitations: ", "Less suited for non-technical users; focused on financial documents"),
        ("Target: ", "Fintech developers, expense management apps, engineering teams")]),
    ("Mindee", [
        ("Strengths: ", "96.1% accuracy; fastest processing (0.9\u20131.3s); customizable industry models; creator of docTR"),
        ("Limitations: ", "Occasional issues with currency formatting and multi-page documents"),
        ("Target: ", "Developers needing customizable, fast OCR APIs")]),
    ("Transkribus (Historical Handwriting)", [
        ("Strengths: ", "Cursive/connected/irregular handwriting; 100+ languages; custom model training per style; GDPR-compliant EU hosting"),
        ("Limitations: ", "Struggles with general handwriting out-of-the-box; niche focus"),
        ("Target: ", "Historians, archivists, academic institutions, digital humanities")]),
    ("ID/Passport Scanning (Microblink, OCR Studio)", [
        ("Strengths: ", "Purpose-built for KYC/identity verification; &gt;99.9% accuracy; real-time mobile capture; compliance-driven"),
        ("2025\u20132026: ", "OCR Studio ID scanning breakthroughs; WebAssembly in-browser OCR; multi-level passport scanning"),
        ("Target: ", "Banks, fintechs, identity verification providers, regulated industries")]),
]:
    story.append(h2(name))
    for lbl, txt in bullets_data:
        story.append(bbold(lbl, txt))

story.append(divider())

# -- Recommendations --
story.append(h1("Recommendations by Use Case"))
story.append(Spacer(1, 6))
story.append(make_table(rec_headers, rec_rows, rec_widths))
story.append(divider())

# -- Key Trends --
story.append(h1("Key Trends for 2026"))
for i, (lbl, txt) in enumerate([
    ("Open-source supremacy: ", "Open-source VLM-based OCR models now outperform all commercial APIs on benchmarks while costing 167x less."),
    ("Pipeline death: ", "Traditional detect\u2192recognize\u2192post-process pipelines are being replaced by end-to-end VLMs that see entire documents at once."),
    ("Commoditization: ", "Basic OCR is effectively free; value has shifted to document understanding, workflow integration, and domain-specific accuracy."),
    ("Hybrid architectures: ", "Production systems increasingly combine traditional OCR (for reliability) with LLMs (for semantic understanding)."),
    ("October 2025 inflection: ", "Six major open-source OCR models in one month marked the tipping point for the industry."),
], 1):
    story.append(numbered(lbl, txt, i))

story.append(divider())

# -- Sources --
story.append(h1("Sources and References"))
for title, url in sources:
    story.append(link(title, url))


# ── Build the PDF ───────────────────────────────────────────────────────
cover_frame = Frame(MARGIN, MARGIN, FRAME_W, H - 2 * MARGIN, id="cover")
content_frame = Frame(MARGIN, 0.7 * inch, FRAME_W, H - 0.7 * inch - 0.75 * inch, id="content")

doc = BaseDocTemplate(OUT, pagesize=letter,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=0.75 * inch, bottomMargin=0.7 * inch,
    title="OCR Technology Landscape Scan \u2014 April 2026",
    author="Technology Research")

doc.addPageTemplates([
    PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover),
    PageTemplate(id="content", frames=[content_frame], onPage=draw_header_footer),
])

doc.build(story)
print(f"SUCCESS: {OUT} ({os.path.getsize(OUT):,} bytes)")
