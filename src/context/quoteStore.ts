// Quote state, factories and reducer. Kept framework-free so it can be unit tested.
import type { AdditionalDetails, AgentProfile, Coverages, Driver, Incident, MailingAddress, NamedInsured, PointOfSale, PolicyInfo, QuoteData, SimulatedReports, Vehicle } from '@/types/quote';
import { COVERAGE_DEFAULTS, VEHICLE_COVERAGE_DEFAULTS, VEHICLE_TYPES } from '@/data/options';
import { lookupVehicleDetails } from '@/data/vehicleCatalog';
import { emptyReports, type PosOrderResult } from '@/utils/reportSimulator';
import { rateQuote, ratedDrivers, ratingSignature, selectedPlan } from '@/utils/ratingEngine';
import { addDays, formatDate, today } from '@/utils/dates';

export const STEPS = ['NAMED INSURED', 'PRODUCTS', 'HOUSEHOLD MEMBERS', 'ADDITIONAL DETAILS', 'COVERAGES/BILL PLANS', 'PORTFOLIO', 'POINT OF SALE', 'FINAL SALE'] as const;
export const LAST_STEP = STEPS.length - 1;
export const QUOTE_STATE = 'North Carolina';
/** Default logged-in agent until the user sets their own name (Dashboard header). */
export const DEFAULT_AGENT: AgentProfile = { name: 'Training Agent', agencyName: 'Training Agency Ins', agencyCode: 'TRN01' };

export function agentCodeFor(agent: AgentProfile): string {
  return `${agent.agencyCode} (${agent.agencyName.toUpperCase()})`;
}

export interface UiState {
  view: 'dashboard' | 'wizard' | 'documents';
  step: number;
  maxStep: number;
  hintMode: boolean;
  /** Named Insured header switch: lets Tab reach the purple help buttons. */
  keyboardHelp: boolean;
}

export interface QuoteState extends QuoteData {
  ui: UiState;
  agent: AgentProfile;
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateQuoteNumber(): string {
  return `5500${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

export function policyNumberFor(quoteNumber: string): string {
  return `9${quoteNumber.slice(-8)}`;
}

export function createVehicle(garagingZip = ''): Vehicle {
  return {
    id: newId('veh'), vehicleType: VEHICLE_TYPES[0], vin: '', year: '', make: '', model: '', bodyStyle: '', isoSymbol: '', isoSymbolOtc: '', isoSymbolCollision: '',
    garagingZip, ownershipLength: '', primaryUse: '', rideshare: '', delivery: '', marketValue: '', originalCostNew: '', passiveRestraint: '', annualMiles: '',
    ...VEHICLE_COVERAGE_DEFAULTS, garagingSameAsMailing: 'Yes', garagingStreet: '', garagingStreet2: '', garagingCity: '',
  };
}

export function createDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: newId('drv'), firstName: '', middleInitial: '', lastName: '', suffix: '', maritalStatus: '', relationship: '', dob: '', ssn: '', gender: '',
    education: '', employment: '', occupation: '', driverStatus: 'Rated', licenseType: '', licenseStatus: '', licenseState: QUOTE_STATE, licenseNumber: '',
    previousLicenseState: '', stateFiling: 'No', operatorType: '', ageFirstLicensed: '', internationalYears: '', primaryVehicleId: '', distantStudent: 'No',
    goodStudent: 'No', incidents: [],
    ...overrides,
  };
}

export function createIncident(): Incident {
  return { id: newId('inc'), code: '', date: '' };
}

function createInsured(): NamedInsured {
  return {
    firstName: '', middleInitial: '', lastName: '', suffix: '', dob: '', gender: '', email: '', phones: [{ type: 'Cell', number: '' }],
    address: { line1: '', line2: '', city: '', state: QUOTE_STATE, zip: '', poBox: false }, movedRecently: '', disclosureAcknowledged: '',
  };
}

export function createQuoteData(agent: AgentProfile = DEFAULT_AGENT): QuoteData {
  return {
    policy: { agentCode: agentCodeFor(agent), quoteState: QUOTE_STATE, quoteNumber: '', effectiveDate: '', namedOperator: 'No', policyNumber: '', boundAt: '', comment: '' },
    insured: createInsured(),
    vehicles: [createVehicle()],
    drivers: [createDriver({ relationship: 'Insured', operatorType: 'Principal' })],
    additional: { continuousInsurance: '', allDriversListed: '', priorCancellation: '', jointOwnership: '', paperless: '', primaryResidence: '', crossSell: [], noAdditionalRisks: false },
    coverages: { ...COVERAGE_DEFAULTS },
    reports: emptyReports(),
    pointOfSale: { billPlan: 'PIF', paymentMethod: '', paymentAuthorized: '', documentDelivery: '', reviewedCoverages: false, confirmedHousehold: false, agreedToTerms: false },
    ratedSignature: '',
    premiumChange: null,
  };
}

export function createInitialState(agent: AgentProfile = DEFAULT_AGENT): QuoteState {
  return { ...createQuoteData(agent), agent, ui: { view: 'dashboard', step: 0, maxStep: 0, hintMode: false, keyboardHelp: true } };
}

/** Fictitious practice customer (no real person's details) for demos and trainer walkthroughs. */
export function createSampleQuote(agent: AgentProfile = DEFAULT_AGENT): QuoteData {
  const base = createQuoteData(agent);
  const vehicle: Vehicle = {
    ...createVehicle('27604'), year: '2019', make: 'Toyota', model: 'Camry', bodyStyle: 'Sedan 4D', ...lookupVehicleDetails('2019', 'Toyota', 'Camry', 'Sedan 4D'),
    ownershipLength: 'At least 1 year but less than 3 years', primaryUse: '1A - Pleasure', rideshare: 'No', delivery: 'No', annualMiles: '10,000 - 11,999',
  };
  const insured: NamedInsured = {
    firstName: 'Alex', middleInitial: '', lastName: 'Sample', suffix: '', dob: '06/12/1984', gender: 'Not Specified', email: 'alex.sample@example.com',
    phones: [{ type: 'Cell', number: '919-555-0142' }],
    address: { line1: '100 Training Way', line2: '', city: 'Raleigh', state: QUOTE_STATE, zip: '27604', poBox: false }, movedRecently: 'No', disclosureAcknowledged: 'Yes',
  };
  return {
    ...base,
    policy: { ...base.policy, quoteNumber: generateQuoteNumber(), effectiveDate: formatDate(addDays(today(), 7)) },
    insured,
    vehicles: [vehicle],
    drivers: [createDriver({
      relationship: 'Insured', operatorType: 'Principal', firstName: insured.firstName, lastName: insured.lastName, dob: insured.dob, gender: insured.gender, maritalStatus: 'Single',
      education: "Bachelor's degree", employment: 'Business/Sales/Office', occupation: 'Accountant/Auditor', licenseType: 'Personal Auto',
      licenseStatus: 'Valid', licenseState: QUOTE_STATE, licenseNumber: '000000001', ageFirstLicensed: '16', internationalYears: 'None', primaryVehicleId: vehicle.id,
    })],
    additional: { continuousInsurance: 'No', allDriversListed: 'Yes', priorCancellation: 'No', jointOwnership: 'No', paperless: 'Yes', primaryResidence: 'Single Family Home', crossSell: [], noAdditionalRisks: true },
  };
}

export type QuoteAction =
  | { type: 'updatePolicy'; patch: Partial<PolicyInfo> }
  | { type: 'updateInsured'; patch: Partial<NamedInsured> }
  | { type: 'updateAddress'; patch: Partial<MailingAddress> }
  | { type: 'addVehicle'; vehicle: Vehicle }
  | { type: 'updateVehicle'; id: string; patch: Partial<Vehicle> }
  | { type: 'removeVehicle'; id: string }
  | { type: 'addDriver'; driver: Driver }
  | { type: 'updateDriver'; id: string; patch: Partial<Driver> }
  | { type: 'removeDriver'; id: string }
  | { type: 'addIncident'; driverId: string; incident: Incident }
  | { type: 'updateIncident'; driverId: string; incidentId: string; patch: Partial<Incident> }
  | { type: 'removeIncident'; driverId: string; incidentId: string }
  | { type: 'updateAdditional'; patch: Partial<AdditionalDetails> }
  | { type: 'updateCoverages'; patch: Partial<Coverages> }
  | { type: 'updatePointOfSale'; patch: Partial<PointOfSale> }
  | { type: 'recalculate' }
  | { type: 'updateReports'; patch: Partial<Pick<SimulatedReports, 'orderClue' | 'orderMvr'>> }
  | { type: 'posOrderStarted'; requestId: number }
  | { type: 'posOrderApplied'; result: PosOrderResult; priorSource: 'vendor' | 'insured' }
  | { type: 'posOrderCancelled' }
  | { type: 'dismissPremiumChange' }
  | { type: 'updateAgent'; agent: AgentProfile }
  | { type: 'duplicateQuote'; quoteNumber: string }
  | { type: 'showDocuments' }
  | { type: 'bindPolicy'; policyNumber: string; boundAt: string }
  | { type: 'navigate'; step: number }
  | { type: 'showDashboard' }
  | { type: 'toggleHints' }
  | { type: 'toggleKeyboardHelp' }
  | { type: 'load'; data: QuoteData; maxStep: number }
  | { type: 'reset' };

// Fields copied from the principal named insured to household member #1 until the VA edits them there.
const SYNCED_DRIVER_FIELDS = ['firstName', 'middleInitial', 'lastName', 'suffix', 'dob', 'gender'] as const;

function mapDriver(drivers: Driver[], id: string, update: (driver: Driver) => Driver): Driver[] {
  return drivers.map((driver) => (driver.id === id ? update(driver) : driver));
}

function baseReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case 'updatePolicy':
      return { ...state, policy: { ...state.policy, ...action.patch } };
    case 'updateInsured': {
      const insured = { ...state.insured, ...action.patch };
      const drivers = state.drivers.map((driver, index) => {
        if (index !== 0) return driver;
        const synced = { ...driver };
        for (const key of SYNCED_DRIVER_FIELDS) {
          if (key in action.patch && driver[key] === state.insured[key]) synced[key] = insured[key];
        }
        return synced;
      });
      return { ...state, insured, drivers };
    }
    case 'updateAddress': {
      const address = { ...state.insured.address, ...action.patch };
      // Vehicles still garaged at the old mailing ZIP follow the new one.
      const vehicles = 'zip' in action.patch
        ? state.vehicles.map((vehicle) => (vehicle.garagingZip === state.insured.address.zip ? { ...vehicle, garagingZip: address.zip } : vehicle))
        : state.vehicles;
      return { ...state, insured: { ...state.insured, address }, vehicles };
    }
    case 'addVehicle':
      return { ...state, vehicles: [...state.vehicles, action.vehicle] };
    case 'updateVehicle':
      return { ...state, vehicles: state.vehicles.map((vehicle) => (vehicle.id === action.id ? { ...vehicle, ...action.patch } : vehicle)) };
    case 'removeVehicle':
      if (state.vehicles.length <= 1) return state;
      return {
        ...state,
        vehicles: state.vehicles.filter((vehicle) => vehicle.id !== action.id),
        drivers: state.drivers.map((driver) => (driver.primaryVehicleId === action.id ? { ...driver, primaryVehicleId: '' } : driver)),
      };
    case 'addDriver':
      return { ...state, drivers: [...state.drivers, action.driver] };
    case 'updateDriver':
      return { ...state, drivers: mapDriver(state.drivers, action.id, (driver) => ({ ...driver, ...action.patch })) };
    case 'removeDriver':
      // The principal named insured (first member) cannot be removed.
      if (state.drivers[0]?.id === action.id) return state;
      return { ...state, drivers: state.drivers.filter((driver) => driver.id !== action.id) };
    case 'addIncident':
      return { ...state, drivers: mapDriver(state.drivers, action.driverId, (driver) => ({ ...driver, incidents: [...driver.incidents, action.incident] })) };
    case 'updateIncident':
      return {
        ...state,
        drivers: mapDriver(state.drivers, action.driverId, (driver) => ({
          ...driver,
          incidents: driver.incidents.map((incident) => (incident.id === action.incidentId ? { ...incident, ...action.patch } : incident)),
        })),
      };
    case 'removeIncident':
      return { ...state, drivers: mapDriver(state.drivers, action.driverId, (driver) => ({ ...driver, incidents: driver.incidents.filter((incident) => incident.id !== action.incidentId) })) };
    case 'updateAdditional':
      return { ...state, additional: { ...state.additional, ...action.patch } };
    case 'updateCoverages':
      return { ...state, coverages: { ...state.coverages, ...action.patch } };
    case 'updatePointOfSale':
      return { ...state, pointOfSale: { ...state.pointOfSale, ...action.patch } };
    case 'recalculate':
      return { ...state, ratedSignature: ratingSignature(state), premiumChange: null };
    case 'updateReports':
      return { ...state, reports: { ...state.reports, ...action.patch } };
    case 'posOrderStarted': {
      const { orderClue, orderMvr } = state.reports;
      return { ...state, reports: { ...emptyReports(action.requestId), orderClue, orderMvr, clueStatus: orderClue ? 'ordering' : 'not-ordered', mvrStatus: orderMvr ? 'ordering' : 'not-ordered' } };
    }
    case 'posOrderApplied': {
      // Ignore results for a request that was superseded (e.g. driver data changed mid-order).
      const { result, priorSource } = action;
      if (result.requestId !== state.reports.requestId) return state;
      const { orderClue, orderMvr } = state.reports;
      const before = state.ratedSignature ? selectedPlan(rateQuote(state), state.pointOfSale.billPlan).total : null;
      const reports: SimulatedReports = {
        ...state.reports,
        clueStatus: orderClue ? (result.clueFindings.length ? 'flagged' : 'cleared') : 'not-ordered',
        mvrStatus: orderMvr ? (result.mvrFindings.length ? 'flagged' : 'cleared') : 'not-ordered',
        clueFindings: orderClue ? result.clueFindings : [],
        mvrFindings: orderMvr ? result.mvrFindings : [],
        vendor: orderClue ? result.vendor : null,
        priorSource: orderClue ? priorSource : 'insured',
        scoreTier: result.scoreTier,
        orderedAt: result.orderedAt,
        staleReason: '',
      };
      // Report results re-rate the quote automatically, as the carrier does after Point of Sale.
      const next = { ...state, reports };
      const after = selectedPlan(rateQuote(next), state.pointOfSale.billPlan).total;
      return { ...next, ratedSignature: ratingSignature(next), premiumChange: before !== null && before !== after ? { from: before, to: after } : null };
    }
    case 'posOrderCancelled':
      return { ...state, reports: { ...emptyReports(state.reports.requestId + 1), orderClue: state.reports.orderClue, orderMvr: state.reports.orderMvr } };
    case 'dismissPremiumChange':
      return { ...state, premiumChange: null };
    case 'updateAgent':
      return { ...state, agent: action.agent, policy: state.policy.policyNumber ? state.policy : { ...state.policy, agentCode: agentCodeFor(action.agent) } };
    case 'duplicateQuote':
      // A duplicate keeps every answer but is a new, unsold quote that must be re-rated and re-ordered.
      return { ...state, policy: { ...state.policy, quoteNumber: action.quoteNumber, policyNumber: '', boundAt: '' }, reports: emptyReports(state.reports.requestId + 1), ratedSignature: '', premiumChange: null };
    case 'showDocuments':
      return { ...state, ui: { ...state.ui, view: 'documents' } };
    case 'bindPolicy':
      return { ...state, policy: { ...state.policy, policyNumber: action.policyNumber, boundAt: action.boundAt } };
    case 'navigate': {
      const step = Math.max(0, Math.min(LAST_STEP, action.step));
      return { ...state, ui: { ...state.ui, view: 'wizard', step, maxStep: Math.max(state.ui.maxStep, step) } };
    }
    case 'showDashboard':
      return { ...state, ui: { ...state.ui, view: 'dashboard' } };
    case 'toggleHints':
      return { ...state, ui: { ...state.ui, hintMode: !state.ui.hintMode } };
    case 'toggleKeyboardHelp':
      return { ...state, ui: { ...state.ui, keyboardHelp: !state.ui.keyboardHelp } };
    case 'load':
      return { ...action.data, agent: state.agent, reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, maxStep: Math.max(state.ui.maxStep, action.maxStep) } };
    case 'reset':
      return { ...createQuoteData(state.agent), agent: state.agent, reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, step: 0, maxStep: 0 } };
  }
}

// Anything that could change an MVR/CLUE result for a rated driver.
function reportSignature(drivers: Driver[]): string {
  return JSON.stringify(ratedDrivers(drivers).map((driver) => [
    driver.id, driver.firstName, driver.lastName, driver.dob, driver.licenseNumber, driver.licenseState, driver.licenseStatus,
    driver.incidents.map((incident) => [incident.code, incident.date]),
  ]));
}

export function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  const next = baseReducer(state, action);
  if (next === state || action.type === 'load' || action.type === 'reset') return next;
  const { reports } = next;
  const ordered = reports.priorSource !== '' || reports.clueStatus === 'ordering' || reports.mvrStatus === 'ordering';
  if (ordered && reportSignature(state.drivers) !== reportSignature(next.drivers)) {
    return {
      ...next,
      reports: { ...emptyReports(reports.requestId + 1), orderClue: reports.orderClue, orderMvr: reports.orderMvr, staleReason: 'Driver information changed after reports were ordered. Click ORDER POINT OF SALE again to verify the updated drivers.' },
    };
  }
  return next;
}
