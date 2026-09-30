// Quote state, factories and reducer. Kept framework-free so it can be unit tested.
import type { AdditionalDetails, Coverages, Driver, Incident, MailingAddress, NamedInsured, PointOfSale, PolicyInfo, QuoteData, SimulatedReports, Vehicle } from '@/types/quote';
import { VEHICLE_TYPES } from '@/data/options';
import { lookupVehicleDetails } from '@/data/vehicleCatalog';
import { emptyReports } from '@/utils/reportSimulator';
import { ratedDrivers } from '@/utils/ratingEngine';
import { addDays, formatDate, today } from '@/utils/dates';

export const STEPS = ['NAMED INSURED', 'PRODUCTS', 'HOUSEHOLD MEMBERS', 'ADDITIONAL DETAILS', 'COVERAGES/BILL PLANS', 'PORTFOLIO', 'POINT OF SALE', 'FINAL SALE'] as const;
export const LAST_STEP = STEPS.length - 1;
export const AGENT_CODE = '029T9 (A JACKIE DEES INS)';
export const QUOTE_STATE = 'North Carolina';

export interface UiState {
  view: 'dashboard' | 'wizard';
  step: number;
  maxStep: number;
  hintMode: boolean;
}

export interface QuoteState extends QuoteData {
  ui: UiState;
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
    compDeductible: '500', collDeductible: '500',
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

export function createQuoteData(): QuoteData {
  return {
    policy: { agentCode: AGENT_CODE, quoteState: QUOTE_STATE, quoteNumber: '', effectiveDate: '', namedOperator: 'No', policyNumber: '', boundAt: '' },
    insured: createInsured(),
    vehicles: [createVehicle()],
    drivers: [createDriver({ relationship: 'Insured', operatorType: 'Principal' })],
    additional: { priorInsurance: '', priorCarrier: '', priorBiLimits: '', yearsWithPrior: '', residenceType: '', yearsAtResidence: '', paperless: '', eSignature: '' },
    coverages: { bodilyInjury: '50/100', propertyDamage: '50000', uninsuredMotorist: '50/100', medicalPayments: 'None', roadside: 'No', rentalReimbursement: 'None' },
    reports: emptyReports(),
    pointOfSale: { billPlan: '', paymentMethod: '', paymentAuthorized: '', documentDelivery: '', reviewedCoverages: false, confirmedHousehold: false, agreedToTerms: false },
  };
}

export function createInitialState(): QuoteState {
  return { ...createQuoteData(), ui: { view: 'dashboard', step: 0, maxStep: 0, hintMode: false } };
}

/** Pre-filled customer matching the training screenshots, for demos and trainer walkthroughs. */
export function createSampleQuote(): QuoteData {
  const base = createQuoteData();
  const vehicle: Vehicle = {
    ...createVehicle('27604'), year: '2019', make: 'Toyota', model: 'Camry', bodyStyle: 'Sedan 4D', ...lookupVehicleDetails('2019', 'Toyota', 'Camry', 'Sedan 4D'),
    ownershipLength: 'At least 1 year but less than 3 years', primaryUse: '1A - Pleasure', rideshare: 'No', delivery: 'No', annualMiles: '10,000 - 11,999',
  };
  const insured: NamedInsured = {
    firstName: 'Jonnie', middleInitial: '', lastName: 'James', suffix: '', dob: '04/15/1957', gender: 'Male', email: 'umm_5100evb@yahoo.com',
    phones: [{ type: 'Cell', number: '847-812-0874' }],
    address: { line1: '412 Glenwood Ave', line2: '', city: 'Raleigh', state: QUOTE_STATE, zip: '27604', poBox: false }, movedRecently: 'No', disclosureAcknowledged: 'Yes',
  };
  return {
    ...base,
    policy: { ...base.policy, quoteNumber: '550012797337', effectiveDate: formatDate(addDays(today(), 7)) },
    insured,
    vehicles: [vehicle],
    drivers: [createDriver({
      relationship: 'Insured', operatorType: 'Principal', firstName: 'Jonnie', lastName: 'James', dob: insured.dob, gender: 'Male', maritalStatus: 'Single',
      education: 'High school diploma or GED', employment: 'Business/Sales/Office', occupation: 'Manager/Supervisor - Office', licenseType: 'Personal Auto',
      licenseStatus: 'Valid', licenseState: 'Virginia', licenseNumber: 'T20458188', ageFirstLicensed: '16', internationalYears: 'None', primaryVehicleId: vehicle.id,
    })],
    additional: { priorInsurance: 'Yes', priorCarrier: 'State Farm', priorBiLimits: '50/100', yearsWithPrior: '3 to 5 years', residenceType: 'Own home', yearsAtResidence: 'More than 5 years', paperless: 'Yes', eSignature: 'Yes' },
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
  | { type: 'reportsOrdered'; requestId: number }
  | { type: 'reportsReceived'; reports: SimulatedReports }
  | { type: 'bindPolicy'; policyNumber: string; boundAt: string }
  | { type: 'navigate'; step: number }
  | { type: 'showDashboard' }
  | { type: 'toggleHints' }
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
    case 'reportsOrdered':
      return { ...state, reports: { ...emptyReports(action.requestId), mvrStatus: 'ordered', clueStatus: 'ordered' } };
    case 'reportsReceived':
      // Ignore results for a request that was superseded (e.g. driver data changed mid-order).
      if (action.reports.requestId !== state.reports.requestId || state.reports.mvrStatus !== 'ordered') return state;
      return { ...state, reports: action.reports };
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
    case 'load':
      return { ...action.data, reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, maxStep: Math.max(state.ui.maxStep, action.maxStep) } };
    case 'reset':
      return { ...createQuoteData(), reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, step: 0, maxStep: 0 } };
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
  if (reports.mvrStatus !== 'pending' && reportSignature(state.drivers) !== reportSignature(next.drivers)) {
    return {
      ...next,
      reports: { ...emptyReports(reports.requestId + 1), staleReason: 'Driver information changed after reports were ordered. Re-order MVR & CLUE to verify the updated drivers.' },
    };
  }
  return next;
}
