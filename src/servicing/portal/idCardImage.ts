// Draws the auto ID cards (one per vehicle) onto a canvas and downloads them as a PNG.
// Every card carries the training-simulation banner so it can never pass as real proof of insurance.
import type { PolicyRecord } from '@/types/policy';
import { CLAIMS_LINE } from '@/servicing/portal/portalUtils';
import { rulesFor } from '@/data/states';
import { notify } from '@/services/activity';

const W = 1050;
const H = 640;
const GAP = 40;

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number): number {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) { ctx.fillText(line, x, y); y += lineHeight; line = word; } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function drawCard(ctx: CanvasRenderingContext2D, policy: PolicyRecord, unit: PolicyRecord['units'][number], top: number, agency: string) {
  const navy = '#003865';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, top, W, H);
  ctx.strokeStyle = navy; ctx.lineWidth = 6; ctx.strokeRect(3, top + 3, W - 6, H - 6);
  ctx.fillStyle = navy; ctx.fillRect(3, top + 3, W - 6, 64);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Roboto, Arial, sans-serif';
  ctx.fillText(rulesFor(policy.state).idCardTitle.toUpperCase(), 28, top + 45);
  ctx.fillStyle = '#fde8ea'; ctx.fillRect(3, top + 67, W - 6, 36);
  ctx.fillStyle = '#c8102e'; ctx.font = 'bold 19px Roboto, Arial, sans-serif';
  ctx.fillText('TRAINING SIMULATION ONLY. NOT A VALID INSURANCE CARD OR PROOF OF COVERAGE.', 28, top + 92);

  const label = (text: string, x: number, y: number) => { ctx.fillStyle = '#52616c'; ctx.font = 'bold 15px Roboto, Arial, sans-serif'; ctx.fillText(text.toUpperCase(), x, y); };
  const value = (text: string, x: number, y: number, size = 24) => { ctx.fillStyle = '#1b2a36'; ctx.font = `bold ${size}px Roboto, Arial, sans-serif`; ctx.fillText(text, x, y); };
  label('Company', 28, top + 140); value('Training Insurance Company (simulation)', 28, top + 170, 22);
  label('Policy number', 28, top + 215); value(policy.policyNumber, 28, top + 245);
  label('Effective date', 360, top + 215); value(policy.effectiveDate, 360, top + 245);
  label('Expiration date', 640, top + 215); value(policy.expirationDate, 640, top + 245);
  label('Named insured', 28, top + 290); value(policy.insured.name, 28, top + 320, 22);
  ctx.font = '19px Roboto, Arial, sans-serif'; ctx.fillStyle = '#1b2a36';
  ctx.fillText(policy.insured.street, 28, top + 346); ctx.fillText(policy.insured.cityStateZip, 28, top + 370);
  label('Vehicle (year, make, model)', 560, top + 290); value(unit.label, 560, top + 320, 22);
  label('VIN', 560, top + 355); value(unit.idNumber || 'Not provided', 560, top + 383, 21);
  label('Agency', 28, top + 420); value(agency, 28, top + 448, 19);
  label('Agent code', 560, top + 420); value(policy.agentCode, 560, top + 448, 19);
  ctx.fillStyle = '#e4ecf1'; ctx.fillRect(3, top + 470, W - 6, 1);
  ctx.fillStyle = '#3d4b55'; ctx.font = '16px Roboto, Arial, sans-serif';
  const next = wrap(ctx, rulesFor(policy.state).statuteText, 28, top + 500, W - 56, 21);
  ctx.font = 'bold 17px Roboto, Arial, sans-serif'; ctx.fillStyle = navy;
  ctx.fillText(`Report a claim 24/7: ${CLAIMS_LINE} (training line)`, 28, Math.min(next + 8, top + H - 22));
}

export function downloadIdCards(policy: PolicyRecord, agency: string) {
  notify({ kind: 'document', title: 'Auto ID cards generated (saved as image)', detail: `${policy.productName} #${policy.policyNumber} · ${policy.insured.name}: ${policy.units.map((unit) => unit.label).join(', ')}.`, target: { view: 'proof', policyId: policy.id } });
  const units = policy.units.length ? policy.units : [{ label: policy.productName, details: [], idNumber: '', coverages: [], premium: 0 }];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = units.length * H + (units.length - 1) * GAP;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#f1f6f9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  units.forEach((unit, index) => drawCard(ctx, policy, unit, index * (H + GAP), agency));
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ID-Cards-${policy.policyNumber}-TRAINING.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}
