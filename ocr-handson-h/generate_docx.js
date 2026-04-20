const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  ExternalHyperlink, TableOfContents, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak, SectionType
} = require("docx");

const ACCENT = "1F4E79";
const ACCENT_LIGHT = "D6E4F0";
const GRAY_LIGHT = "F2F2F2";
const BORDER_COLOR = "B4C6E7";
const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9360

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: ACCENT, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text, bold: true, font: "Arial", size: 18, color: "FFFFFF" })] })],
  });
}

function dataCell(text, width, shaded) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: shaded ? { fill: GRAY_LIGHT, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ spacing: { before: 30, after: 30 }, children: [new TextRun({ text, font: "Arial", size: 18 })] })],
  });
}

function makeTable(headers, rows, colWidths) {
  const tableRows = [
    new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
    ...rows.map((row, ri) =>
      new TableRow({ children: row.map((cell, ci) => dataCell(cell, colWidths[ci], ri % 2 === 1)) })
    ),
  ];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: tableRows,
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, font: "Arial" })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 160 }, children: [new TextRun({ text, font: "Arial" })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, font: "Arial" })] });
}
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    ...opts,
    children: [new TextRun({ text, font: "Arial", size: 22, ...opts.run })],
  });
}
function boldPara(label, text) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    children: [
      new TextRun({ text: label, bold: true, font: "Arial", size: 22 }),
      new TextRun({ text, font: "Arial", size: 22 }),
    ],
  });
}

const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
    {
      reference: "numbers",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
  ],
};

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function bulletBold(label, text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [
      new TextRun({ text: label, bold: true, font: "Arial", size: 22 }),
      new TextRun({ text, font: "Arial", size: 22 }),
    ],
  });
}

function numberedItem(text, ref) {
  return new Paragraph({
    numbering: { reference: ref || "numbers", level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function numberedBold(label, text, ref) {
  return new Paragraph({
    numbering: { reference: ref || "numbers", level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [
      new TextRun({ text: label, bold: true, font: "Arial", size: 22 }),
      new TextRun({ text, font: "Arial", size: 22 }),
    ],
  });
}

function linkPara(title, url) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 30, after: 30 },
    children: [
      new ExternalHyperlink({ link: url, children: [new TextRun({ text: title, style: "Hyperlink", font: "Arial", size: 20 })] }),
    ],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_LIGHT, space: 1 } },
    children: [],
  });
}

// -- Comparison Matrix data --
const compHeaders = ["Tool", "Category", "Accuracy", "Cost/1K Pg", "Lang", "Best For", "Maturity", "License"];
const compWidths = [1200, 1050, 1100, 900, 600, 1800, 900, 810];
const compRows = [
  ["PaddleOCR-VL 1.5", "Open-source VLM", "94.5% OmniDocBench", "~$0.09", "109", "Complex docs, tables", "Production", "Apache 2.0"],
  ["Chandra v0.1.0", "Open-source VLM", "83.1% olmOCR", "Self-hosted", "90+", "Layout-aware extraction", "Early prod.", "Open-source"],
  ["Tesseract 5.5", "OS engine", "Moderate", "Free", "116", "Printed text, offline", "Legacy", "Apache 2.0"],
  ["Mistral OCR v3", "Commercial API", "High (ELO 1409)", "$1.00", "Multi", "Structured docs, HWR", "Production", "Proprietary"],
  ["DeepSeek-OCR", "Open-source VLM", "75.7% olmOCR", "Self-hosted", "Multi", "On-premises", "Production", "Open-source"],
  ["olmOCR-2", "Open-source", "82.4% olmOCR", "Self-hosted", "Multi", "High-throughput PDF", "Production", "Open-source"],
  ["Google Document AI", "Cloud service", "95.8%", "$0.60-$1.50", "200+", "Degraded docs, GCP", "Mature", "Proprietary"],
  ["AWS Textract", "Cloud service", "94.2%", "$1.50-$65", "100+", "Table extraction, AWS", "Mature", "Proprietary"],
  ["Azure Doc Intel.", "Cloud service", "High", "$0.53-$10", "100+", "Custom models, MSFT", "Mature", "Proprietary"],
  ["GPT-5.4", "Proprietary LLM", "Very high", "~$15", "50+", "Complex reasoning", "Mature", "Proprietary"],
  ["Gemini Flash 2.0", "Proprietary LLM", "High", "~$0.17", "100+", "Cost-effective LLM OCR", "Production", "Proprietary"],
  ["Qwen3-VL-235B", "Open-source LLM", "Near GPT-5", "Self-hosted", "32", "Multimodal understanding", "Production", "Open-source"],
  ["ABBYY Vantage", "Enterprise IDP", "Very high", "Enterprise", "200+", "Multilingual enterprise", "Mature", "Commercial"],
  ["Nanonets", "IDP platform", "High", "SaaS tiers", "Multi", "Doc automation", "Production", "Commercial"],
  ["Rossum", "IDP platform", "Self-improving", "$18K+/yr", "Multi", "Zero-template AP", "Production", "Commercial"],
  ["Veryfi", "IDP API", "98.7% invoice", "API tiers", "38", "Real-time receipts", "Production", "Commercial"],
  ["Transkribus", "Specialized", "High (trained)", "Freemium", "100+", "Historical handwriting", "Mature", "Commercial"],
];

// -- Recommendations table --
const recHeaders = ["Use Case", "Recommended Solution", "Why"];
const recWidths = [2800, 2400, 4160];
const recRows = [
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
];

// -- Sources --
const sources = [
  ["Best Open-Source OCR Tools in 2025 - Unstract", "https://unstract.com/blog/best-opensource-ocr-tools-in-2025/"],
  ["8 Top Open-Source OCR Models Compared - Modal", "https://modal.com/blog/8-top-open-source-ocr-models-compared"],
  ["Best OCR Models 2026: Benchmarks - CodeSOTA", "https://www.codesota.com/ocr"],
  ["7 Best Open-Source OCR Models 2025 - E2E Networks", "https://www.e2enetworks.com/blog/complete-guide-open-source-ocr-models-2025"],
  ["10 Awesome OCR Models for 2025 - KDnuggets", "https://www.kdnuggets.com/10-awesome-ocr-models-for-2025"],
  ["Technical Analysis of Non-LLM OCR Engines - IntuitionLabs", "https://intuitionlabs.ai/articles/non-llm-ocr-technologies"],
  ["AWS Textract vs Google Document AI vs Azure", "https://invoicedataextraction.com/blog/aws-textract-vs-google-document-ai-vs-azure-document-intelligence"],
  ["Best OCR Tools 2026 - AI Productivity", "https://aiproductivity.ai/blog/best-ocr-tools-2026/"],
  ["Document AI Cost Comparison - AI Productivity", "https://aiproductivity.ai/blog/document-ai-cost-comparison/"],
  ["Document Data Extraction 2026: LLMs vs OCRs - Vellum AI", "https://www.vellum.ai/blog/document-data-extraction-llms-vs-ocrs"],
  ["Top 10 Vision Language Models 2026 - DataCamp", "https://www.datacamp.com/blog/top-vision-language-models"],
  ["Best Vision & Multimodal LLMs Jan 2026 - WhatLLM", "https://whatllm.org/blog/best-vision-models-january-2026"],
  ["DeepSeek OCR vs Qwen-3 VL vs Mistral OCR - Analytics Vidhya", "https://www.analyticsvidhya.com/blog/2025/11/deepseek-ocr-vs-qwen-3-vl-vs-mistral-ocr/"],
  ["Mistral OCR - Mistral AI", "https://mistral.ai/news/mistral-ocr"],
  ["ABBYY Ascend 2025.2 AI Enhancements", "https://www.abbyy.com/company/news/abbyy-ascend-2025-2-ai-enterprise-automation/"],
  ["Invoice OCR Benchmark: Veryfi vs Google vs Mindee", "https://www.veryfi.com/ai-insights/invoice-ocr-competitors-veryfi/"],
  ["Rossum - Intelligent Document Processing", "https://rossum.ai/intelligent-document-processing/"],
  ["Best OCR APIs of 2026 - Mindee", "https://www.mindee.com/blog/leading-ocr-api-solutions"],
  ["Handwriting OCR - Transkribus", "https://www.transkribus.org/handwriting-ocr"],
  ["OCR Studio 2025 - ID Scanning Breakthroughs", "https://ocrstudio.ai/news/ocr-studio-announces-2025-results-marking-id-scanning-breakthroughs/"],
  ["ID Card OCR Technology - Microblink", "https://microblink.com/identity/id-card-ocr-technology/"],
  ["Comparing Top 6 OCR Systems 2025 - MarkTechPost", "https://www.marktechpost.com/2025/11/02/comparing-the-top-6-ocr-optical-character-recognition-models-systems-in-2025/"],
  ["Best Python OCR Library 2026 - CodeSOTA", "https://www.codesota.com/ocr/best-for-python"],
  ["OCR Technology in 2026 - Pixno", "https://photes.io/blog/posts/ocr-research-trend"],
];

// -- Footer --
const defaultFooter = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Page ", font: "Arial", size: 18, color: "666666" }),
        new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "666666" }),
      ],
    }),
  ],
});

// -- Build document --
const doc = new Document({
  numbering,
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "404040" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [
    // ===== TITLE PAGE =====
    {
      properties: {
        page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
        titlePage: true,
      },
      children: [
        new Paragraph({ spacing: { before: 3600 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 12 } },
          children: [new TextRun({ text: "OCR Technology", font: "Arial", size: 56, bold: true, color: ACCENT })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Landscape Scan", font: "Arial", size: 56, bold: true, color: ACCENT })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "April 2026", font: "Arial", size: 32, color: "666666" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "A comprehensive analysis of OCR tools, platforms, and approaches", font: "Arial", size: 24, color: "888888", italics: true })],
        }),
      ],
    },
    // ===== TOC PAGE =====
    {
      properties: {
        page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
        type: SectionType.NEXT_PAGE,
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT_LIGHT, space: 4 } },
            children: [new TextRun({ text: "OCR Technology Landscape Scan \u2014 April 2026", font: "Arial", size: 18, color: "999999", italics: true })],
          })],
        }),
      },
      footers: { default: defaultFooter },
      children: [
        h1("Table of Contents"),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),

        // ===== EXECUTIVE SUMMARY =====
        h1("Executive Summary"),
        para("The OCR landscape in 2026 has undergone a paradigm shift: vision-language models (VLMs) now decisively outperform traditional OCR pipelines on complex documents, while costing orders of magnitude less at scale. Open-source models like PaddleOCR-VL 7B lead benchmarks ahead of GPT-5.4 and Gemini 2.5 Pro at $0.09/1K pages versus $15 for proprietary APIs \u2014 a 167x cost reduction."),
        para("Traditional engines like Tesseract remain relevant only for edge/offline deployments, while the enterprise IDP market is consolidating around AI-native platforms that combine OCR with end-to-end document understanding. The October 2025 inflection point \u2014 when six major open-source OCR models launched in a single month \u2014 marked the moment open-source OCR became unambiguously superior to commercial APIs for most use cases."),
        divider(),

        // ===== LANDSCAPE OVERVIEW =====
        h1("Landscape Overview"),

        h2("Slice 1: Open-Source OCR Engines & Libraries"),
        para("The open-source OCR ecosystem has bifurcated into two tiers: legacy pipeline-based engines (Tesseract, EasyOCR) that remain useful for simple extraction tasks, and modern VLM-based models (PaddleOCR-VL, Chandra, DeepSeek-OCR) that handle tables, formulas, and complex layouts natively. PaddleOCR\u2019s January 2026 release of PaddleOCR-VL-1.5 \u2014 scoring 94.5% on OmniDocBench \u2014 represents the current state of the art. Datalab\u2019s Chandra (a Qwen-3-VL fine-tune) tops the olmOCR bench at 83.1%."),

        h2("Slice 2: Cloud-Managed OCR & Document AI Services"),
        para("The big three cloud providers (AWS Textract, Google Document AI, Azure Document Intelligence) remain dominant for enterprises locked into their ecosystems but face unprecedented pressure from AI-native alternatives. Azure leads on custom model training (30-minute cycles), Google wins on degraded document handling (81.2% vs Textract\u2019s 76.3%), and AWS excels at table extraction. All three charge $1.50\u2013$65/1K pages while new entrants like Mistral OCR deliver comparable quality at $1/1K pages."),

        h2("Slice 3: LLM/Multimodal Vision Approaches"),
        para("Vision-language models have redefined what \u201COCR\u201D means \u2014 they don\u2019t just extract text but understand document semantics, spatial relationships, and context. Gemini 3 Flash leads vision benchmarks (79.0 MMMU Pro), while Qwen3-VL-235B rivals GPT-5 across all multimodal tasks. Gemini Flash 2.0 processes 6,000 pages for $1, making LLM-based OCR cheaper than many traditional solutions. The key tradeoff is hallucination risk."),

        h2("Slice 4: Specialized & Vertical OCR Solutions"),
        para("Domain-specific OCR continues to thrive where general-purpose tools fall short. ABBYY (200+ languages) dominates enterprise multilingual needs. Rossum\u2019s zero-template approach eliminates per-vendor configuration. Transkribus remains unmatched for historical manuscripts. ID/passport scanning (Microblink, OCR Studio) serves KYC compliance workflows where accuracy requirements exceed 99.9%."),
        divider(),

        // ===== COMPARISON MATRIX =====
        h1("Comparison Matrix"),
        para("Leading OCR tools ranked across key dimensions as of April 2026:"),
        new Paragraph({ spacing: { before: 120 }, children: [] }),
        makeTable(compHeaders, compRows, compWidths),
        divider(),

        // ===== DEEP DIVE SLICE 1 =====
        h1("Deep Dive: Open-Source OCR"),

        h2("PaddleOCR (Baidu)"),
        para("PaddleOCR has emerged as the undisputed open-source benchmark leader. The May 2025 release of v3.0 introduced PP-OCRv5 with a modular plugin architecture, followed by the January 2026 release of PaddleOCR-VL-1.5 \u2014 scoring 94.5% on OmniDocBench v1.5 and leading the leaderboard with a composite 92.86."),
        bulletBold("Strengths: ", "Benchmark-leading accuracy on tables/formulas/charts; lightweight models for mobile/edge; superior multilingual support; Apache 2.0 license; active development"),
        bulletBold("Limitations: ", "Developer-focused (requires coding); PaddlePaddle framework dependency; GPU recommended for VL models"),
        bulletBold("Cost: ", "Free (Apache 2.0); ~$0.09/1K pages self-hosted on consumer GPU"),
        bulletBold("2025-2026: ", "PaddleOCR-VL-1.5 (Jan 2026) outperforms GPT-5.4 and Gemini 2.5 Pro; PP-OCRv5 (May 2025); PP-StructureV3"),

        h2("Tesseract 5.x (Google/Community)"),
        para("Tesseract remains the most widely recognized OCR engine, serving as a baseline for simple deployments where complex layout analysis is unnecessary."),
        bulletBold("Strengths: ", "Zero-cost; 116 languages; CPU-only; ~10MB footprint; sub-second processing; massive community"),
        bulletBold("Limitations: ", "Struggles with tables, equations, multi-column layouts, and handwriting; multi-stage pipelines are brittle"),
        bulletBold("Cost: ", "Free (Apache 2.0)"),
        bulletBold("2025-2026: ", "v5.5.1 (May 2025), v5.5.2 (late 2025); incremental improvements; increasingly viewed as legacy"),

        h2("Surya / Chandra (Datalab)"),
        para("Surya emphasizes document layout analysis and reading-order detection. Its successor Chandra (October 2025) uses a fine-tuned Qwen-3-VL model with 9B parameters."),
        bulletBold("Strengths: ", "Best-in-class layout preservation; reading-order detection; 90+ languages; 50K+ combined GitHub stars with Marker"),
        bulletBold("Limitations: ", "GPU recommended; smaller community; pipeline approach in Surya (addressed by Chandra)"),
        bulletBold("2025-2026: ", "Chandra v0.1.0 scored 83.1% on olmOCR-Bench (highest open-source at time of release)"),

        h2("EasyOCR"),
        para("EasyOCR remains popular for quick-start scenarios but is no longer competitive for production workloads."),
        bulletBold("Strengths: ", "Simplest setup (pip install + 2 lines); 80+ languages; PyTorch-based"),
        bulletBold("Limitations: ", "Systematic failures on financial symbols; ~70% accuracy ceiling; no layout analysis"),

        h2("docTR (Mindee)"),
        para("A deep-learning OCR library using a two-stage detection+recognition pipeline with TensorFlow and PyTorch support."),
        bulletBold("Strengths: ", "Strong on structured documents (forms); dual-framework support; ~90% accuracy"),
        bulletBold("Limitations: ", "Weaker multilingual support out-of-box; smaller community"),

        h2("GOT-OCR 2.0 (General OCR Theory)"),
        para("A unified end-to-end model handling plain text, math formulas, molecular structures, tables, charts, sheet music, and geometric shapes."),
        bulletBold("Strengths: ", "Broadest scope of optical signals in a single model; research-grade capabilities"),
        bulletBold("Limitations: ", "Resource-heavy (LVLM architecture); requires significant GPU resources"),

        h2("DeepSeek-OCR"),
        para("A purpose-built multimodal transformer with innovative token compression (DeepEncoder ~380M params + DeepSeek-3B-MoE decoder)."),
        bulletBold("Strengths: ", "4.65 pages/sec; six resolution modes; on-premises deployment; strong text extraction"),
        bulletBold("Limitations: ", "Occasional hallucination; requires GPU; weaker layout than Mistral OCR"),

        h2("olmOCR-2 (Allen AI)"),
        para("Focused on high-throughput PDF-to-text conversion, supporting tables, equations, and handwriting."),
        bulletBold("Strengths: ", "82.4% accuracy at 1.78 pages/sec (153,792 pages/day); balanced accuracy + throughput"),
        bulletBold("Limitations: ", "Lacks layout-awareness; needs post-processing for structured extraction"),
        divider(),

        // ===== DEEP DIVE SLICE 2 =====
        h1("Deep Dive: Cloud-Managed OCR Services"),

        h2("Google Document AI"),
        bulletBold("Strengths: ", "95.8% average accuracy; superior on degraded documents (+4.9pp vs Textract); end-to-end custom labeling; strong handwriting"),
        bulletBold("Limitations: ", "Table extraction collapsed to 40% on 12K PO benchmark; requires GCP expertise"),
        bulletBold("Pricing: ", "300 free pages/month; $0.60/1K pages above 5M/month; $4,500/M pages cheaper than Textract at volume"),
        bulletBold("Best for: ", "Mixed scanned/digital PDFs with downstream Vertex AI or BigQuery pipelines"),

        h2("AWS Textract"),
        bulletBold("Strengths: ", "Industry-leading table extraction with cell-level mapping and merged cells; 8.9/10 ease of use; tight serverless integration"),
        bulletBold("Limitations: ", "No custom training; image quality sensitivity; AWS lock-in; expensive forms ($65/1K pages)"),
        bulletBold("Pricing: ", "$1.50/1K pages basic; free tier 1,000 pages/month for 3 months; volume discounts 33-40%"),
        bulletBold("Best for: ", "AWS-first teams processing invoices/receipts in existing S3 pipelines"),

        h2("Azure AI Document Intelligence"),
        bulletBold("Strengths: ", "Custom training in 30 minutes; richest semantic output; expanded pre-built models 2026; containerized on-prem; 93% mortgage field extraction"),
        bulletBold("Limitations: ", "QA needed on messy inputs; Microsoft ecosystem bias"),
        bulletBold("Pricing: ", "$1.50/1K read; $10/1K prebuilt; commitment tier $0.53/1K at 1M+ volume"),
        bulletBold("Best for: ", "Microsoft-centric enterprises; custom document types; hybrid/on-prem"),

        h2("Mistral OCR (API)"),
        bulletBold("Strengths: ", "Best layout understanding among API offerings; strong handwriting; fast processing; preserves structure"),
        bulletBold("Limitations: ", "Proprietary API; newer entrant with less ecosystem integration"),
        bulletBold("Pricing: ", "$1/1K pages \u2014 undercuts incumbents by 90%+"),
        bulletBold("Best for: ", "Document-processing where cost and quality both matter; handwriting-heavy forms"),
        divider(),

        // ===== DEEP DIVE SLICE 3 =====
        h1("Deep Dive: LLM/Multimodal Vision"),

        h2("GPT-4o / GPT-4.1 / GPT-5 (OpenAI)"),
        bulletBold("Strengths: ", "Highest absolute OCR benchmark performance; strong on charts, diagrams, visual math; 128K context"),
        bulletBold("Limitations: ", "Highest cost (~$15/1K pages); API-only; no fine-tuning; hallucination risk"),
        bulletBold("Best for: ", "High-stakes document understanding where accuracy justifies cost"),

        h2("Claude 4 / Sonnet 4.5 (Anthropic)"),
        bulletBold("Strengths: ", "200K token context (1M beta); shares highest OCR scores with Gemini 2.5 Pro; strong structured analysis"),
        bulletBold("Limitations: ", "API pricing; no self-hosting option"),
        bulletBold("Best for: ", "Long-document analysis; document Q&A; tasks requiring extraction and reasoning"),

        h2("Gemini 2.5 Pro / Gemini 3 (Google)"),
        bulletBold("Strengths: ", "Gemini 3 Flash leads vision benchmarks (79.0 MMMU Pro); Flash 2.0 does 6,000 pages/$1; strong complex layouts"),
        bulletBold("Limitations: ", "Latency on long documents; Google ecosystem preference"),
        bulletBold("Pricing: ", "~$0.17/1K pages (Flash 2.0) \u2014 cheaper than traditional OCR software"),
        bulletBold("Best for: ", "Cost-sensitive bulk processing; mixed layout documents; GCP teams"),

        h2("Qwen3-VL-235B (Alibaba)"),
        bulletBold("Strengths: ", "Rivals GPT-5 and Gemini 2.5 Pro; OCR in 32 languages; low-light/blurred/tilted images; fully open-source"),
        bulletBold("Limitations: ", "235B parameters requires substantial compute; latency concerns"),
        bulletBold("Best for: ", "Organizations needing GPT-5-class capabilities without API dependency"),

        h2("PaddleOCR-VL 7B (Open-Source)"),
        bulletBold("Strengths: ", "Leads OmniDocBench (92.86); outperforms GPT-5.4; Apache 2.0; runs on consumer GPU; 167x cheaper"),
        bulletBold("Limitations: ", "7B model less capable at reasoning/Q&A than larger LLMs"),
        bulletBold("Best for: ", "High-volume extraction where cost matters more than document Q&A"),

        h2("Hybrid Approaches"),
        para("Many production systems combine traditional OCR + LLM post-processing:"),
        bullet("OCR engine for reliable text extraction \u2192 LLM for semantic understanding and structuring"),
        bullet("Reduces hallucination risk while maintaining context awareness"),
        bullet("Example: Tesseract/PaddleOCR for extraction \u2192 Claude/GPT for field mapping and validation"),
        divider(),

        // ===== DEEP DIVE SLICE 4 =====
        h1("Deep Dive: Specialized & Vertical OCR"),

        h2("ABBYY Vantage / FineReader Engine 12"),
        bulletBold("Strengths: ", "200+ languages; joined handwriting (EN, FR, DE, ES, JA); Accurate Layout Analysis Mode; end-to-end IDP"),
        bulletBold("Limitations: ", "Enterprise pricing; complex deployment; legacy perception"),
        bulletBold("2025-2026: ", "FineReader Engine 12 R7; improved table/checkmark detection; Traditional Chinese; handwriting expansion"),
        bulletBold("Target: ", "Large enterprises with high-volume, multilingual document processing"),

        h2("Nanonets"),
        bulletBold("Strengths: ", "34% of Fortune 500; pre-trained models; custom models without coding; continuous improvement feedback loop"),
        bulletBold("Limitations: ", "SaaS pricing at scale; less control than self-hosted"),
        bulletBold("2025-2026: ", "Released Nanonets OCR2-3B open-source model (October 2025)"),
        bulletBold("Target: ", "Enterprise document automation (AP, order processing, insurance)"),

        h2("Rossum"),
        bulletBold("Strengths: ", "Zero-template AI (Aurora engine); self-improving via HITL; enterprise security (ISO 27001, SOC 2 Type II, HIPAA)"),
        bulletBold("Limitations: ", "$18K+/year starting price; focused on AP/invoicing"),
        bulletBold("2025-2026: ", "SDK releases (rossum-api 3.8.0, rossum-agent-client 1.1.0); streaming; recognized leading AI company in Eastern Europe"),
        bulletBold("Target: ", "Mid-market to enterprise accounts payable automation"),

        h2("Veryfi"),
        bulletBold("Strengths: ", "98.7% invoice accuracy; sub-3-second processing; 38 languages, 91 currencies; API-first"),
        bulletBold("Limitations: ", "Less suited for non-technical users; focused on financial documents"),
        bulletBold("Target: ", "Fintech developers, expense management apps, engineering teams"),

        h2("Mindee"),
        bulletBold("Strengths: ", "96.1% accuracy; fastest processing (0.9\u20131.3s); customizable industry models; creator of docTR"),
        bulletBold("Limitations: ", "Occasional issues with currency formatting and multi-page documents"),
        bulletBold("Target: ", "Developers needing customizable, fast OCR APIs"),

        h2("Transkribus (Historical Handwriting)"),
        bulletBold("Strengths: ", "Cursive/connected/irregular handwriting; 100+ languages; custom model training per style; GDPR-compliant EU hosting"),
        bulletBold("Limitations: ", "Struggles with general handwriting out-of-the-box; niche focus"),
        bulletBold("Target: ", "Historians, archivists, academic institutions, digital humanities"),

        h2("ID/Passport Scanning (Microblink, OCR Studio)"),
        bulletBold("Strengths: ", "Purpose-built for KYC/identity verification; >99.9% accuracy; real-time mobile capture; compliance-driven"),
        bulletBold("2025-2026: ", "OCR Studio ID scanning breakthroughs; WebAssembly in-browser OCR; multi-level passport scanning"),
        bulletBold("Target: ", "Banks, fintechs, identity verification providers, regulated industries"),
        divider(),

        // ===== RECOMMENDATIONS =====
        h1("Recommendations by Use Case"),
        new Paragraph({ spacing: { before: 120 }, children: [] }),
        makeTable(recHeaders, recRows, recWidths),
        divider(),

        // ===== KEY TRENDS =====
        h1("Key Trends for 2026"),
        numberedBold("Open-source supremacy: ", "Open-source VLM-based OCR models now outperform all commercial APIs on benchmarks while costing 167x less."),
        numberedBold("Pipeline death: ", "Traditional detect\u2192recognize\u2192post-process pipelines are being replaced by end-to-end VLMs that see entire documents at once."),
        numberedBold("Commoditization: ", "Basic OCR is effectively free; value has shifted to document understanding, workflow integration, and domain-specific accuracy."),
        numberedBold("Hybrid architectures: ", "Production systems increasingly combine traditional OCR (for reliability) with LLMs (for semantic understanding)."),
        numberedBold("October 2025 inflection: ", "Six major open-source OCR models in one month marked the tipping point for the industry."),
        divider(),

        // ===== SOURCES =====
        h1("Sources and References"),
        ...sources.map(([title, url]) => linkPara(title, url)),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("C:\\Users\\jerem\\Documents\\github\\abc-cc-workshop\\ocr-handson-h\\ocr_tech_scan.docx", buffer);
  console.log("SUCCESS: ocr_tech_scan.docx created (" + buffer.length + " bytes)");
});
