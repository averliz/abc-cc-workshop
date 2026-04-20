const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = path.join(__dirname, "ocr_tech_scan.pptx");

// ── Palette: Midnight Executive ─────────────────────────────────────────
const C = {
  navy: "1A2744",
  blue: "2E75B6",
  ice: "CADCFC",
  light: "F5F7FA",
  white: "FFFFFF",
  dark: "1E1E2E",
  text: "2B2B3B",
  muted: "6B7280",
  accent: "0EA5E9",
  grid: "D1D5DB",
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Technology Research";
pres.title = "OCR Technology Landscape Scan — April 2026";

// ── Slide 1: Title ──────────────────────────────────────────────────────
const s1 = pres.addSlide();
s1.background = { color: C.navy };
s1.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 4.5, w: 10, h: 1.125,
  fill: { color: C.blue, transparency: 40 },
});
s1.addText("OCR Technology\nLandscape Scan", {
  x: 0.7, y: 1.0, w: 8.5, h: 2.4,
  fontSize: 40, fontFace: "Georgia", bold: true,
  color: C.white, align: "left", valign: "middle",
  lineSpacingMultiple: 1.15,
});
s1.addText("April 2026", {
  x: 0.7, y: 3.5, w: 4, h: 0.5,
  fontSize: 18, fontFace: "Calibri", color: C.ice, align: "left",
});
s1.addText("Executive Briefing", {
  x: 0.7, y: 4.1, w: 4, h: 0.5,
  fontSize: 13, fontFace: "Calibri", color: C.muted, italic: true, align: "left",
});

// ── Slide 2: Executive Summary ──────────────────────────────────────────
const s2 = pres.addSlide();
s2.background = { color: C.light };
s2.addText("Executive Summary", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s2.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: C.accent },
});
s2.addText([
  { text: "VLMs now outperform traditional OCR pipelines on complex documents while costing 167x less at scale", options: { bullet: true, breakLine: true } },
  { text: "PaddleOCR-VL 7B leads benchmarks ahead of GPT-5.4 at $0.09/1K pages vs $15 for proprietary APIs", options: { bullet: true, breakLine: true } },
  { text: "Traditional engines (Tesseract) remain relevant only for edge/offline deployments", options: { bullet: true, breakLine: true } },
  { text: "October 2025 inflection: 6 major open-source OCR models in one month \u2014 open-source now superior to commercial APIs", options: { bullet: true, breakLine: true } },
  { text: "Enterprise IDP consolidating around AI-native platforms with end-to-end document understanding", options: { bullet: true } },
], {
  x: 0.6, y: 1.3, w: 8.8, h: 3.8,
  fontSize: 14, fontFace: "Calibri", color: C.text,
  paraSpaceAfter: 8, valign: "top",
});

// ── Slide 3: Landscape Overview ─────────────────────────────────────────
const s3 = pres.addSlide();
s3.background = { color: C.light };
s3.addText("The OCR Landscape in 2026", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s3.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: C.accent },
});

const cats = [
  { title: "Open-Source Engines", desc: "PaddleOCR-VL leads at 94.5% accuracy, $0.09/1K pages", color: "0EA5E9" },
  { title: "Cloud Services", desc: "AWS, Google, Azure: $1.50\u2013$65/1K; disrupted by Mistral at $1", color: "6366F1" },
  { title: "LLM/Multimodal Vision", desc: "Gemini Flash: 6K pages/$1; Qwen3-VL rivals GPT-5", color: "8B5CF6" },
  { title: "Specialized/Vertical", desc: "ABBYY (200+ langs), Rossum (AP), Transkribus (history)", color: "EC4899" },
];
cats.forEach((c, i) => {
  const y = 1.25 + i * 1.05;
  s3.addShape(pres.shapes.RECTANGLE, { x: 0.6, y, w: 0.08, h: 0.85, fill: { color: c.color } });
  s3.addText(c.title, {
    x: 0.9, y, w: 3.5, h: 0.4,
    fontSize: 14, fontFace: "Calibri", bold: true, color: C.navy, margin: 0,
  });
  s3.addText(c.desc, {
    x: 0.9, y: y + 0.38, w: 8.5, h: 0.4,
    fontSize: 12, fontFace: "Calibri", color: C.text, margin: 0,
  });
});

// ── Slide 4: Open-Source OCR ────────────────────────────────────────────
const s4 = pres.addSlide();
s4.background = { color: C.light };
s4.addText("Open-Source OCR Engines", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s4.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: "0EA5E9" },
});
s4.addText([
  { text: "PaddleOCR-VL 1.5 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Benchmark leader (94.5% OmniDocBench); 109 languages; Apache 2.0", options: { bullet: true, breakLine: true } },
  { text: "Chandra/Surya ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Best layout preservation; 9B param Qwen-3-VL fine-tune; 83.1% olmOCR", options: { bullet: true, breakLine: true } },
  { text: "Tesseract 5.5 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Legacy baseline; 116 langs; CPU-only; struggles with tables/handwriting", options: { bullet: true, breakLine: true } },
  { text: "DeepSeek-OCR ", options: { bold: true, breakLine: false } },
  { text: "\u2014 On-premises; 4.65 pg/sec; token compression; GPU required", options: { bullet: true, breakLine: true } },
  { text: "olmOCR-2 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 High-throughput (153K pages/day); 82.4% accuracy; Allen AI", options: { bullet: true } },
], {
  x: 0.6, y: 1.2, w: 8.8, h: 4.0,
  fontSize: 13, fontFace: "Calibri", color: C.text,
  paraSpaceAfter: 6, valign: "top",
});

// ── Slide 5: Cloud Services ─────────────────────────────────────────────
const s5 = pres.addSlide();
s5.background = { color: C.light };
s5.addText("Cloud-Managed OCR Services", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s5.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: "6366F1" },
});
s5.addText([
  { text: "Google Document AI ", options: { bold: true, breakLine: false } },
  { text: "\u2014 95.8% accuracy; best on degraded docs; $0.60/1K at volume", options: { bullet: true, breakLine: true } },
  { text: "AWS Textract ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Best table extraction; 8.9/10 ease of use; $1.50\u2013$65/1K pages", options: { bullet: true, breakLine: true } },
  { text: "Azure Document Intelligence ", options: { bold: true, breakLine: false } },
  { text: "\u2014 30-min custom training; containerized on-prem; $0.53/1K at scale", options: { bullet: true, breakLine: true } },
  { text: "Mistral OCR v3 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 $1/1K pages (90% cheaper); best layout understanding; strong handwriting", options: { bullet: true, breakLine: true } },
  { text: "Key trend: ", options: { bold: true, breakLine: false } },
  { text: "Value shifting from accuracy to ecosystem integration and compliance", options: { bullet: true } },
], {
  x: 0.6, y: 1.2, w: 8.8, h: 4.0,
  fontSize: 13, fontFace: "Calibri", color: C.text,
  paraSpaceAfter: 6, valign: "top",
});

// ── Slide 6: LLM/Multimodal ────────────────────────────────────────────
const s6 = pres.addSlide();
s6.background = { color: C.light };
s6.addText("LLM / Multimodal Vision OCR", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s6.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: "8B5CF6" },
});
s6.addText([
  { text: "GPT-5 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Highest accuracy; ~$15/1K pages; best for complex reasoning over docs", options: { bullet: true, breakLine: true } },
  { text: "Gemini Flash 2.0 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 6,000 pages for $1; cheaper than traditional OCR software", options: { bullet: true, breakLine: true } },
  { text: "Claude 4 / Sonnet 4.5 ", options: { bold: true, breakLine: false } },
  { text: "\u2014 200K\u20131M context; top OCR scores; best for long-doc analysis", options: { bullet: true, breakLine: true } },
  { text: "Qwen3-VL-235B ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Rivals GPT-5; fully open-source; 32-language OCR", options: { bullet: true, breakLine: true } },
  { text: "PaddleOCR-VL 7B ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Outperforms GPT-5.4 on benchmarks; 167x cheaper; consumer GPU", options: { bullet: true } },
], {
  x: 0.6, y: 1.2, w: 8.8, h: 4.0,
  fontSize: 13, fontFace: "Calibri", color: C.text,
  paraSpaceAfter: 6, valign: "top",
});

// ── Slide 7: Specialized/Vertical ───────────────────────────────────────
const s7 = pres.addSlide();
s7.background = { color: C.light };
s7.addText("Specialized & Vertical OCR", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s7.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: "EC4899" },
});
s7.addText([
  { text: "ABBYY Vantage ", options: { bold: true, breakLine: false } },
  { text: "\u2014 200+ languages; joined handwriting; end-to-end IDP for enterprise", options: { bullet: true, breakLine: true } },
  { text: "Rossum ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Zero-template AP automation; self-improving AI; $18K+/year", options: { bullet: true, breakLine: true } },
  { text: "Veryfi / Mindee ", options: { bold: true, breakLine: false } },
  { text: "\u2014 98.7% invoice accuracy; sub-3s processing; API-first for developers", options: { bullet: true, breakLine: true } },
  { text: "Transkribus ", options: { bold: true, breakLine: false } },
  { text: "\u2014 Historical handwriting; custom model training per script; GDPR EU hosting", options: { bullet: true, breakLine: true } },
  { text: "Microblink / OCR Studio ", options: { bold: true, breakLine: false } },
  { text: "\u2014 ID/passport scanning; >99.9% accuracy; KYC compliance; mobile-first", options: { bullet: true } },
], {
  x: 0.6, y: 1.2, w: 8.8, h: 4.0,
  fontSize: 13, fontFace: "Calibri", color: C.text,
  paraSpaceAfter: 6, valign: "top",
});

// ── Slide 8: Comparison Matrix ──────────────────────────────────────────
const s8 = pres.addSlide();
s8.background = { color: C.white };
s8.addText("Comparison Matrix", {
  x: 0.4, y: 0.15, w: 9, h: 0.55,
  fontSize: 24, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});

const tblHeader = [
  { text: "Tool", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "Category", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "Accuracy", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "Cost/1K", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "Best For", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "License", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
];

const tblRows = [
  ["PaddleOCR-VL 1.5", "Open-source VLM", "94.5%", "$0.09", "Complex docs, tables", "Apache 2.0"],
  ["Tesseract 5.5", "OS engine", "Moderate", "Free", "Simple text, offline", "Apache 2.0"],
  ["Mistral OCR v3", "Commercial API", "High", "$1.00", "Handwriting, layout", "Proprietary"],
  ["Google Doc AI", "Cloud", "95.8%", "$0.60\u2013$1.50", "Degraded docs, GCP", "Proprietary"],
  ["AWS Textract", "Cloud", "94.2%", "$1.50\u2013$65", "Table extraction", "Proprietary"],
  ["Azure Doc Intel.", "Cloud", "High", "$0.53\u2013$10", "Custom models", "Proprietary"],
  ["GPT-5.4", "LLM", "Very high", "~$15", "Complex reasoning", "Proprietary"],
  ["Gemini Flash 2.0", "LLM", "High", "$0.17", "Bulk processing", "Proprietary"],
  ["Qwen3-VL-235B", "Open LLM", "Near GPT-5", "Self-host", "Multimodal", "Open-source"],
  ["ABBYY Vantage", "Enterprise IDP", "Very high", "Enterprise", "Multilingual", "Commercial"],
  ["Veryfi", "IDP API", "98.7%", "API tiers", "Invoices/receipts", "Commercial"],
  ["Transkribus", "Specialized", "High", "Freemium", "Historical HWR", "Commercial"],
];

const tblData = [tblHeader, ...tblRows.map((row, ri) =>
  row.map(cell => ({
    text: cell,
    options: ri % 2 === 1 ? { fill: { color: "F0F4FA" } } : {},
  }))
)];

s8.addTable(tblData, {
  x: 0.3, y: 0.72, w: 9.4, h: 4.8,
  colW: [1.6, 1.2, 1.0, 1.0, 2.0, 1.1],
  fontSize: 9, fontFace: "Calibri", color: C.text,
  border: { type: "solid", pt: 0.5, color: C.grid },
  autoPage: false, valign: "middle",
  rowH: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35],
});

// ── Slide 9: Recommendations ────────────────────────────────────────────
const s9 = pres.addSlide();
s9.background = { color: C.light };
s9.addText("Recommendations by Use Case", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.navy, margin: 0,
});
s9.addShape(pres.shapes.RECTANGLE, {
  x: 0.6, y: 0.95, w: 1.8, h: 0.04, fill: { color: C.accent },
});

const recHeader = [
  { text: "Use Case", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "Solution", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
  { text: "Why", options: { bold: true, color: "FFFFFF", fill: { color: C.navy } } },
];
const recRows = [
  ["High-volume (budget)", "PaddleOCR-VL 1.5", "$0.09/1K; best accuracy; open-source"],
  ["Edge / offline", "Tesseract 5.5", "Free; CPU-only; 116 languages"],
  ["Enterprise AP", "Rossum / ABBYY", "Zero-template; compliance; HITL"],
  ["Developer invoices", "Veryfi / Mindee", "98%+ accuracy; sub-3s; API-first"],
  ["Complex doc Q&A", "GPT-5 / Claude 4", "Best reasoning over content"],
  ["Bulk LLM OCR", "Gemini Flash 2.0", "6K pages/$1; strong accuracy"],
  ["Air-gapped", "DeepSeek / PaddleOCR", "Self-hosted; data stays local"],
  ["Historical HWR", "Transkribus", "Custom per-script models; EU hosting"],
  ["KYC / ID scanning", "Microblink", "Purpose-built; >99.9%; mobile"],
];
const recData = [recHeader, ...recRows.map((row, ri) =>
  row.map(cell => ({
    text: cell,
    options: ri % 2 === 1 ? { fill: { color: "F0F4FA" } } : {},
  }))
)];

s9.addTable(recData, {
  x: 0.5, y: 1.1, w: 9.0, h: 4.2,
  colW: [2.2, 2.3, 4.5],
  fontSize: 11, fontFace: "Calibri", color: C.text,
  border: { type: "solid", pt: 0.5, color: C.grid },
  valign: "middle",
  rowH: [0.38, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
});

// ── Slide 10: Sources ───────────────────────────────────────────────────
const s10 = pres.addSlide();
s10.background = { color: C.navy };
s10.addText("Sources & References", {
  x: 0.6, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Georgia", bold: true, color: C.white, margin: 0,
});
s10.addText([
  { text: "unstract.com/blog/best-opensource-ocr-tools-in-2025", options: { bullet: true, breakLine: true } },
  { text: "modal.com/blog/8-top-open-source-ocr-models-compared", options: { bullet: true, breakLine: true } },
  { text: "codesota.com/ocr \u2014 Best OCR Models 2026 Benchmarks", options: { bullet: true, breakLine: true } },
  { text: "vellum.ai/blog/document-data-extraction-llms-vs-ocrs", options: { bullet: true, breakLine: true } },
  { text: "aiproductivity.ai/blog/best-ocr-tools-2026", options: { bullet: true, breakLine: true } },
  { text: "analyticsvidhya.com/blog/2025/11/deepseek-ocr-vs-qwen-3-vl-vs-mistral-ocr", options: { bullet: true, breakLine: true } },
  { text: "mistral.ai/news/mistral-ocr", options: { bullet: true, breakLine: true } },
  { text: "invoicedataextraction.com \u2014 AWS vs Google vs Azure", options: { bullet: true, breakLine: true } },
  { text: "abbyy.com/company/news/abbyy-ascend-2025-2-ai-enterprise-automation", options: { bullet: true, breakLine: true } },
  { text: "rossum.ai/intelligent-document-processing", options: { bullet: true, breakLine: true } },
  { text: "+ 14 additional sources (see full report: ocr_tech_scan.md)", options: { bullet: true } },
], {
  x: 0.6, y: 1.0, w: 8.8, h: 4.2,
  fontSize: 11, fontFace: "Calibri", color: C.ice,
  paraSpaceAfter: 3, valign: "top",
});

// ── Write ───────────────────────────────────────────────────────────────
pres.writeFile({ fileName: OUT }).then(() => {
  const fs = require("fs");
  const size = fs.statSync(OUT).size;
  console.log(`SUCCESS: ${OUT} (${size.toLocaleString()} bytes, 10 slides)`);
});
