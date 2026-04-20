// Build a professional Word version of the intelligence report.
// Preserves: classification banners, metadata tables, heading hierarchy.
// Adds: table of contents, page numbers in footer.

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, VerticalAlign,
} = require(path.join(process.env.APPDATA || "", "npm", "node_modules", "docx"));

// ---- design tokens -----------------------------------------------------
const FONT_BODY = "Calibri";
const FONT_HEAD = "Calibri";
const FONT_MONO = "Consolas";
const COLOR_ACCENT = "1F3864";        // dark navy
const COLOR_ACCENT_LIGHT = "D9E2F3";  // header fill
const COLOR_CLASSIFICATION = "C00000"; // banner red
const COLOR_MUTED = "595959";
const COLOR_BORDER = "BFBFBF";

// US Letter, 1" margins
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 9360

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const BORDERS_ALL = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

// ---- helpers -----------------------------------------------------------
const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, line: 300 },
    ...opts,
    children: Array.isArray(text)
      ? runs(text)
      : [new TextRun({ text, font: FONT_BODY, size: 22 })],
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: COLOR_ACCENT, font: FONT_HEAD, size: 32 })],
    spacing: { before: 360, after: 160 },
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: COLOR_ACCENT, font: FONT_HEAD, size: 26 })],
    spacing: { before: 280, after: 120 },
  });

const h3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, color: COLOR_ACCENT, font: FONT_HEAD, size: 23 })],
    spacing: { before: 200, after: 80 },
  });

const runs = (parts) =>
  parts.map((part) => {
    if (typeof part === "string") return new TextRun({ text: part, font: FONT_BODY, size: 22 });
    const { text, ...rest } = part;
    return new TextRun({ text, font: FONT_BODY, size: 22, ...rest });
  });

const bullet = (parts) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80, line: 300 },
    children: Array.isArray(parts) ? runs(parts) : runs([parts]),
  });

const numItem = (parts) =>
  new Paragraph({
    numbering: { reference: "numbered", level: 0 },
    spacing: { after: 80, line: 300 },
    children: Array.isArray(parts) ? runs(parts) : runs([parts]),
  });

const mono = (lines) =>
  lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 0, line: 260 },
        shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
        children: [
          new TextRun({ text: line || " ", font: FONT_MONO, size: 20, color: "333333" }),
        ],
      })
  );

const blockquote = (text) =>
  new Paragraph({
    spacing: { before: 120, after: 180, line: 300 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: COLOR_ACCENT, space: 12 } },
    children: [new TextRun({ text, italics: true, font: FONT_BODY, size: 22, color: COLOR_MUTED })],
  });

// Classification banner (big, centered, red, bold)
const classificationBanner = () =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 12, color: COLOR_CLASSIFICATION, space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_CLASSIFICATION, space: 4 },
    },
    children: [
      new TextRun({
        text: "UNCLASSIFIED // FOR OFFICIAL USE ONLY",
        bold: true,
        font: FONT_HEAD,
        size: 26,
        color: COLOR_CLASSIFICATION,
      }),
    ],
  });

// ---- table builders ----------------------------------------------------
const cell = (children, opts = {}) => {
  const width = opts.width;
  return new TableCell({
    borders: BORDERS_ALL,
    margins: CELL_MARGINS,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: (Array.isArray(children) ? children : [children]).map((c) =>
      typeof c === "string"
        ? new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: c,
                font: FONT_BODY,
                size: 22,
                bold: opts.bold,
                color: opts.color,
              }),
            ],
          })
        : c
    ),
  });
};

const kvTable = (rows) => {
  const LABEL = 2700;
  const VALUE = CONTENT_WIDTH - LABEL;
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [LABEL, VALUE],
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            cell(k, { width: LABEL, bold: true, fill: COLOR_ACCENT_LIGHT }),
            cell(v, { width: VALUE }),
          ],
        })
    ),
  });
};

const dataTable = (header, rows) => {
  const colCount = header.length;
  const colWidth = Math.floor(CONTENT_WIDTH / colCount);
  const widths = new Array(colCount).fill(colWidth);
  // adjust last column to absorb rounding
  widths[colCount - 1] = CONTENT_WIDTH - colWidth * (colCount - 1);
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) =>
          cell(h, { width: widths[i], bold: true, fill: COLOR_ACCENT, color: "FFFFFF" })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value, i) => cell(String(value), { width: widths[i] })),
          })
      ),
    ],
  });
};

// ---- document content --------------------------------------------------
const metadataRows = [
  ["Report Serial", "IIR-2026-04-0142"],
  ["Originator", "Joint Information Operations Analysis Cell (JIOAC)"],
  ["Report Date", "20 April 2026"],
  ["Date(s) of Information", "15 March 2026 \u2013 18 April 2026"],
  ["Country / Region", "Indo-Pacific (AOR-7)"],
  ["Topic Code", "INFO-OPS / CIB / NARRATIVE-LAUNDERING"],
  ["Analytic Confidence", "Moderate"],
  ["Handling Caveats", "FOUO \u2014 Not Releasable to Contractors"],
];

const priorReporting = [
  ["IIR-2024-11-0087", "12 Nov 2024", "Initial identification of LACUS-7 asset cluster"],
  ["IIR-2025-03-0221", "04 Mar 2025", "First cross-platform pivot observed"],
  ["IIR-2025-09-0104", "19 Sep 2025", "Attribution baseline established (moderate confidence)"],
  ["IIR-2026-01-0019", "08 Jan 2026", "TTP overlap with known state-aligned actor confirmed"],
];

const audienceRows = [
  ["Platform W", "142", "640,000", "3.1%"],
  ["Platform X", "98", "410,000", "2.4%"],
  ["Platform Y", "67", "180,000", "1.9%"],
  ["Platform Z", "33", "95,000", "4.7%"],
  ["Total", "340", "~1.32 M", "\u2014"],
];

const sourceRows = [
  ["OSINT-A", "A \u2014 Completely reliable", "1 \u2014 Confirmed", "Platform-published transparency data"],
  ["OSINT-B", "B \u2014 Usually reliable", "2 \u2014 Probably true", "Academic research consortium"],
  ["LIAISON-1", "B \u2014 Usually reliable", "2 \u2014 Probably true", "Partner service reporting"],
  ["LIAISON-2", "C \u2014 Fairly reliable", "3 \u2014 Possibly true", "Partner service reporting"],
  ["TECHINT-1", "B \u2014 Usually reliable", "2 \u2014 Probably true", "Proprietary infrastructure telemetry"],
];

const glossaryRows = [
  ["BLUF", "Bottom Line Up Front"],
  ["CIB", "Coordinated Inauthentic Behavior"],
  ["DISARM", "Disinformation Analysis and Risk Management framework"],
  ["IOC", "Indicator of Compromise"],
  ["ICD", "Intelligence Community Directive"],
  ["JIOAC", "Joint Information Operations Analysis Cell"],
  ["TTP", "Tactics, Techniques, and Procedures"],
  ["WEP", "Words of Estimative Probability"],
];

const adminRows = [
  ["Drafted by", "Lorem I. Analyst, JIOAC/A2"],
  ["Reviewed by", "Ipsum D. Reviewer, JIOAC/A3"],
  ["Released by", "Dolor S. Chief, JIOAC/Director"],
  ["Classification Authority", "Derivative \u2014 SCG JIOAC-2024"],
  ["Declassify On", "20 April 2036"],
  ["Feedback", "jioac.feedback@example.gov"],
];

const infrastructureLines = [
  "Hosting ASN Clusters:",
  "  - AS-LOREM-1 (47 assets, 13.8%)",
  "  - AS-IPSUM-2 (112 assets, 32.9%)",
  "  - AS-DOLOR-3 (68 assets, 20.0%)",
  "",
  "Domain Registration Patterns:",
  "  - Bulk registration via 3 reseller fronts",
  "  - Whois privacy on 94% of assets",
  "  - Average domain age at activation: 47 days",
  "",
  "Shared TLS Fingerprints:",
  "  - JA3: a1b2c3d4e5f6... (observed on 234 assets)",
  "  - JA3S: f6e5d4c3b2a1... (observed on 198 assets)",
];

const iocLines = [
  "domains:",
  "  - lorem-news-daily[.]example",
  "  - ipsum-voice[.]example",
  "  - dolor-tribune[.]example",
  "  - sit-amet-observer[.]example",
  "",
  "personas_handles:",
  "  - \"@LoremWatcher_24\"",
  "  - \"@IpsumVoice_Regional\"",
  "  - \"@DolorReporter\"",
  "",
  "ja3_hashes:",
  "  - a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "  - f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1",
  "",
  "email_tradecraft:",
  "  - pattern: \"{word}.{word}{2digits}@protonmail.com\"",
  "  - registration_burst: \"2025-09-14 to 2025-09-19\"",
];

// ---- build sections ----------------------------------------------------
const coverPage = [
  classificationBanner(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 200 },
    children: [
      new TextRun({
        text: "INTELLIGENCE INFORMATION REPORT (IIR)",
        bold: true,
        font: FONT_HEAD,
        size: 44,
        color: COLOR_ACCENT,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
    children: [
      new TextRun({
        text: "Coordinated Inauthentic Behavior Campaign \u201CDOLOR SIT\u201D",
        bold: true,
        font: FONT_HEAD,
        size: 28,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [
      new TextRun({
        text: "Targeting Regional Discourse on Maritime Security",
        font: FONT_HEAD,
        size: 24,
        italics: true,
        color: COLOR_MUTED,
      }),
    ],
  }),
  kvTable(metadataRows),
  new Paragraph({ children: [new PageBreak()] }),
];

const tocPage = [
  new Paragraph({
    spacing: { before: 120, after: 240 },
    children: [
      new TextRun({
        text: "Table of Contents",
        bold: true,
        font: FONT_HEAD,
        size: 36,
        color: COLOR_ACCENT,
      }),
    ],
  }),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

const body = [
  // Section 1 - BLUF
  h1("1. Bottom Line Up Front (BLUF)"),
  p([
    { text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " },
    { text: "A state-aligned influence actor \u2014 tracked internally as " },
    { text: "DOLOR SIT", bold: true },
    { text: " \u2014 is " },
    { text: "almost certainly", bold: true },
    {
      text:
        " conducting a sustained, cross-platform narrative-laundering operation intended to erode public trust in regional maritime security cooperation. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. The campaign leverages at least 340 inauthentic assets across four platforms and is assessed to have reached an audience of ",
    },
    { text: "1.2\u20131.8 million unique users", bold: true },
    { text: " during the reporting period." },
  ]),

  // Section 2 - Key Judgments
  h1("2. Key Judgments"),
  p([
    { text: "Analytic confidence expressed in accordance with " },
    { text: "ICD 203", bold: true },
    { text: " standards. Probability language per the Words of Estimative Probability (WEP) scale." },
  ]),
  bullet([
    { text: "KJ-1. ", bold: true },
    { text: "We assess with " },
    { text: "high confidence", bold: true },
    { text: " that DOLOR SIT is operated by, or on behalf of, a foreign state actor. " },
    { text: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.", italics: true },
  ]),
  bullet([
    { text: "KJ-2. ", bold: true },
    { text: "DOLOR SIT " },
    { text: "very likely", bold: true },
    { text: " (80\u201395%) coordinates its activity through a centralized tasking mechanism, based on synchronized posting cadences and shared infrastructure fingerprints. " },
    { text: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.", italics: true },
  ]),
  bullet([
    { text: "KJ-3. ", bold: true },
    { text: "The operation is " },
    { text: "likely", bold: true },
    { text: " (55\u201380%) to intensify ahead of the regional ministerial summit scheduled for Q3 2026. " },
    { text: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.", italics: true },
  ]),
  bullet([
    { text: "KJ-4. ", bold: true },
    { text: "We judge with " },
    { text: "moderate confidence", bold: true },
    { text: " that organic amplification by unwitting domestic audiences now exceeds inauthentic amplification by a ratio of approximately 3:1, indicating the campaign has crossed a narrative-laundering threshold. " },
    { text: "Mollit anim id est laborum.", italics: true },
  ]),

  // Section 3 - Scope Note
  h1("3. Scope Note"),
  p([
    { text: "This assessment covers open-source and partner-shared reporting between " },
    { text: "15 March 2026", bold: true },
    { text: " and " },
    { text: "18 April 2026", bold: true },
    { text: ". It addresses the tactics, techniques, and procedures (TTPs), infrastructure, narratives, and assessed intent of the DOLOR SIT activity cluster. It does " },
    { text: "not", bold: true },
    { text: " address kinetic or cyber-intrusion activity, which are treated in companion products IIR-2026-04-0138 (cyber) and IIR-2026-04-0140 (maritime posture)." },
  ]),
  p([{ text: "Assumptions:", bold: true }]),
  numItem("Lorem ipsum dolor sit amet \u2014 platform-provided telemetry is representative of the broader information environment."),
  numItem("Consectetur adipiscing elit \u2014 attribution indicators have not been deliberately falsified for deception purposes (low-to-moderate confidence in this assumption)."),

  // Section 4 - Executive Summary
  h1("4. Executive Summary"),
  p("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."),
  p("Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo."),
  blockquote("Analytic Note: Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt."),

  // Section 5 - Background
  h1("5. Background"),
  h2("5.1 Historical Context"),
  p([
    { text: "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt. DOLOR SIT was first identified in partner reporting dated " },
    { text: "November 2024", bold: true },
    { text: " under the alias cluster \u201CLACUS-7.\u201D Ut labore et dolore magnam aliquam quaerat voluptatem." },
  ]),
  h2("5.2 Prior Reporting"),
  dataTable(["Report", "Date", "Key Finding"], priorReporting),
  h2("5.3 Operating Environment"),
  p("Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur."),

  // Section 6 - Analysis
  h1("6. Analysis"),
  h2("6.1 Tactics, Techniques, and Procedures (TTPs)"),
  p([
    { text: "The DOLOR SIT cluster exhibits the following TTPs, mapped to the " },
    { text: "DISARM Framework", bold: true },
    { text: ":" },
  ]),
  bullet([
    { text: "T0086 \u2014 Develop AI-Generated Text. ", bold: true },
    { text: "Lorem ipsum dolor sit amet. Observed across 42% of sampled posts." },
  ]),
  bullet([
    { text: "T0049.003 \u2014 Bots Amplify via Automated Forwarding. ", bold: true },
    { text: "Consectetur adipiscing elit, with synchronized 11-second posting windows." },
  ]),
  bullet([
    { text: "T0104.001 \u2014 Create Cross-Platform Brand. ", bold: true },
    { text: "Sed do eiusmod tempor incididunt. Consistent persona naming conventions across four platforms." },
  ]),
  bullet([
    { text: "T0022 \u2014 Leverage Existing Narratives. ", bold: true },
    { text: "Ut labore et dolore magna aliqua. Co-option of legitimate grievance narratives from domestic civil society." },
  ]),
  bullet([
    { text: "T0059 \u2014 Play the Long Game. ", bold: true },
    { text: "Assets show dormancy-to-activation patterns consistent with pre-positioned infrastructure." },
  ]),

  h2("6.2 Narrative Analysis"),
  p("Three dominant narrative themes were identified through thematic coding of 8,412 sampled posts:"),
  numItem([
    { text: "Narrative Alpha \u2014 \u201CSovereignty Erosion.\u201D ", bold: true },
    { text: "Quis nostrud exercitation ullamco laboris", italics: true },
    { text: " \u2014 alleges that regional security cooperation compromises national sovereignty. Represents ~47% of observed content." },
  ]),
  numItem([
    { text: "Narrative Beta \u2014 \u201CEconomic Dependency.\u201D ", bold: true },
    { text: "Ut aliquip ex ea commodo consequat", italics: true },
    { text: " \u2014 frames cooperation as economic subjugation. Represents ~31% of observed content." },
  ]),
  numItem([
    { text: "Narrative Gamma \u2014 \u201CManufactured Consent.\u201D ", bold: true },
    { text: "Duis aute irure dolor", italics: true },
    { text: " \u2014 alleges domestic media is captured by foreign interests. Represents ~18% of observed content." },
  ]),

  h2("6.3 Infrastructure and Technical Indicators"),
  p("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Infrastructure analysis reveals the following overlap patterns:"),
  ...mono(infrastructureLines),

  h2("6.4 Audience and Reach"),
  dataTable(["Platform", "Inauthentic Assets", "Est. Reach (unique)", "Engagement Rate"], audienceRows),

  h2("6.5 Attribution"),
  p([
    { text: "Sed ut perspiciatis unde omnis iste natus error.", italics: true },
    { text: " Attribution is assessed at " },
    { text: "moderate confidence", bold: true },
    { text: " based on the convergence of:" },
  ]),
  bullet([
    { text: "Technical overlap", bold: true },
    { text: " with previously attributed infrastructure (strong indicator)." },
  ]),
  bullet([
    { text: "Linguistic fingerprinting", bold: true },
    { text: " consistent with non-native authorship of the target language (moderate indicator)." },
  ]),
  bullet([
    { text: "Operational cadence", bold: true },
    { text: " aligned with a specific time zone and national workweek pattern (moderate indicator)." },
  ]),
  bullet([
    { text: "Thematic congruence", bold: true },
    { text: " with known state messaging priorities (supporting indicator)." },
  ]),

  // Section 7 - Outlook
  h1("7. Outlook"),
  p([
    { text: "Over the next " },
    { text: "60\u201390 days", bold: true },
    { text: ", we assess the following:" },
  ]),
  bullet([
    { text: "Likely (55\u201380%): ", bold: true },
    { text: "DOLOR SIT will expand to at least one additional platform, " },
    { text: "sed quia consequuntur magni dolores.", italics: true },
  ]),
  bullet([
    { text: "Roughly Even Chance (45\u201355%): ", bold: true },
    { text: "The operation will attempt to seed content into legitimate domestic media through laundering intermediaries." },
  ]),
  bullet([
    { text: "Unlikely (20\u201345%): ", bold: true },
    { text: "Operators will be publicly exposed by platform trust-and-safety action within the window." },
  ]),
  bullet([
    { text: "Very Unlikely (5\u201320%): ", bold: true },
    { text: "The cluster will be voluntarily deactivated absent external disruption." },
  ]),

  // Section 8 - Intelligence Gaps
  h1("8. Intelligence Gaps"),
  p("The following gaps constrain analytic confidence and should be prioritized for collection:"),
  numItem([
    { text: "GAP-1: ", bold: true },
    { text: "Neque porro quisquam est qui dolorem ipsum.", italics: true },
    { text: " Identity and organizational placement of the operational tasking node." },
  ]),
  numItem([
    { text: "GAP-2: ", bold: true },
    { text: "Quis autem vel eum iure reprehenderit.", italics: true },
    { text: " Funding and financial infrastructure supporting the campaign." },
  ]),
  numItem([
    { text: "GAP-3: ", bold: true },
    { text: "Ut enim ad minima veniam.", italics: true },
    { text: " Relationship, if any, between DOLOR SIT operators and known cyber-intrusion units." },
  ]),
  numItem([
    { text: "GAP-4: ", bold: true },
    { text: "Ground-truth measurement of narrative uptake among targeted demographic segments." },
  ]),

  // Section 9 - Implications and Recommendations
  h1("9. Implications and Recommendations"),
  h2("9.1 Implications"),
  p("Lorem ipsum dolor sit amet, consectetur adipiscing elit. If left undisrupted, DOLOR SIT\u2019s narrative-laundering threshold is likely to produce measurable shifts in domestic polling on regional cooperation within two to three reporting quarters."),
  h2("9.2 Recommendations"),
  bullet([
    { text: "R-1 (Collection): ", bold: true },
    { text: "Prioritize HUMINT and SIGINT collection against GAP-1 and GAP-2.", italics: true },
  ]),
  bullet([
    { text: "R-2 (Analytic): ", bold: true },
    { text: "Establish a recurring 30-day narrative-tracking product with partner cell.", italics: true },
  ]),
  bullet([
    { text: "R-3 (Engagement): ", bold: true },
    { text: "Coordinate pre-briefing to platform trust-and-safety teams under established disclosure framework.", italics: true },
  ]),
  bullet([
    { text: "R-4 (Strategic Communication): ", bold: true },
    { text: "Support partner government pre-bunking campaign ahead of Q3 ministerial summit.", italics: true },
  ]),

  // Section 10 - Source Summary Statement
  h1("10. Source Summary Statement"),
  p([
    { text: "This product is based on a combination of open-source collection, platform-provided telemetry, and liaison reporting from two partner services. Source reliability is graded per the " },
    { text: "Admiralty System (NATO STANAG 2511)", bold: true },
    { text: "." },
  ]),
  dataTable(["Source ID", "Reliability", "Credibility", "Nature"], sourceRows),
  p([
    { text: "Overall source base is assessed as " },
    { text: "adequate but not decisive", bold: true },
    { text: "; key judgments have been stress-tested through structured analytic techniques including " },
    { text: "Analysis of Competing Hypotheses (ACH)", bold: true },
    { text: " and " },
    { text: "Key Assumptions Check", bold: true },
    { text: "." },
  ]),

  // Section 11 - Annexes
  h1("11. Annexes"),
  h2("Annex A \u2014 Indicators of Compromise (IOCs)"),
  ...mono(iocLines),

  h2("Annex B \u2014 Sample Narrative Artifacts (Redacted)"),
  blockquote("\u201CLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\u201D \u2014 Translated from Narrative Alpha, posted 04 Apr 2026, reach ~42,000."),
  blockquote("\u201CUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\u201D \u2014 Translated from Narrative Beta, posted 11 Apr 2026, reach ~28,500."),

  h2("Annex C \u2014 Analytic Techniques Applied"),
  bullet("Analysis of Competing Hypotheses (ACH)"),
  bullet("Key Assumptions Check"),
  bullet("Indicators and Signposts of Change"),
  bullet("Red Team Review (conducted 17 Apr 2026)"),

  h2("Annex D \u2014 Glossary and Acronyms"),
  dataTable(["Term", "Definition"], glossaryRows),

  // Section 12 - Report Administration
  h1("12. Report Administration"),
  kvTable(adminRows),

  // Closing banner
  new Paragraph({ spacing: { before: 360 }, children: [] }),
  classificationBanner(),
];

// ---- assemble document -------------------------------------------------
const doc = new Document({
  creator: "JIOAC",
  title: "IIR-2026-04-0142 \u2014 DOLOR SIT",
  description: "Intelligence Information Report",
  styles: {
    default: { document: { run: { font: FONT_BODY, size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: FONT_HEAD, color: COLOR_ACCENT },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: FONT_HEAD, color: COLOR_ACCENT },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 23, bold: true, font: FONT_HEAD, color: COLOR_ACCENT },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbered",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: "UNCLASSIFIED // FOR OFFICIAL USE ONLY",
                  bold: true,
                  font: FONT_HEAD,
                  size: 18,
                  color: COLOR_CLASSIFICATION,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: "UNCLASSIFIED // FOR OFFICIAL USE ONLY",
                  bold: true,
                  font: FONT_HEAD,
                  size: 18,
                  color: COLOR_CLASSIFICATION,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 0 },
              tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
              children: [
                new TextRun({ text: "IIR-2026-04-0142", font: FONT_BODY, size: 18, color: COLOR_MUTED }),
                new TextRun({ text: "\tPage ", font: FONT_BODY, size: 18, color: COLOR_MUTED }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 18, color: COLOR_MUTED }),
                new TextRun({ text: " of ", font: FONT_BODY, size: 18, color: COLOR_MUTED }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT_BODY, size: 18, color: COLOR_MUTED }),
              ],
            }),
          ],
        }),
      },
      children: [...coverPage, ...tocPage, ...body],
    },
  ],
});

const outPath = path.join(__dirname, "intelligence_report_DOLOR_SIT.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("Wrote", outPath, "(" + buf.length + " bytes)");
});
