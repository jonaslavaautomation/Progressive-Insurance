// Commercial Lines step validation.
import type { CommercialQuote } from '@/commercial/types';
import type { CommercialKey } from '@/products/types';
import { BUSINESS_FIELDS, COMMERCIAL_CONFIGS, INDUSTRIES, SHARED_QUESTIONS } from '@/commercial/configs';
import { commercialContext, isCommercialRated } from '@/commercial/engine';
import { EMAIL, PHONE, VIN, checkField, setValidationState, type FieldErrors } from '@/utils/validation';
import { SUPPORTED_STATES } from '@/data/states';
import { ageOn, daysBetween, parseDate, today } from '@/utils/dates';

function validateBusiness(quote: CommercialQuote, errors: FieldErrors) {
  const b = quote.business;
  const ctx = commercialContext(quote, b);
  for (const field of BUSINESS_FIELDS) checkField(errors, `business.${field.key}`, field, b[field.key] ?? '', '', !field.showIf || field.showIf(ctx));
  if (b.state && !SUPPORTED_STATES.includes(b.state as never) && !errors['business.state']) errors['business.state'] = `Commercial Lines are written in ${SUPPORTED_STATES.join(', ')}.`;
  if (b.phone && !PHONE.test(b.phone)) errors['business.phone'] = 'Business Phone must be a valid 10-digit number (XXX-XXX-XXXX).';
  if (b.email && !EMAIL.test(b.email)) errors['business.email'] = 'Business Email is not a valid email address.';
  if (b.fein && b.fein.replace(/\D/g, '').length !== 9) errors['business.fein'] = 'FEIN must be 9 digits.';
  const effective = parseDate(quote.effectiveDate);
  if (!quote.effectiveDate) errors['commercial.effectiveDate'] = 'Policy Effective Date is required.';
  else if (!effective) errors['commercial.effectiveDate'] = 'Policy Effective Date must be a valid date in MM/DD/YYYY format.';
  else if (daysBetween(today(), effective) < 0) errors['commercial.effectiveDate'] = 'Policy Effective Date cannot be in the past.';
  else if (daysBetween(today(), effective) > 60) errors['commercial.effectiveDate'] = 'Policy Effective Date cannot be more than 60 days in the future.';
}

function validateUnits(quote: CommercialQuote, key: CommercialKey, errors: FieldErrors) {
  const config = COMMERCIAL_CONFIGS[key];
  quote.productQuotes[key]?.units.forEach((unit, index) => {
    const who = `${config.unitLabel} ${index + 1} (${config.describe(unit)}): `;
    const ctx = commercialContext(quote, unit.values);
    for (const field of config.unitFields) checkField(errors, `cunit.${key}.${unit.id}.${field.key}`, field, unit.values[field.key] ?? '', who, !field.showIf || field.showIf(ctx));
    for (const [field, message] of Object.entries(config.unitRules?.(unit.values) ?? {})) errors[`cunit.${key}.${unit.id}.${field}`] = `${who}${message}`;
  });
}

function validateDrivers(quote: CommercialQuote, errors: FieldErrors) {
  if (!quote.products.includes('commercialAuto')) return;
  if (!quote.drivers.length) { errors['cdriver.none'] = 'Add every employee who drives a business vehicle.'; return; }
  quote.drivers.forEach((driver, index) => {
    const who = `${[driver.firstName, driver.lastName].filter(Boolean).join(' ') || `Driver ${index + 1}`}: `;
    const id = (field: string) => `cdriver.${driver.id}.${field}`;
    const need = (field: keyof typeof driver, label: string) => { if (!driver[field]) errors[id(field)] = `${who}${label} is required.`; };
    need('firstName', 'First Name'); need('lastName', 'Last Name');
    const age = ageOn(driver.dob);
    if (!driver.dob) errors[id('dob')] = `${who}Date of Birth is required.`;
    else if (age === null) errors[id('dob')] = `${who}Date of Birth must be a valid date in MM/DD/YYYY format.`;
    else if (age < 18) errors[id('dob')] = `${who}Commercial drivers must be at least 18 years old.`;
    need('licenseState', 'License State'); need('licenseNumber', 'License Number'); need('licenseType', 'License Type'); need('experience', 'Commercial Driving Experience'); need('violations', 'Violations'); need('accidents', 'Accidents');
    if (driver.violations === '3 or more') errors[id('violations')] = `${who}Drivers with 3 or more violations in 3 years are not acceptable. Remove this driver from the schedule.`;
  });
  const heavy = quote.productQuotes.commercialAuto?.units.some((unit) => unit.values.gvw === 'Over 26,000 lbs');
  if (heavy && !quote.drivers.some((driver) => driver.licenseType.startsWith('CDL'))) errors['cdriver.cdl'] = 'Vehicles over 26,000 lbs GVW require at least one driver with a CDL.';
}

function validateUnderwriting(quote: CommercialQuote, errors: FieldErrors) {
  const check = (prefix: string, questions: typeof SHARED_QUESTIONS, answers: Record<string, string>, who: string) => {
    const ctx = commercialContext(quote, answers);
    for (const question of questions) {
      if (question.showIf && !question.showIf(ctx)) continue;
      const fieldId = `${prefix}.${question.key}`;
      if (!answers[question.key]) errors[fieldId] = `${who}answer "${question.label.replace(/\*$/, '')}"`;
      else if (question.ineligibleIf && answers[question.key] === question.ineligibleIf) errors[fieldId] = `${who}${question.ineligibleMessage}`;
    }
  };
  check('cq.shared', SHARED_QUESTIONS, quote.answers, 'Business: ');
  for (const key of quote.products) check(`cq.${key}`, COMMERCIAL_CONFIGS[key].questions, quote.productQuotes[key]?.answers ?? {}, `${COMMERCIAL_CONFIGS[key].name}: `);
  const industry = INDUSTRIES[quote.business.industry];
  const bop = quote.productQuotes.bop;
  if (bop && industry && bop.answers.form === 'Businessowners Policy (BOP)' && !industry.bop) errors['cq.bop.form'] = `Businessowners / Contractor GL: ${quote.business.industry} is not eligible for a BOP. Select Contractor General Liability (GL only).`;
}

function validateCoverages(quote: CommercialQuote, errors: FieldErrors) {
  for (const key of quote.products) {
    const config = COMMERCIAL_CONFIGS[key];
    const product = quote.productQuotes[key];
    if (!product) continue;
    for (const coverage of config.coverages) {
      if (coverage.scope === 'policy') checkField(errors, `ccov.${key}.policy.${coverage.key}`, coverage, product.coverages[coverage.key] ?? '', `${config.name}: `, true);
      else product.units.forEach((unit, index) => checkField(errors, `ccov.${key}.${unit.id}.${coverage.key}`, coverage, unit.coverages[coverage.key] ?? '', `${config.unitLabel} ${index + 1}: `, true));
    }
    product.units.forEach((unit, index) => { if (unit.coverages.coll && unit.coverages.coll !== 'None' && unit.coverages.comp === 'None') errors[`ccov.${key}.${unit.id}.comp`] = `${config.unitLabel} ${index + 1}: Collision requires Comprehensive coverage.`; });
  }
  const mgmt = quote.productQuotes.mgmt;
  if (mgmt) {
    const c = mgmt.coverages;
    if (c.epli === 'No' && c.npdo === 'No' && c.cyber === 'No') errors['ccov.mgmt.policy.epli'] = 'Management Liability: select at least one coverage part (EPLI, NPDO or Cyber).';
    if (c.npdo !== 'No' && quote.business.entity !== 'Nonprofit Organization') errors['ccov.mgmt.policy.npdo'] = 'Management Liability: Nonprofit D&O is available only to nonprofit organizations.';
    if (c.cyber !== 'No' && mgmt.answers.mfa !== 'Yes') errors['ccov.mgmt.policy.cyber'] = 'Management Liability: Cyber Liability requires multi-factor authentication on email and remote access.';
  }
  if (!Object.keys(errors).length && quote.products.some((key) => !isCommercialRated(key, quote))) errors.crate = 'Click RECALCULATE to rate the quote before continuing to FINAL SALE.';
}

function validateFinal(quote: CommercialQuote, errors: FieldErrors) {
  quote.productQuotes.commercialAuto?.units.forEach((unit, index) => {
    const fieldId = `cfinal.vin.${unit.id}`;
    if (!unit.values.vin) errors[fieldId] = `Vehicle ${index + 1}: VIN is required before binding.`;
    else if (!VIN.test(unit.values.vin)) errors[fieldId] = `Vehicle ${index + 1}: VIN must be 17 characters (no I, O or Q).`;
  });
  if (!quote.paymentMethod) errors['cfinal.paymentMethod'] = 'Down Payment Method is required.';
  if (quote.paymentAuthorized !== 'Yes') errors['cfinal.paymentAuthorized'] = 'The business must authorize the payment before binding.';
  if (!quote.signedApplication) errors['cfinal.signed'] = 'Confirm the commercial application was signed by an authorized officer or owner.';
  if (!quote.confirmedAccuracy) errors['cfinal.accuracy'] = 'Confirm the business information and schedules were reviewed with the customer.';
}

const validators = [validateBusiness, (quote: CommercialQuote, errors: FieldErrors) => quote.products.forEach((key) => validateUnits(quote, key, errors)), validateDrivers, validateUnderwriting, validateCoverages, validateFinal];

export function validateCommercialStep(step: number, quote: CommercialQuote): FieldErrors {
  const errors: FieldErrors = {};
  setValidationState(quote.business.state);
  validators[step]?.(quote, errors);
  return errors;
}

export function incompleteCommercialSteps(quote: CommercialQuote): number[] {
  return validators.map((_, step) => step).filter((step) => Object.keys(validateCommercialStep(step, quote)).length > 0);
}
