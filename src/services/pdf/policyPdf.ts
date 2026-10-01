// Real PDF documents for a policy: the Declarations Page and the policy packet issued at bind
// (Insured Copy, Agent Copy and Lienholder Copy). Built with jsPDF, entirely in the browser.
// Every page carries the training-simulation watermark so a printout can never pass as real
// proof of insurance.
import { GState, jsPDF } from 'jspdf';
import type { PolicyRecord } from '@/types/policy';
import { CLAIMS_LINE } from '@/servicing/portal/portalUtils';
import { rulesFor } from '@/data/states';
import { notify } from '@/services/activity';

export type PacketCopy = 'Insured Copy' | 'Agent Copy' | 'Lienholder Copy';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const NAVY: [number, number, number] = [0, 56, 101];
const GREY: [number, number, number] = [82, 97, 108];
const LINE: [number, number, number] = [198, 214, 225];
const money = (value: number) => `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Ctx { doc: jsPDF; y: number; policy: PolicyRecord; title: string; copy?: PacketCopy }

function watermark(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.07 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(64);
  doc.setTextColor(...NAVY);
  // Rotated text turns around its start point, so offset the start to centre it on the page.
  const text = 'TRAINING SIMULATION';
  const width = doc.getTextWidth(text);
  const angle = (35 * Math.PI) / 180;
  doc.text(text, PAGE_W / 2 - (width / 2) * Math.cos(angle), PAGE_H / 2 + (width / 2) * Math.sin(angle), { angle: 35 });
  doc.restoreGraphicsState();
}

function pageHeader(ctx: Ctx) {
  const { doc, policy } = ctx;
  watermark(doc);
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(15);
  doc.text('FOR', MARGIN, 33);
  doc.setFont('helvetica', 'bold');
  doc.text('AGENTS', MARGIN + doc.getTextWidth('FOR') + 1, 33);
  doc.setFont('helvetica', 'normal');
  doc.text('ONLY', MARGIN + doc.getTextWidth('FORAGENTS') + 4, 33);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(ctx.title, PAGE_W - MARGIN, 26, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`${policy.productName} Policy #${policy.policyNumber} · Term ${policy.termNumber}`, PAGE_W - MARGIN, 40, { align: 'right' });
  doc.setFillColor(253, 232, 234);
  doc.rect(MARGIN, 64, CONTENT_W, 16, 'F');
  doc.setTextColor(200, 16, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('TRAINING SIMULATION ONLY. NOT A VALID INSURANCE DOCUMENT OR PROOF OF COVERAGE.', PAGE_W / 2, 75, { align: 'center' });
  if (ctx.copy) {
    doc.setDrawColor(...NAVY); doc.setLineWidth(1.2);
    doc.rect(PAGE_W - MARGIN - 110, 88, 110, 20);
    doc.setTextColor(...NAVY); doc.setFontSize(9);
    doc.text(ctx.copy.toUpperCase(), PAGE_W - MARGIN - 55, 101.5, { align: 'center' });
  }
  ctx.y = ctx.copy ? 122 : 100;
}

function pageFooters(doc: jsPDF, policy: PolicyRecord) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
    doc.line(MARGIN, PAGE_H - 36, PAGE_W - MARGIN, PAGE_H - 36);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text(`Policy #${policy.policyNumber} · Named insured: ${policy.insured.name} · Agent code ${policy.agentCode}`, MARGIN, PAGE_H - 24);
    doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 24, { align: 'right' });
  }
}

function newPage(ctx: Ctx) {
  ctx.doc.addPage();
  pageHeader(ctx);
}

function ensure(ctx: Ctx, space: number) {
  if (ctx.y + space > PAGE_H - 50) newPage(ctx);
}

function section(ctx: Ctx, title: string) {
  ensure(ctx, 40);
  const { doc } = ctx;
  ctx.y += 8;
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(title.toUpperCase(), MARGIN, ctx.y);
  ctx.y += 4;
  doc.setDrawColor(...NAVY); doc.setLineWidth(1.4);
  doc.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
  ctx.y += 12;
}

/** Label/value rows in two columns of text. */
function rows(ctx: Ctx, entries: [string, string][]) {
  const { doc } = ctx;
  const labelW = 170;
  for (const [label, value] of entries) {
    const lines = doc.splitTextToSize(value || '—', CONTENT_W - labelW - 12) as string[];
    const height = Math.max(1, lines.length) * 11 + 6;
    ensure(ctx, height);
    doc.setFillColor(243, 247, 250);
    doc.rect(MARGIN, ctx.y - 9, labelW, height, 'F');
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
    doc.rect(MARGIN, ctx.y - 9, CONTENT_W, height);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(40, 52, 60);
    doc.text(label, MARGIN + 6, ctx.y);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, MARGIN + labelW + 6, ctx.y);
    ctx.y += height;
  }
  ctx.y += 4;
}

/** Simple grid table with a header row; `widths` are fractions of the content width. */
function table(ctx: Ctx, head: string[], body: string[][], widths: number[], rightAlign: number[] = []) {
  const { doc } = ctx;
  const cols = widths.map((width) => width * CONTENT_W);
  const draw = (cells: string[], header: boolean) => {
    const wrapped = cells.map((text, index) => doc.splitTextToSize(text || '', cols[index] - 8) as string[]);
    const height = Math.max(...wrapped.map((lines) => lines.length)) * 10 + 6;
    ensure(ctx, height + (header ? 14 : 0));
    let x = MARGIN;
    if (header) { doc.setFillColor(227, 237, 244); doc.rect(MARGIN, ctx.y - 9, CONTENT_W, height, 'F'); }
    doc.setFont('helvetica', header ? 'bold' : 'normal'); doc.setFontSize(8); doc.setTextColor(40, 52, 60);
    wrapped.forEach((lines, index) => {
      doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.rect(x, ctx.y - 9, cols[index], height);
      if (rightAlign.includes(index)) doc.text(lines, x + cols[index] - 4, ctx.y, { align: 'right' });
      else doc.text(lines, x + 4, ctx.y);
      x += cols[index];
    });
    ctx.y += height;
  };
  draw(head, true);
  for (const row of body) draw(row, false);
  ctx.y += 6;
}

function paragraph(ctx: Ctx, text: string, size = 8.5) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...GREY);
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
  ensure(ctx, lines.length * (size + 3));
  doc.text(lines, MARGIN, ctx.y);
  ctx.y += lines.length * (size + 3) + 4;
}

function drivers(policy: PolicyRecord): string[][] {
  if (policy.source.kind === 'personal') {
    return policy.source.quote.drivers.map((driver) => [[driver.firstName, driver.lastName].filter(Boolean).join(' '), driver.relationship || '—', driver.driverStatus, driver.licenseState ? `${driver.licenseState} ····${(driver.licenseNumber || '').slice(-4)}` : '—']);
  }
  return policy.source.quote.drivers.map((driver) => [[driver.firstName, driver.lastName].filter(Boolean).join(' '), 'Employee', driver.licenseType || '—', driver.licenseState ? `${driver.licenseState} ····${(driver.licenseNumber || '').slice(-4)}` : '—']);
}

/** The Declarations Page (coverage summary) sections. */
function declarations(ctx: Ctx, heading = 'Declarations Page') {
  const { policy } = ctx;
  ctx.doc.setTextColor(...NAVY); ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(16);
  ctx.doc.text(heading, MARGIN, ctx.y + 4);
  ctx.y += 16;
  paragraph(ctx, 'Your coverage has been issued as shown below. Please review this page carefully and keep it with your policy contract. It lists who and what is covered, the limits and deductibles you chose, and your premium.');
  section(ctx, 'Policy information');
  rows(ctx, [
    ['Policy number', policy.policyNumber],
    ['Product', policy.productName],
    ['Policy period', `${policy.effectiveDate} to ${policy.expirationDate} (12:01 a.m. standard time at the named insured's address)`],
    ['Policy term', `Term ${policy.termNumber} · ${policy.termMonths} months`],
    [policy.termNumber > 1 ? 'Original issue date' : 'Date issued', policy.issuedOn],
    ['State', rulesFor(policy.state).name],
    ['Agent', `${policy.agentName} · Producer code ${policy.agentCode}`],
  ]);
  section(ctx, 'Named insured');
  rows(ctx, [['Name', policy.insured.name], ['Mailing address', `${policy.insured.street}, ${policy.insured.cityStateZip}`], ['Phone', policy.insured.phone || '—'], ['Email', policy.insured.email || '—']]);
  const driverRows = drivers(policy);
  if (driverRows.length) {
    section(ctx, policy.source.kind === 'personal' ? 'Drivers and resident relatives' : 'Scheduled drivers');
    table(ctx, ['Name', 'Relationship', 'Status', 'License'], driverRows, [0.34, 0.22, 0.2, 0.24]);
  }
  section(ctx, 'Outline of coverage');
  policy.units.forEach((unit, index) => {
    ensure(ctx, 60);
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.5); ctx.doc.setTextColor(40, 52, 60);
    ctx.doc.text(`${index + 1}. ${unit.label}${unit.idNumber ? `   ${policy.product === 'boat' ? 'HIN' : 'VIN'} ${unit.idNumber}` : ''}`, MARGIN, ctx.y);
    ctx.y += 11;
    if (unit.details.length) { ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8); ctx.doc.setTextColor(...GREY); ctx.doc.text(unit.details.join(' · '), MARGIN, ctx.y); ctx.y += 12; }
    if (unit.coverages.length) table(ctx, ['Coverage', 'Limits / deductible', 'Premium'], unit.coverages.map((line) => [line.label, line.value, line.premium ? money(line.premium) : '—']), [0.46, 0.34, 0.2], [2]);
    if (unit.premium) { ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(8.5); ctx.doc.setTextColor(40, 52, 60); ctx.doc.text(`Premium for this ${policy.product === 'auto' ? 'vehicle' : 'unit'}: ${money(unit.premium)}`, PAGE_W - MARGIN, ctx.y, { align: 'right' }); ctx.y += 14; }
  });
  if (policy.policyCoverages.length) table(ctx, ['Policy-level coverage', 'Limits', 'Premium'], policy.policyCoverages.map((line) => [line.label, line.value, line.premium ? money(line.premium) : '—']), [0.46, 0.34, 0.2], [2]);
  section(ctx, 'Discounts applied');
  paragraph(ctx, policy.discounts.length ? policy.discounts.join(' · ') : 'None');
  section(ctx, 'Premium');
  rows(ctx, [['Total policy premium', money(policy.termPremium)], ['Bill plan', policy.billPlanName], ['Payment method', policy.paymentMethod], ['Installment fee', policy.feePerPayment ? `${money(policy.feePerPayment)} per installment` : 'None']]);
  const schedule = policy.installments.filter((entry) => entry.status !== 'void');
  if (schedule.length) table(ctx, ['Payment', 'Due date', 'Amount', 'Status'], schedule.map((entry) => [entry.number === 0 ? 'Down payment' : `Installment ${entry.number}`, entry.due, money(entry.amount), entry.status === 'paid' ? 'Paid' : entry.status === 'past due' ? 'Past due' : 'Scheduled']), [0.3, 0.25, 0.25, 0.2], [2]);
  if (policy.lienholders.length) {
    section(ctx, 'Lienholders / additional interests');
    table(ctx, ['Interest', 'Name and address', 'Loan number', 'Unit'], policy.lienholders.map((holder) => [holder.kind, `${holder.name}, ${holder.address}`, holder.loanNumber || '—', holder.unit]), [0.16, 0.44, 0.16, 0.24]);
  }
  section(ctx, 'Important notices');
  paragraph(ctx, `${policy.product === 'auto' ? `${rulesFor(policy.state).statuteText} ` : ''}${rulesFor(policy.state).reporting && policy.product === 'auto' ? `${rulesFor(policy.state).reporting!.text} ` : ''}Report claims 24 hours a day at ${CLAIMS_LINE} (training line). This declarations page, together with the policy contract, endorsements and application, makes up your policy. Coverage is subject to all terms and conditions of the policy.`, 8);
}

function idCardsPage(ctx: Ctx) {
  newPage(ctx);
  const { doc, policy } = ctx;
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('Insurance Identification Cards', MARGIN, ctx.y + 4);
  ctx.y += 18;
  paragraph(ctx, 'Cut along the dotted lines. Keep one card in each insured vehicle.');
  const cardW = (CONTENT_W - 16) / 2;
  const cardH = 150;
  policy.units.forEach((unit, index) => {
    const column = index % 2;
    if (column === 0) ensure(ctx, cardH + 14);
    const x = MARGIN + column * (cardW + 16);
    const top = ctx.y;
    doc.setLineDashPattern([3, 2], 0); doc.setDrawColor(...NAVY); doc.setLineWidth(1);
    doc.rect(x, top, cardW, cardH);
    doc.setLineDashPattern([], 0);
    doc.setFillColor(...NAVY); doc.rect(x, top, cardW, 16, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(rulesFor(policy.state).idCardTitle.toUpperCase(), x + 6, top + 11);
    doc.setTextColor(200, 16, 46); doc.setFontSize(6.5);
    doc.text('TRAINING SIMULATION - NOT PROOF OF INSURANCE', x + 6, top + 27);
    const line = (label: string, value: string, y: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GREY); doc.text(label, x + 6, top + y); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 52, 60); doc.text((doc.splitTextToSize(value, cardW - 84) as string[]).slice(0, 2), x + 78, top + y); };
    line('Company', 'Training Insurance Company (simulation)', 42);
    line('Policy number', policy.policyNumber, 55);
    line('Effective', `${policy.effectiveDate} to ${policy.expirationDate}`, 68);
    line('Named insured', policy.insured.name, 81);
    line('Address', `${policy.insured.street}, ${policy.insured.cityStateZip}`, 94);
    line('Vehicle', unit.label, 115);
    line('VIN', unit.idNumber || 'Not provided', 128);
    doc.setFontSize(6.5); doc.setTextColor(...NAVY);
    doc.text(`Claims 24/7: ${CLAIMS_LINE} · Agent ${policy.agentCode}`, x + 6, top + cardH - 7);
    if (column === 1 || index === policy.units.length - 1) ctx.y += cardH + 14;
  });
}

function applicationPage(ctx: Ctx, signed: string) {
  newPage(ctx);
  const { doc, policy } = ctx;
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('Application for Insurance (summary)', MARGIN, ctx.y + 4);
  ctx.y += 18;
  rows(ctx, [['Applicant', policy.insured.name], ['Date of birth', policy.insured.dob || '—'], ['Product', policy.productName], ['Requested effective date', policy.source.kind === 'personal' ? policy.source.quote.policy.effectiveDate || policy.issuedOn : policy.source.quote.effectiveDate || policy.issuedOn], ['Quote number', policy.quoteNumber], ['Bound by', `${policy.agentName} · producer code ${policy.agentCode.split(' ')[0]} · ${policy.issuedOn}`], ['Signature', signed]]);
  paragraph(ctx, 'The applicant confirmed that the information in this application is true and complete, that every household member of driving age and every vehicle regularly used has been disclosed, and that misrepresentation may void coverage.');
}

function coverLetter(ctx: Ctx) {
  const { doc, policy, copy } = ctx;
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Policy Packet', MARGIN, ctx.y + 6);
  ctx.y += 26;
  const intro = copy === 'Agent Copy'
    ? `Agency file copy for ${policy.insured.name}. Retain this copy with the signed application for your records. The insured received an identical Insured Copy with their ID cards.`
    : copy === 'Lienholder Copy'
      ? `Lienholder / additional interest copy for policy #${policy.policyNumber}. You are named on this policy as shown on the declarations page and will receive notice before any cancellation.`
      : `Dear ${policy.insured.firstName || policy.insured.name}, thank you for choosing us. Your ${policy.productName} policy is in force as of ${policy.effectiveDate}. This packet contains your declarations page and${['auto', 'motorcycle', 'motorhome', 'trailer', 'commercialAuto'].includes(policy.product) ? ' your ID cards and' : ''} a summary of your application. Your agent is ${policy.agentName}, producer code ${policy.agentCode.split(' ')[0]}.`;
  paragraph(ctx, intro, 10);
  section(ctx, 'Contents');
  const contents = ['Declarations Page'];
  if (copy !== 'Lienholder Copy' && ['auto', 'motorcycle', 'motorhome', 'trailer', 'commercialAuto'].includes(policy.product)) contents.push('Insurance Identification Cards');
  if (copy !== 'Lienholder Copy') contents.push('Application for Insurance (summary)');
  table(ctx, ['#', 'Document'], contents.map((name, index) => [String(index + 1), name]), [0.1, 0.9]);
  return contents;
}

function create(policy: PolicyRecord, title: string, copy?: PacketCopy): Ctx {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setProperties({ title: `${title} - Policy ${policy.policyNumber}`, subject: 'Training simulation - not a valid insurance document', creator: 'ForAgentsOnly training portal' });
  const ctx: Ctx = { doc, y: 0, policy, title, copy };
  pageHeader(ctx);
  return ctx;
}

function finish(ctx: Ctx): jsPDF {
  pageFooters(ctx.doc, ctx.policy);
  return ctx.doc;
}

const slug = (text: string) => text.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function declarationsPdf(policy: PolicyRecord, heading = 'Declarations Page'): jsPDF {
  const ctx = create(policy, heading);
  declarations(ctx, heading);
  return finish(ctx);
}

/** Downloads the Declarations Page as a PDF. */
export function downloadDeclarationsPdf(policy: PolicyRecord, heading = 'Declarations Page') {
  notify({ kind: 'document', title: `${heading} downloaded (PDF)`, detail: `${policy.productName} #${policy.policyNumber} · ${policy.insured.name}.`, target: { view: 'policy', policyId: policy.id } });
  declarationsPdf(policy, heading).save(`${slug(heading)}-${policy.policyNumber}-TRAINING.pdf`);
}

export function downloadPolicyPacket(policy: PolicyRecord, copy: PacketCopy) {
  notify({ kind: 'document', title: `Policy packet downloaded: ${copy}`, detail: `${policy.productName} #${policy.policyNumber} · ${policy.insured.name} (PDF).`, target: { view: 'policy', policyId: policy.id } });
  policyPacketPdf(policy, copy).save(`Policy-Packet-${slug(copy)}-${policy.policyNumber}-TRAINING.pdf`);
}

/** The policy packet: cover letter, declarations and (per copy) ID cards and application. */
export function policyPacketPdf(policy: PolicyRecord, copy: PacketCopy): jsPDF {
  const ctx = create(policy, `Policy Packet - ${copy}`, copy);
  const contents = coverLetter(ctx);
  newPage(ctx);
  declarations(ctx);
  if (contents.includes('Insurance Identification Cards')) idCardsPage(ctx);
  if (contents.includes('Application for Insurance (summary)')) applicationPage(ctx, policy.esign === 'Signed' ? `Signed ${policy.issuedOn}` : 'e-Signature pending');
  return finish(ctx);
}

/** Copies issued at bind: every policy gets an Insured and an Agent copy; a Lienholder copy when one is listed. */
export function packetCopies(policy: PolicyRecord): PacketCopy[] {
  return policy.lienholders.length ? ['Insured Copy', 'Agent Copy', 'Lienholder Copy'] : ['Insured Copy', 'Agent Copy'];
}
