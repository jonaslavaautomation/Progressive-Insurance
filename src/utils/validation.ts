// Step-level validation for the carrier's required fields. Each error is keyed by the
// field id it belongs to so the UI can highlight the control and focus it from the summary.
import type { Driver, QuoteData } from '@/types/quote';
import { CUSTOM_EQUIPMENT_MAX } from '@/data/options';
import { moneyToNumber } from '@/utils/masks';
import { ageOn, daysBetween, parseDate, ratingDate, today } from '@/utils/dates';
import { activeProducts, driverName, hasAuto, isRated, ratedDrivers, vehicleLabel } from '@/utils/ratingEngine';
import type { FieldDef, OtherProductKey } from '@/products/types';
import { PRODUCT_CONFIGS } from '@/products/configs';
import { fieldContext, isProductRated } from '@/products/engine';
import { DEFAULT_STATE, rulesFor } from '@/data/states';

export type FieldErrors = Record<string, string>;

export const MAX_EFFECTIVE_DAYS_OUT = 60;
export const INCIDENT_LOOKBACK_YEARS = 5;

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE = /^[2-9]\d{2}-\d{3}-\d{4}$/;
const ZIP = /^\d{5}$/;
/** State whose ZIP rules apply to the validation in progress (the quote or policy state). */
let activeState: string = DEFAULT_STATE;
export function setValidationState(state: string | undefined) { activeState = state || DEFAULT_STATE; }
const zipMessage = (label: string) => { const rules = rulesFor(activeState); return `${label} must be in ${rules.name} (${rules.zipHint}).`; };
export const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

function required(errors: FieldErrors, id: string, value: string | undefined, message: string) {
  if (!value || !value.trim()) errors[id] = message;
}

function dateOfBirth(errors: FieldErrors, id: string, value: string, who: string, minAge: number, tooYoung: string) {
  if (!value) { errors[id] = `${who}Date of Birth is required.`; return; }
  const age = ageOn(value);
  if (age === null) errors[id] = `${who}Date of Birth must be a valid date in MM/DD/YYYY format.`;
  else if (age < minAge) errors[id] = `${who}${tooYoung}`;
  else if (age > 110) errors[id] = `${who}Date of Birth year looks incorrect. Please verify.`;
}

/** Months the driver has held a license, derived from DOB and age first licensed. */
export function monthsLicensed(driver: Driver, effectiveDate: string): number | null {
  const age = ageOn(driver.dob, ratingDate(effectiveDate));
  const first = Number(driver.ageFirstLicensed);
  if (age === null || !driver.ageFirstLicensed || Number.isNaN(first)) return null;
  return Math.max(0, (age - first) * 12);
}

export function isLicensed(driver: Driver): boolean {
  return driver.licenseType !== 'Not Licensed';
}

function validateNamedInsured(quote: QuoteData, errors: FieldErrors) {
  const { insured } = quote;
  required(errors, 'insured.firstName', insured.firstName, 'First Name is required.');
  required(errors, 'insured.lastName', insured.lastName, 'Last Name is required.');
  if (insured.middleInitial && !/^[A-Za-z]$/.test(insured.middleInitial)) errors['insured.middleInitial'] = 'Middle Initial must be a single letter.';
  dateOfBirth(errors, 'insured.dob', insured.dob, '', 18, 'The principal named insured must be at least 18 years old.');
  required(errors, 'insured.gender', insured.gender, 'Gender is required.');
  if (insured.email && !EMAIL.test(insured.email)) errors['insured.email'] = 'Customer Email is not a valid email address.';
  insured.phones.forEach((phone, index) => {
    const id = `insured.phones.${index}`;
    if (!phone.number) { if (index === 0) errors[id] = 'A Cell or Home phone number is required.'; }
    else if (!PHONE.test(phone.number)) errors[id] = `Phone number ${index + 1} must be a valid 10-digit number (XXX-XXX-XXXX).`;
  });
  if (!insured.phones.some((phone) => phone.number && phone.type !== 'Work') && !errors['insured.phones.0']) errors['insured.phones.0'] = 'At least one Cell or Home phone number is required.';
  const { address } = insured;
  required(errors, 'address.line1', address.line1, 'Mailing Address Line 1 is required.');
  required(errors, 'address.city', address.city, 'City is required.');
  required(errors, 'address.state', address.state, 'State is required.');
  if (!address.zip) errors['address.zip'] = 'ZIP Code is required.';
  else if (!ZIP.test(address.zip)) errors['address.zip'] = 'ZIP Code must be 5 digits.';
  required(errors, 'insured.movedRecently', insured.movedRecently, 'Answer whether the insured moved in the last 2 months.');
  if (!insured.disclosureAcknowledged) errors['insured.disclosureAcknowledged'] = 'Confirm the consumer disclosure was read or provided.';
  else if (insured.disclosureAcknowledged === 'No') errors['insured.disclosureAcknowledged'] = 'The disclosure must be read or provided to the consumer before quoting.';
}

function validateProducts(quote: QuoteData, errors: FieldErrors) {
  const { policy } = quote;
  const effective = parseDate(policy.effectiveDate);
  if (!policy.effectiveDate) errors['policy.effectiveDate'] = 'Policy Effective Date is required.';
  else if (!effective) errors['policy.effectiveDate'] = 'Policy Effective Date must be a valid date in MM/DD/YYYY format.';
  else if (daysBetween(today(), effective) < 0) errors['policy.effectiveDate'] = 'Policy Effective Date cannot be in the past.';
  else if (daysBetween(today(), effective) > MAX_EFFECTIVE_DAYS_OUT) errors['policy.effectiveDate'] = `Policy Effective Date cannot be more than ${MAX_EFFECTIVE_DAYS_OUT} days in the future.`;
  otherProducts(quote).forEach((key) => validateUnits(quote, key, errors));
  if (!hasAuto(quote)) return;
  required(errors, 'policy.namedOperator', policy.namedOperator, 'Answer the Named Operator Policy question.');
  if (policy.namedOperator === 'Yes') errors['policy.namedOperator'] = 'Named Operator (non-owner) policies are not available in this simulation. Select "No".';

  quote.vehicles.forEach((vehicle, index) => {
    const who = `${vehicleLabel(vehicle, index)}: `;
    const id = (field: string) => `vehicle.${vehicle.id}.${field}`;
    required(errors, id('vehicleType'), vehicle.vehicleType, `${who}Vehicle Type is required.`);
    if (vehicle.vin && !VIN.test(vehicle.vin)) errors[id('vin')] = `${who}VIN must be 17 characters (no I, O or Q).`;
    required(errors, id('year'), vehicle.year, `${who}Year is required.`);
    required(errors, id('make'), vehicle.make, `${who}Make is required.`);
    required(errors, id('model'), vehicle.model, `${who}Model is required.`);
    required(errors, id('bodyStyle'), vehicle.bodyStyle, `${who}Body Style is required.`);
    if (!vehicle.garagingZip) errors[id('garagingZip')] = `${who}Garaging Zip Code is required.`;
    else if (!ZIP.test(vehicle.garagingZip)) errors[id('garagingZip')] = `${who}Garaging Zip Code must be 5 digits.`;
    else if (!rulesFor(activeState).zip.test(vehicle.garagingZip)) errors[id('garagingZip')] = `${who}${zipMessage('Garaging Zip Code')}`;
    required(errors, id('ownershipLength'), vehicle.ownershipLength, `${who}How long the customer has had this vehicle is required.`);
    required(errors, id('primaryUse'), vehicle.primaryUse, `${who}Primary Vehicle Use is required.`);
    required(errors, id('rideshare'), vehicle.rideshare, `${who}Rideshare/TNC use is required.`);
    required(errors, id('delivery'), vehicle.delivery, `${who}Delivery use is required.`);
    if (vehicle.delivery === 'Yes') errors[id('delivery')] = `${who}Vehicles used for delivery must be quoted as Commercial Auto.`;
    required(errors, id('marketValue'), vehicle.marketValue, `${who}Market Value is required.`);
    required(errors, id('originalCostNew'), vehicle.originalCostNew, `${who}Original Cost New is required.`);
    required(errors, id('annualMiles'), vehicle.annualMiles, `${who}Annual Miles is required.`);
  });
}

/** Auto, Motorcycle and Motor Home need licensed, rated operators. */
export function needsLicensedDrivers(quote: QuoteData): boolean {
  return activeProducts(quote).some((key) => key === 'auto' || PRODUCT_CONFIGS[key].motorized);
}

function validateHousehold(quote: QuoteData, errors: FieldErrors) {
  const on = ratingDate(quote.policy.effectiveDate);
  const licensing = needsLicensedDrivers(quote);
  quote.drivers.forEach((driver, index) => {
    const who = `${driverName(driver)}: `;
    const id = (field: string) => `driver.${driver.id}.${field}`;
    const rated = driver.driverStatus === 'Rated';
    required(errors, id('firstName'), driver.firstName, `${who}First Name is required.`);
    required(errors, id('lastName'), driver.lastName, `${who}Last Name is required.`);
    required(errors, id('maritalStatus'), driver.maritalStatus, `${who}Marital Status is required.`);
    required(errors, id('relationship'), driver.relationship, `${who}Relationship is required.`);
    dateOfBirth(errors, id('dob'), driver.dob, who, rated ? 15 : 0, 'Rated drivers must be at least 15 years old.');
    required(errors, id('gender'), driver.gender, `${who}Gender is required.`);
    if (!licensing) return;
    required(errors, id('education'), driver.education, `${who}Highest Level of Education is required.`);
    required(errors, id('employment'), driver.employment, `${who}Employment is required.`);
    required(errors, id('occupation'), driver.occupation, `${who}Occupation is required.`);
    required(errors, id('driverStatus'), driver.driverStatus, `${who}Auto Driver Status is required.`);
    required(errors, id('licenseType'), driver.licenseType, `${who}Driver License Type is required.`);
    if (rated && driver.licenseType === 'Not Licensed') errors[id('licenseType')] = `${who}Unlicensed household members must be Excluded, not Rated.`;
    if (isLicensed(driver)) {
      required(errors, id('licenseStatus'), driver.licenseStatus, `${who}Driver License Status is required.`);
      if (rated && driver.licenseStatus && driver.licenseStatus !== 'Valid') errors[id('licenseStatus')] = `${who}Rated drivers must have a Valid license. Exclude this driver or verify the status.`;
      required(errors, id('licenseState'), driver.licenseState, `${who}License State is required.`);
      const age = ageOn(driver.dob, on);
      const first = Number(driver.ageFirstLicensed);
      if (!driver.ageFirstLicensed) errors[id('ageFirstLicensed')] = `${who}Age First Licensed is required.`;
      else if (first < 14 || (age !== null && first > age)) errors[id('ageFirstLicensed')] = `${who}Age First Licensed must be between 14 and the driver's current age.`;
      const months = monthsLicensed(driver, quote.policy.effectiveDate);
      if (months !== null && months < 36) required(errors, id('previousLicenseState'), driver.previousLicenseState, `${who}Previous License State is required for drivers licensed less than 36 months.`);
      required(errors, id('internationalYears'), driver.internationalYears, `${who}International Years Licensed is required.`);
    }
    if (index > 0) required(errors, id('operatorType'), driver.operatorType, `${who}Principal/Occasional Operator is required.`);
    if (rated && hasAuto(quote) && quote.vehicles.length > 1) required(errors, id('primaryVehicleId'), driver.primaryVehicleId, `${who}Primary Vehicle Driven is required.`);

    driver.incidents.forEach((incident, n) => {
      const incidentId = `incident.${incident.id}`;
      if (!incident.code) { errors[`${incidentId}.code`] = `${who}Select an Incident Code for incident #${n + 1} or remove it.`; return; }
      const date = parseDate(incident.date);
      if (!incident.date) errors[`${incidentId}.date`] = `${who}Incident Date #${n + 1} is required.`;
      else if (!date) errors[`${incidentId}.date`] = `${who}Incident Date #${n + 1} must be a valid date in MM/DD/YYYY format.`;
      else if (daysBetween(today(), date) > 0) errors[`${incidentId}.date`] = `${who}Incident Date #${n + 1} cannot be in the future.`;
      else if (daysBetween(date, today()) > INCIDENT_LOOKBACK_YEARS * 365.25) errors[`${incidentId}.date`] = `${who}Only incidents from the last ${INCIDENT_LOOKBACK_YEARS} years are rated. Remove incident #${n + 1}.`;
    });
  });

  const spouses = quote.drivers.filter((driver) => driver.relationship === 'Spouse');
  const insured = quote.drivers[0];
  if (spouses.length > 1) errors[`driver.${spouses[1].id}.relationship`] = 'Only one household member can be listed as Spouse.';
  if (spouses.length && insured && insured.maritalStatus && insured.maritalStatus !== 'Married') errors[`driver.${insured.id}.maritalStatus`] = `${driverName(insured)}: must be Married when a Spouse is listed in the household.`;
  spouses.forEach((spouse) => {
    if (spouse.maritalStatus && spouse.maritalStatus !== 'Married') errors[`driver.${spouse.id}.maritalStatus`] = `${driverName(spouse)}: a Spouse must have a Marital Status of Married.`;
  });
}

function validateAdditional(quote: QuoteData, errors: FieldErrors) {
  const { additional, insured } = quote;
  otherProducts(quote).forEach((key) => validateQuestions(quote, key, errors));
  if (!hasAuto(quote) && otherProducts(quote).every((key) => key === 'renters')) return;
  if (!hasAuto(quote)) {
    required(errors, 'additional.paperless', additional.paperless, 'Answer the Paperless question.');
    if (additional.paperless === 'Yes' && !insured.email) errors['additional.paperless'] = 'Paperless requires a Customer Email. Add one on the Named Insured page.';
    required(errors, 'additional.primaryResidence', additional.primaryResidence, 'Primary Residence is required.');
    if (!additional.crossSell.length && !additional.noAdditionalRisks) errors['additional.crossSell'] = 'Choose any additional products the Insured or Spouse has, or select "No additional risks apply".';
    return;
  }
  required(errors, 'additional.continuousInsurance', additional.continuousInsurance, 'Answer whether the Insured/Spouse had vehicle liability insurance for the past 6 months.');
  required(errors, 'additional.allDriversListed', additional.allDriversListed, 'Answer whether all required drivers are listed.');
  if (additional.allDriversListed === 'No') errors['additional.allDriversListed'] = 'All drivers required to be listed must be added in Household Members before continuing.';
  required(errors, 'additional.priorCancellation', additional.priorCancellation, 'Answer whether an auto policy was canceled in the past 5 years.');
  required(errors, 'additional.jointOwnership', additional.jointOwnership, 'Answer the vehicle ownership question.');
  if (additional.jointOwnership === 'Yes') errors['additional.jointOwnership'] = 'Vehicles owned by a corporation/partnership or by people outside the household are not eligible. Refer to Commercial Lines.';
  required(errors, 'additional.paperless', additional.paperless, 'Answer the Paperless question.');
  if (additional.paperless === 'Yes' && !insured.email) errors['additional.paperless'] = 'Paperless requires a Customer Email. Add one on the Named Insured page.';
  required(errors, 'additional.primaryResidence', additional.primaryResidence, 'Primary Residence is required.');
  if (!additional.crossSell.length && !additional.noAdditionalRisks) errors['additional.crossSell'] = 'Choose any additional products the Insured or Spouse has, or select "No additional risks apply".';
}

/** First number of a limit such as "100/300/100" (per-person bodily injury, in thousands). */
function perPerson(limit: string): number {
  return Number(limit.split('/')[0]) || 0;
}

function validateCoverages(quote: QuoteData, errors: FieldErrors) {
  otherProducts(quote).forEach((key) => validateProductCoverages(quote, key, errors));
  const productsUnrated = otherProducts(quote).filter((key) => !isProductRated(key, quote));
  if (!hasAuto(quote)) {
    if (productsUnrated.length && !Object.keys(errors).length) errors.rate = 'Click RECALCULATE to rate the quote before continuing to PORTFOLIO.';
    return;
  }
  const { coverages } = quote;
  required(errors, 'coverages.bodilyInjuryPd', coverages.bodilyInjuryPd, 'Bodily Injury & Property Damage is required.');
  required(errors, 'coverages.medicalPayments', coverages.medicalPayments, 'Medical Payment is required.');
  required(errors, 'coverages.snapshot', coverages.snapshot, 'Snapshot Enrollment is required.');
  required(errors, 'coverages.uninsuredMotorist', coverages.uninsuredMotorist, 'Uninsured/Underinsured Motorist Bodily Injury is required.');
  const rules = rulesFor(quote.policy.quoteState);
  if (coverages.bodilyInjuryPd && !rules.liability.includes(coverages.bodilyInjuryPd)) errors['coverages.bodilyInjuryPd'] = `Select a liability limit available in ${rules.name} (minimum: ${rules.minimumText})`;
  if (coverages.medicalPayments && !rules.medPay.includes(coverages.medicalPayments)) errors['coverages.medicalPayments'] = rules.name === 'New Hampshire' ? 'New Hampshire policies must include at least $1,000 Medical Payments.' : `Medical Payments is not offered in ${rules.name}.`;
  if (coverages.uninsuredMotorist && !rules.um.choices.includes(coverages.uninsuredMotorist)) errors['coverages.uninsuredMotorist'] = `Select an Uninsured Motorist option available in ${rules.name}. ${rules.um.text}`;
  else if (rules.um.rule === 'matchLiability' && perPerson(coverages.uninsuredMotorist) !== perPerson(coverages.bodilyInjuryPd)) errors['coverages.uninsuredMotorist'] = 'New Hampshire requires UM/UIM limits equal to the Bodily Injury limits.';
  else if (perPerson(coverages.uninsuredMotorist) > Math.max(perPerson(coverages.bodilyInjuryPd), 0) && coverages.uninsuredMotorist !== 'Rejected') errors['coverages.uninsuredMotorist'] = `UM/UIM Bodily Injury limits cannot be higher than the Bodily Injury limits in ${rules.name}.`;
  if (rules.pip) {
    required(errors, 'coverages.pip', coverages.pip, 'Personal Injury Protection is required.');
    if (coverages.pip && !rules.pip.choices.includes(coverages.pip)) errors['coverages.pip'] = rules.pip.text;
  }
  const rejected = [coverages.pip === 'Rejected' ? 'PIP' : '', coverages.uninsuredMotorist === 'Rejected' ? 'UM/UIM' : ''].filter(Boolean);
  if (rejected.length && !coverages.rejectionSigned) errors['coverages.rejectionSigned'] = `${rules.name} requires the customer's signed rejection form for ${rejected.join(' and ')}. Confirm the form is signed, or select a limit.`;
  if (rules.umpd) required(errors, 'coverages.umpd', coverages.umpd, 'Uninsured Motorist Property Damage is required.');
  quote.vehicles.forEach((vehicle, index) => {
    const who = `${vehicleLabel(vehicle, index)}: `;
    if (vehicle.collDeductible !== 'None' && vehicle.compDeductible === 'None') errors[`vehicle.${vehicle.id}.compDeductible`] = `${who}Collision coverage requires Other Than Collision (Comprehensive) coverage.`;
    if (moneyToNumber(vehicle.customEquipment) > CUSTOM_EQUIPMENT_MAX) errors[`vehicle.${vehicle.id}.customEquipment`] = `${who}Customizing Equipment Coverage cannot exceed $${CUSTOM_EQUIPMENT_MAX.toLocaleString('en-US')}.`;
  });
  if ((!isRated(quote) || productsUnrated.length) && !Object.keys(errors).length) errors.rate = 'Click RECALCULATE to rate the quote before continuing to PORTFOLIO.';
  required(errors, 'pos.billPlan', quote.pointOfSale.billPlan, 'Select a Bill Plan.');
}

function validatePointOfSale(quote: QuoteData, errors: FieldErrors) {
  otherProducts(quote).forEach((key) => {
    const config = PRODUCT_CONFIGS[key];
    const field = config.unitFields.find((entry) => entry.key === config.idField);
    if (!field) return;
    quote.productQuotes[key]?.units.forEach((unit, index) => {
      const who = `${config.unitLabel} ${index + 1} (${config.describe(unit)}): `;
      const value = unit.values[field.key] ?? '';
      const fieldId = `unit.${key}.${unit.id}.${field.key}`;
      if (!value) errors[fieldId] = `${who}${field.label.replace(/[:*]/g, '')} is required at Point of Sale.`;
      else if (field.type === 'vin' && !VIN.test(value)) errors[fieldId] = `${who}VIN must be 17 characters (no I, O or Q).`;
      else if (field.type === 'hin' && !HIN.test(value)) errors[fieldId] = `${who}Hull ID must be 12 letters and numbers.`;
    });
  });
  if (hasAuto(quote)) quote.vehicles.forEach((vehicle, index) => {
    const who = `${vehicleLabel(vehicle, index)}: `;
    const id = (field: string) => `vehicle.${vehicle.id}.${field}`;
    if (!vehicle.vin) errors[id('vin')] = `${who}VIN is required at Point of Sale.`;
    else if (!VIN.test(vehicle.vin)) errors[id('vin')] = `${who}VIN must be 17 characters (no I, O or Q).`;
    if (vehicle.garagingSameAsMailing === 'No') {
      required(errors, id('garagingStreet'), vehicle.garagingStreet, `${who}Garaging Street Address is required.`);
      required(errors, id('garagingCity'), vehicle.garagingCity, `${who}Garaging City is required.`);
    }
  });
  if (needsLicensedDrivers(quote)) ratedDrivers(quote.drivers).filter(isLicensed).forEach((driver) => {
    required(errors, `driver.${driver.id}.licenseNumber`, driver.licenseNumber, `${driverName(driver)}: Driver License Number is required at Point of Sale.`);
  });
  const { reports } = quote;
  if (reports.clueStatus === 'ordering' || reports.mvrStatus === 'ordering') errors.pos = 'Point of Sale reports are still processing. Wait for the results.';
  else if (!reports.priorSource) errors.pos = 'Click ORDER POINT OF SALE to order reports before continuing to FINAL SALE.';
}

function validateFinalSale(quote: QuoteData, errors: FieldErrors) {
  const pos = quote.pointOfSale;
  required(errors, 'pos.paymentMethod', pos.paymentMethod, 'Down Payment Method is required.');
  if (!pos.paymentAuthorized) errors['pos.paymentAuthorized'] = 'Confirm the customer authorized the payment.';
  else if (pos.paymentAuthorized === 'No') errors['pos.paymentAuthorized'] = 'The customer must authorize the payment before the policy can be bound.';
  required(errors, 'pos.documentDelivery', pos.documentDelivery, 'Document Delivery is required.');
  if (pos.documentDelivery === 'Email (e-Sign)' && !quote.insured.email) errors['pos.documentDelivery'] = 'Email delivery requires a Customer Email on the Named Insured page.';
  if (!pos.reviewedCoverages) errors['pos.reviewedCoverages'] = 'Confirm you reviewed coverages and deductibles with the customer.';
  if (!pos.confirmedHousehold) errors['pos.confirmedHousehold'] = 'Confirm all household members and drivers are listed.';
  if (!pos.agreedToTerms) errors['pos.agreedToTerms'] = 'Confirm the customer agreed to the binding terms.';
}

// ------------------------------------------------------------------ non-Auto products

function otherProducts(quote: QuoteData): OtherProductKey[] {
  return activeProducts(quote).filter((key): key is OtherProductKey => key !== 'auto');
}

export const HIN = /^[A-Z0-9]{12}$/;

export function checkField(errors: FieldErrors, fieldId: string, field: FieldDef, value: string, who: string, visible: boolean) {
  if (!visible || field.type === 'display') return;
  const name = field.label.replace(/[:*?]/g, '').trim();
  if (field.required && !value) { errors[fieldId] = `${who}${name} is required.`; return; }
  if (!value) return;
  if (field.type === 'zip') {
    if (!ZIP.test(value)) errors[fieldId] = `${who}${name} must be 5 digits.`;
    else if (!rulesFor(activeState).zip.test(value)) errors[fieldId] = `${who}${zipMessage(name)}`;
  }
  if (field.type === 'vin' && !VIN.test(value)) errors[fieldId] = `${who}VIN must be 17 characters (no I, O or Q).`;
  if (field.type === 'hin' && !HIN.test(value)) errors[fieldId] = `${who}Hull ID must be 12 letters and numbers.`;
  if (field.type === 'money' && Number(value.replace(/\D/g, '')) <= 0) errors[fieldId] = `${who}${name} must be greater than $0.`;
}

function validateUnits(quote: QuoteData, key: OtherProductKey, errors: FieldErrors) {
  const config = PRODUCT_CONFIGS[key];
  quote.productQuotes[key]?.units.forEach((unit, index) => {
    const who = config.multiUnit ? `${config.unitLabel} ${index + 1} (${config.describe(unit)}): ` : `${config.name}: `;
    const ctx = fieldContext(quote, unit.values);
    for (const field of config.unitFields) checkField(errors, `unit.${key}.${unit.id}.${field.key}`, field, unit.values[field.key] ?? '', who, !field.showIf || field.showIf(ctx));
    for (const [field, message] of Object.entries(config.unitRules?.(unit.values) ?? {})) errors[`unit.${key}.${unit.id}.${field}`] = `${who}${message}`;
  });
}

function validateQuestions(quote: QuoteData, key: OtherProductKey, errors: FieldErrors) {
  const config = PRODUCT_CONFIGS[key];
  const answers = quote.productQuotes[key]?.answers ?? {};
  const ctx = fieldContext(quote, answers);
  for (const question of config.questions) {
    const fieldId = `answer.${key}.${question.key}`;
    // Optional questions (no asterisk) and questions hidden by an earlier answer are skipped.
    if (question.required === false || (question.required === undefined && !question.label.includes('*')) || (question.showIf && !question.showIf(ctx))) continue;
    if (!answers[question.key]) errors[fieldId] = `${config.name}: answer "${question.label.replace(/[:*]+$/, '').replace(/[:*]+$/, '')}"`;
    else if (question.ineligibleIf && answers[question.key] === question.ineligibleIf) errors[fieldId] = `${config.name}: ${question.ineligibleMessage}`;
  }
}

function validateProductCoverages(quote: QuoteData, key: OtherProductKey, errors: FieldErrors) {
  const config = PRODUCT_CONFIGS[key];
  const product = quote.productQuotes[key];
  if (!product) return;
  for (const coverage of config.coverages) {
    if (coverage.scope === 'policy') checkField(errors, `coverage.${key}.policy.${coverage.key}`, coverage, product.coverages[coverage.key] ?? '', `${config.name}: `, true);
    else product.units.forEach((unit, index) => checkField(errors, `coverage.${key}.${unit.id}.${coverage.key}`, coverage, unit.coverages[coverage.key] ?? '', `${config.unitLabel} ${index + 1}: `, true));
  }
  product.units.forEach((unit, index) => {
    // Collision requires Comprehensive, as on Auto.
    if (unit.coverages.coll && unit.coverages.coll !== 'None' && unit.coverages.comp === 'None') errors[`coverage.${key}.${unit.id}.comp`] = `${config.unitLabel} ${index + 1}: Collision requires Comprehensive coverage.`;
  });
}

const validators = [validateNamedInsured, validateProducts, validateHousehold, validateAdditional, validateCoverages, () => undefined, validatePointOfSale, validateFinalSale];

export function validateStep(step: number, quote: QuoteData): FieldErrors {
  const errors: FieldErrors = {};
  setValidationState(quote.policy.quoteState);
  validators[step]?.(quote, errors);
  return errors;
}

/** Indexes of steps that still have errors. */
export function incompleteSteps(quote: QuoteData): number[] {
  return validators.map((_, step) => step).filter((step) => Object.keys(validateStep(step, quote)).length > 0);
}
