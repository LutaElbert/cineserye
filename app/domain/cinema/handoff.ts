import type { CinemaPlanRevisionRecord, CinemaProjectData } from './project-data';
import type { CinemaProfessionalPlanningData } from './professional-planning';
import { buildContinuityMatrix } from './professional-planning';

export type CinemaHandoffFile = {
  kind: 'csv' | 'json' | 'markdown' | 'pdf';
  fileName: string;
  mimeType: string;
  content: string | Uint8Array;
};

export type CinemaHandoffPackage = {
  baseName: string;
  revisionId: string;
  generatedAt: string;
  files: CinemaHandoffFile[];
  warnings: string[];
};

export type CinemaHandoffArchive = {
  fileName: string;
  mimeType: 'application/zip';
  content: Uint8Array;
};

function cleanText(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

export function safeHandoffFileName(value: string) {
  const normalized = value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96)
    .toLocaleLowerCase();
  return normalized || 'cineserye-project';
}

export function safeExportUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function spreadsheetSafeCell(value: string | number | null) {
  if (value === null) return '';
  const text = cleanText(String(value));
  return /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
}

function csvCell(value: string | number | null) {
  return `"${spreadsheetSafeCell(value).replaceAll('"', '""')}"`;
}

function markdownText(value: string) {
  return cleanText(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function revisionFor(project: CinemaProjectData, revisionId: string) {
  const revision = project.revisions[revisionId];
  if (!revision) throw new Error(`Plan revision ${revisionId} is missing.`);
  return revision;
}

function revisionShots(revision: CinemaPlanRevisionRecord) {
  return revision.snapshot.scene.shotIds.map((shotId) => revision.snapshot.shots[shotId]);
}

function costPerShot(project: CinemaProjectData, planning: CinemaProfessionalPlanningData, shotId: string) {
  const direct = planning.shots[shotId]?.estimatedCost;
  if (direct !== null && direct !== undefined) return direct;
  const shot = project.shots[shotId];
  const scene = shot ? project.scenes[shot.sceneId] : null;
  const cost = Object.values(project.costs).find((record) => record.sceneId === scene?.id);
  return cost?.expected === null || !scene?.shotIds.length ? null : Math.round((cost!.expected! / scene.shotIds.length) * 100) / 100;
}

function shotRows(
  project: CinemaProjectData,
  planning: CinemaProfessionalPlanningData,
  revision: CinemaPlanRevisionRecord,
) {
  return revisionShots(revision).map((shot) => {
    const production = planning.shots[shot.id];
    const setup = production ? planning.setups[production.setupId] : null;
    return {
      narrativeOrder: shot.order,
      productionOrder: production?.productionOrder ?? shot.order,
      shot: shot.title,
      beat: shot.purpose,
      description: shot.description,
      framing: shot.framing,
      angle: shot.framing.match(/(?:low|high|eye|dutch|overhead|over-the-shoulder)/i)?.[0] ?? '',
      movement: shot.cameraMovement,
      lensMm: shot.lensMm,
      durationSeconds: shot.durationSeconds,
      audio: shot.audio,
      continuity: shot.continuityNodeIds.map((nodeId) =>
        Object.values(project.characters).find((record) => record.nodeId === nodeId)?.title
        ?? Object.values(project.assets).find((record) => record.nodeId === nodeId)?.title
        ?? nodeId).join('; '),
      risk: shot.risk,
      cost: costPerShot(project, planning, shot.id),
      status: production?.status ?? 'planned',
      setup: setup?.name ?? '',
    };
  });
}

export function buildShotListCsv(
  project: CinemaProjectData,
  planning: CinemaProfessionalPlanningData,
  revisionId: string,
) {
  const revision = revisionFor(project, revisionId);
  const rows = shotRows(project, planning, revision);
  const headings = [
    'Narrative order', 'Production order', 'Shot', 'Beat', 'Description', 'Framing', 'Angle',
    'Movement', 'Lens mm', 'Duration seconds', 'Audio', 'Continuity', 'Risk', 'Illustrative cost',
    'Status', 'Setup',
  ];
  return [
    headings.map(csvCell).join(','),
    ...rows.map((row) => Object.values(row).map((value) => csvCell(value)).join(',')),
  ].join('\r\n');
}

export function buildPromptPackageMarkdown(project: CinemaProjectData, revisionId: string) {
  const revision = revisionFor(project, revisionId);
  const prompts = Object.values(revision.snapshot.prompts).sort((left, right) =>
    left.ownerNodeId.localeCompare(right.ownerNodeId) || left.purpose.localeCompare(right.purpose));
  return [
    `# ${markdownText(revision.snapshot.scene.title)} — prompt package`,
    '',
    `Revision: ${markdownText(revision.id)} · accepted ${markdownText(revision.acceptedAt)}`,
    '',
    ...prompts.flatMap((prompt) => [
      `## ${markdownText(prompt.label)}`,
      '',
      `Purpose: ${markdownText(prompt.purpose)} · version ${prompt.version} · status ${markdownText(prompt.status)}`,
      '',
      markdownText(prompt.generatedText),
      '',
      prompt.negativeConstraints.length ? `Avoid: ${prompt.negativeConstraints.map(markdownText).join('; ')}` : 'Avoid: none specified',
      '',
    ]),
  ].join('\n');
}

export function buildSourceReportMarkdown(project: CinemaProjectData, revisionId: string) {
  const revision = revisionFor(project, revisionId);
  const sources = Object.values(revision.snapshot.sources).sort((left, right) => left.title.localeCompare(right.title));
  const references = Object.values(project.visualPreproduction?.references ?? {})
    .filter((reference) => reference.sceneId === revision.sceneId)
    .sort((left, right) => left.title.localeCompare(right.title));
  return [
    `# ${markdownText(revision.snapshot.scene.title)} — sources and provenance`,
    '',
    '## Research sources',
    '',
    ...(sources.length ? sources.flatMap((source) => {
      const url = safeExportUrl(source.url);
      return [
        `- **${markdownText(source.title)}** — ${markdownText(source.publisher)} (${markdownText(source.status)})`,
        `  - Finding: ${markdownText(source.finding)}`,
        `  - URL: ${url ? markdownText(url) : 'Not exported or unsafe'}`,
      ];
    }) : ['No research sources.']),
    '',
    '## Visual references',
    '',
    ...(references.length ? references.map((reference) => {
      const url = safeExportUrl(reference.sourceUrl);
      return `- **${markdownText(reference.title)}** — ${markdownText(reference.type)}, ${markdownText(reference.rightsStatus)}, ${markdownText(reference.approvalStatus)}; provenance: ${markdownText(reference.provenance)}; source: ${url ? markdownText(url) : 'local or not exported'}`;
    }) : ['No visual references.']),
  ].join('\n');
}

export function buildCostReportCsv(project: CinemaProjectData, revisionId: string) {
  const revision = revisionFor(project, revisionId);
  const headings = ['Scene', 'Provider', 'Model', 'Pricing mode', 'Currency', 'Minimum', 'Expected', 'High risk', 'Ceiling', 'Outputs', 'Retry allowance', 'Snapshot date', 'Disclaimer'];
  const rows = Object.values(revision.snapshot.costs).map((cost) => [
    revision.snapshot.scene.title, cost.provider, cost.model, cost.pricingMode, cost.currency,
    cost.minimum, cost.expected, cost.highRisk, cost.ceiling, cost.outputCount, cost.retryAllowance,
    cost.pricingSnapshotDate, 'Illustrative estimate only; verify provider pricing and physical-production costs before spending.',
  ]);
  return [headings.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}

function ascii(value: string) {
  return cleanText(value)
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u00b7\u2022]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '');
}

function pdfEscape(value: string) {
  return ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrapPdfLine(value: string, limit = 88) {
  const normalized = ascii(value);
  if (!normalized || normalized.length <= limit) return [normalized];
  const indentation = normalized.match(/^\s+/)?.[0] ?? '';
  const continuation = indentation || '    ';
  const words = normalized.trim().split(/\s+/);
  const lines: string[] = [];
  let line = indentation;
  words.forEach((word) => {
    const candidate = line.trim() ? `${line} ${word}` : `${line}${word}`;
    if (candidate.length <= limit) {
      line = candidate;
      return;
    }
    if (line.trim()) lines.push(line);
    line = `${continuation}${word}`;
  });
  if (line.trim()) lines.push(line);
  return lines;
}

export function buildShotListPdf(
  project: CinemaProjectData,
  planning: CinemaProfessionalPlanningData,
  revisionId: string,
): Uint8Array {
  const revision = revisionFor(project, revisionId);
  const rows = shotRows(project, planning, revision);
  const lines = [
    `CINESERYE / ${revision.snapshot.scene.title}`,
    `Revision ${revision.number} / accepted ${revision.acceptedAt}`,
    '',
    ...rows.flatMap((row) => [
      `${String(row.narrativeOrder).padStart(2, '0')}  ${row.shot}  [production ${row.productionOrder}]`,
      `    ${row.framing}; ${row.movement}; ${row.durationSeconds}s; ${row.status}; ${row.setup}`,
      `    Audio: ${row.audio}`,
      `    Continuity: ${row.continuity || 'none recorded'}; risk: ${row.risk}; cost: ${row.cost ?? 'unpriced'}`,
    ]),
    '',
    'Illustrative costs only. Verify provider pricing, rights, continuity, and production assumptions before spending.',
  ];
  const wrappedLines = lines.flatMap((line) => wrapPdfLine(line));
  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += 42) pages.push(wrappedLines.slice(index, index + 42));
  const objects: string[] = [];
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    contentIds.push(contentId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const body = [
      'BT', '/F1 9 Tf', '42 750 Td', '12 TL',
      ...page.flatMap((line, lineIndex) => [`(${pdfEscape(line)}) Tj`, lineIndex === page.length - 1 ? '' : 'T*']).filter(Boolean),
      'ET',
      'BT', '/F1 8 Tf', '500 24 Td', `(Page ${index + 1} of ${pages.length}) Tj`, 'ET',
    ].join('\n');
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let source = '%PDF-1.4\n% Cineserye local handoff\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = source.length;
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = source.length;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}

export function buildHandoffPackage(
  project: CinemaProjectData,
  planning: CinemaProfessionalPlanningData,
  revisionId: string,
  generatedAt = new Date().toISOString(),
): CinemaHandoffPackage {
  const revision = revisionFor(project, revisionId);
  const matrix = buildContinuityMatrix(project, planning, revision.sceneId);
  const baseName = safeHandoffFileName(`${project.projectId}-${revision.snapshot.scene.title}-r${revision.number}`);
  const summary = {
    format: 'cineserye-handoff',
    version: 1,
    generatedAt,
    projectId: project.projectId,
    sceneId: revision.sceneId,
    revisionId,
    acceptedAt: revision.acceptedAt,
    narrativeShotIds: [...revision.snapshot.scene.shotIds],
    productionShotIds: [...revision.snapshot.scene.shotIds].sort((left, right) =>
      planning.shots[left].productionOrder - planning.shots[right].productionOrder),
    continuityIssues: matrix.issues,
    setups: Object.values(planning.setups).filter((setup) => setup.sceneId === revision.sceneId),
    shots: shotRows(project, planning, revision),
    disclaimer: 'Costs are illustrative. Verify provider pricing, rights, continuity, and production assumptions before spending.',
  };
  return {
    baseName,
    revisionId,
    generatedAt,
    warnings: matrix.issues.map((issue) => issue.message),
    files: [
      { kind: 'csv', fileName: `${baseName}-shot-list.csv`, mimeType: 'text/csv;charset=utf-8', content: buildShotListCsv(project, planning, revisionId) },
      { kind: 'pdf', fileName: `${baseName}-shot-list.pdf`, mimeType: 'application/pdf', content: buildShotListPdf(project, planning, revisionId) },
      { kind: 'markdown', fileName: `${baseName}-prompts.md`, mimeType: 'text/markdown;charset=utf-8', content: buildPromptPackageMarkdown(project, revisionId) },
      { kind: 'markdown', fileName: `${baseName}-sources.md`, mimeType: 'text/markdown;charset=utf-8', content: buildSourceReportMarkdown(project, revisionId) },
      { kind: 'csv', fileName: `${baseName}-costs.csv`, mimeType: 'text/csv;charset=utf-8', content: buildCostReportCsv(project, revisionId) },
      { kind: 'json', fileName: `${baseName}-handoff.json`, mimeType: 'application/json;charset=utf-8', content: JSON.stringify(summary, null, 2) },
    ],
  };
}

function zipCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipBytes(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function zipHeader(size: number) {
  return new Uint8Array(size);
}

function setZipUint16(header: Uint8Array, offset: number, value: number) {
  new DataView(header.buffer).setUint16(offset, value, true);
}

function setZipUint32(header: Uint8Array, offset: number, value: number) {
  new DataView(header.buffer).setUint32(offset, value, true);
}

/** Builds a dependency-free, uncompressed ZIP so one user gesture works in every supported browser. */
export function buildHandoffArchive(handoff: CinemaHandoffPackage): CinemaHandoffArchive {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  handoff.files.forEach((file) => {
    const name = encoder.encode(file.fileName);
    const content = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = zipCrc32(content);
    const local = zipHeader(30);
    setZipUint32(local, 0, 0x04034b50);
    setZipUint16(local, 4, 20);
    setZipUint32(local, 14, crc);
    setZipUint32(local, 18, content.length);
    setZipUint32(local, 22, content.length);
    setZipUint16(local, 26, name.length);
    localParts.push(local, name, content);

    const central = zipHeader(46);
    setZipUint32(central, 0, 0x02014b50);
    setZipUint16(central, 4, 20);
    setZipUint16(central, 6, 20);
    setZipUint32(central, 16, crc);
    setZipUint32(central, 20, content.length);
    setZipUint32(central, 24, content.length);
    setZipUint16(central, 28, name.length);
    setZipUint32(central, 42, localOffset);
    centralParts.push(central, name);
    localOffset += local.length + name.length + content.length;
  });
  const centralDirectory = zipBytes(centralParts);
  const end = zipHeader(22);
  setZipUint32(end, 0, 0x06054b50);
  setZipUint16(end, 8, handoff.files.length);
  setZipUint16(end, 10, handoff.files.length);
  setZipUint32(end, 12, centralDirectory.length);
  setZipUint32(end, 16, localOffset);
  return {
    fileName: `${handoff.baseName}-handoff.zip`,
    mimeType: 'application/zip',
    content: zipBytes([...localParts, centralDirectory, end]),
  };
}
