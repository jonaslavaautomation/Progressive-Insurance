// Quote state, factories and reducer. Kept framework-free so it can be unit tested.
import type { AdditionalDetails, AgentProfile, Coverages, Driver, Incident, MailingAddress, NamedInsured, PointOfSale, PolicyInfo, QuoteData, SimulatedReports, Vehicle } from '@/types/quote';
import { COVERAGE_DEFAULTS, VEHICLE_COVERAGE_DEFAULTS, VEHICLE_TYPES } from '@/data/options';
import { lookupVehicleDetails } from '@/data/vehicleCatalog';
import { emptyReports, type PosOrderResult } from '@/utils/reportSimulator';
import { DEFAULT_STATE, rulesFor, type StateName } from '@/data/states';
import { rateQuote, ratedDrivers, ratingSignature, selectedPlan } from '@/utils/ratingEngine';
import { addDays, formatDate, today } from '@/utils/dates';
import type { OtherProductKey, ProductKey, ProductQuote, ProductUnit } from '@/products/types';
import type { PolicyRecord } from '@/types/policy';
import { productSignature } from '@/products/engine';
import { advancePolicy } from '@/services/policyEngine';
import type { CommercialQuote } from '@/commercial/types';

export const STEPS = ['NAMED INSURED', 'PRODUCTS', 'HOUSEHOLD MEMBERS', 'ADDITIONAL DETAILS', 'COVERAGES/BILL PLANS', 'PORTFOLIO', 'POINT OF SALE', 'FINAL SALE'] as const;
export const LAST_STEP = STEPS.length - 1;
export const QUOTE_STATE = DEFAULT_STATE;

/** State-required and default coverages for a new quote. */
export function coveragesFor(state: string): Coverages {
  const rules = rulesFor(state);
  return { ...COVERAGE_DEFAULTS, umpd: rules.umpd ? '50' : 'None', medicalPayments: rules.medPay[0], pip: rules.pip?.default ?? '' };
}
/** Default logged-in agent until the user sets their own name (Dashboard header). */
export const DEFAULT_AGENT: AgentProfile = { name: 'Training Agent', agencyName: 'Training Agency Ins', agencyCode: 'TRN01' };

export function agentCodeFor(agent: AgentProfile): string {
  return `${agent.agencyCode} (${agent.agencyName.toUpperCase()})`;
}

export type PolicyTab = 'summary' | 'billing' | 'documents' | 'history';
/** Opens Policy View straight into Change Policy (optionally a specific change). */
export type PolicyIntent = '' | 'change' | 'address' | 'addVehicle' | 'removeVehicle';
export type PendingTab = 'nonpayment' | 'underwriting' | 'renewals';
export type ProofPage = 'hub' | 'idcards' | 'verification';
export type PortalView = 'pending' | 'customer' | 'proof';
/** Pages reached from the global navigation menus. */
export type PortalPage = 'newQuote' | 'existingQuotes' | 'bookBuilder' | 'activity' | 'billing' | 'esign' | 'claims' | 'prospects' | 'crossSell' | 'productGuides' | 'agency' | 'production' | 'commissions' | 'news' | 'support';

export interface PolicyQuery {
  mode: 'Customer' | 'Policy';
  lastName: string;
  firstName: string;
  policyNumber: string;
  product: string;
  status: string;
}

export const EMPTY_POLICY_QUERY: PolicyQuery = { mode: 'Customer', lastName: '', firstName: '', policyNumber: '', product: 'All', status: 'All' };

export interface UiState {
  view: 'dashboard' | 'wizard' | 'documents' | 'policies' | 'policy' | 'account' | 'commercial' | 'portal' | PortalView;
  portalPage: PortalPage;
  /** Select Product(s) dialog on the dashboard. */
  pickerOpen: boolean;
  pendingTab: PendingTab;
  /** Customer shown on Customer Summary (see customerKey in policyFilters). */
  customerKey: string;
  proofPage: ProofPage;
  /** Opens Policy View straight into a workflow (e.g. Change Policy). */
  policyIntent: PolicyIntent;
  /** State chosen on the dashboard for the next new quote. */
  quoteState: StateName;
  /** Product tab shown on Products and Coverages/Bill Plans. */
  activeProduct: ProductKey;
  policyId: string;
  policyTab: PolicyTab;
  policyQuery: PolicyQuery;
  step: number;
  maxStep: number;
  hintMode: boolean;
  /** Named Insured header switch: lets Tab reach the purple help buttons. */
  keyboardHelp: boolean;
}

export interface QuoteState extends QuoteData {
  ui: UiState;
  agent: AgentProfile;
  /** Issued training policies (persisted in the browser). */
  policies: PolicyRecord[];
  /** Training clock date, MM/DD/YYYY. */
  simDate: string;
  /** Commercial Lines quote in progress (kept separate from the personal lines quote). */
  commercial: CommercialQuote | null;
  /** Shows trainer-only controls (training clock, hints, sample data, trainer tools). */
  trainerMode: boolean;
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

function createInsured(state: string = QUOTE_STATE): NamedInsured {
  return {
    firstName: '', middleInitial: '', lastName: '', suffix: '', dob: '', gender: '', email: '', phones: [{ type: 'Cell', number: '' }],
    address: { line1: '', line2: '', city: '', state, zip: '', poBox: false }, movedRecently: '', disclosureAcknowledged: '',
  };
}

export function createQuoteData(agent: AgentProfile = DEFAULT_AGENT, state: string = QUOTE_STATE): QuoteData {
  return {
    policy: { agentCode: agentCodeFor(agent), quoteState: state, quoteNumber: '', effectiveDate: '', namedOperator: 'No', policyNumber: '', boundAt: '', comment: '' },
    insured: createInsured(state),
    vehicles: [createVehicle()],
    drivers: [createDriver({ relationship: 'Insured', operatorType: 'Principal', licenseState: state })],
    additional: { continuousInsurance: '', priorCarrier: '', priorLimits: '', priorYears: '', allDriversListed: '', priorCancellation: '', jointOwnership: '', paperless: '', primaryResidence: '', crossSell: [], noAdditionalRisks: false },
    coverages: coveragesFor(state),
    reports: emptyReports(),
    pointOfSale: { billPlan: 'PIF', paymentMethod: '', paymentAuthorized: '', documentDelivery: '', reviewedCoverages: false, confirmedHousehold: false, agreedToTerms: false },
    ratedSignature: '',
    premiumChange: null,
    products: ['auto'],
    productQuotes: {},
  };
}

export function createInitialState(agent: AgentProfile = DEFAULT_AGENT, policies: PolicyRecord[] = [], simDate = formatDate(today()), trainerMode = false): QuoteState {
  return {
    ...createQuoteData(agent), agent, policies, simDate, commercial: null, trainerMode,
    ui: { view: 'dashboard', step: 0, maxStep: 0, hintMode: false, keyboardHelp: true, activeProduct: 'auto', policyId: '', policyTab: 'summary', policyQuery: EMPTY_POLICY_QUERY, pendingTab: 'nonpayment', customerKey: '', proofPage: 'hub', policyIntent: '', portalPage: 'billing', pickerOpen: false, quoteState: QUOTE_STATE },
  };
}

/** Fictitious practice customer (no real person's details) for demos and trainer walkthroughs. */
export function createSampleQuote(agent: AgentProfile = DEFAULT_AGENT, state: string = QUOTE_STATE): QuoteData {
  const base = createQuoteData(agent, state);
  const rules = rulesFor(state);
  const vehicle: Vehicle = {
    ...createVehicle(rules.sample.zip), year: '2019', make: 'Toyota', model: 'Camry', bodyStyle: 'Sedan 4D', ...lookupVehicleDetails('2019', 'Toyota', 'Camry', 'Sedan 4D'),
    ownershipLength: 'At least 1 year but less than 3 years', primaryUse: '1A - Pleasure', rideshare: 'No', delivery: 'No', annualMiles: '10,000 - 11,999',
  };
  const insured: NamedInsured = {
    firstName: 'Alex', middleInitial: '', lastName: 'Sample', suffix: '', dob: '06/12/1984', gender: 'Not Specified', email: 'alex.sample@example.com',
    phones: [{ type: 'Cell', number: '919-555-0142' }],
    address: { line1: rules.sample.street, line2: '', city: rules.sample.city, state, zip: rules.sample.zip, poBox: false }, movedRecently: 'No', disclosureAcknowledged: 'Yes',
  };
  return {
    ...base,
    policy: { ...base.policy, quoteNumber: generateQuoteNumber(), effectiveDate: formatDate(addDays(today(), 7)) },
    insured,
    vehicles: [vehicle],
    drivers: [createDriver({
      relationship: 'Insured', operatorType: 'Principal', firstName: insured.firstName, lastName: insured.lastName, dob: insured.dob, gender: insured.gender, maritalStatus: 'Single',
      education: "Bachelor's degree", employment: 'Business/Sales/Office', occupation: 'Accountant/Auditor', licenseType: 'Personal Auto',
      licenseStatus: 'Valid', licenseState: state, licenseNumber: '000000001', ageFirstLicensed: '16', internationalYears: 'None', primaryVehicleId: vehicle.id,
    })],
    additional: { continuousInsurance: 'Yes', priorCarrier: 'State Farm', priorLimits: '100/300', priorYears: '3 years or more', allDriversListed: 'Yes', priorCancellation: 'No', jointOwnership: 'No', paperless: 'Yes', primaryResidence: 'Single Family Home', crossSell: [], noAdditionalRisks: true },
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
  | { type: 'updateReports'; patch: Partial<Pick<SimulatedReports, 'orderClue' | 'orderMvr' | 'simulation'>> }
  | { type: 'posOrderStarted'; requestId: number }
  | { type: 'posOrderApplied'; result: PosOrderResult; priorSource: 'vendor' | 'insured' }
  | { type: 'posOrderCancelled' }
  | { type: 'dismissPremiumChange' }
  | { type: 'updateAgent'; agent: AgentProfile }
  | { type: 'duplicateQuote'; quoteNumber: string }
  | { type: 'showDocuments' }
  | { type: 'startQuote'; products: ProductKey[]; productQuotes: Partial<Record<OtherProductKey, ProductQuote>>; coverages?: Partial<Coverages>; vehicleDefaults?: Partial<Vehicle> }
  | { type: 'addProducts'; products: ProductKey[]; productQuotes: Partial<Record<OtherProductKey, ProductQuote>> }
  | { type: 'suspendProduct'; key: ProductKey }
  | { type: 'setActiveProduct'; key: ProductKey }
  | { type: 'addUnit'; key: OtherProductKey; unit: ProductUnit }
  | { type: 'removeUnit'; key: OtherProductKey; unitId: string }
  | { type: 'updateUnit'; key: OtherProductKey; unitId: string; values?: Record<string, string>; coverages?: Record<string, string> }
  | { type: 'updateProduct'; key: OtherProductKey; patch: Partial<Pick<ProductQuote, 'coverages' | 'answers' | 'billPlan' | 'interests'>> }
  | { type: 'policiesIssued'; records: PolicyRecord[]; boundAt: string }
  | { type: 'updatePolicyRecord'; record: PolicyRecord }
  | { type: 'advanceClock'; to: string }
  | { type: 'clearPolicies' }
  | { type: 'openPolicies'; query?: Partial<PolicyQuery> }
  | { type: 'openPolicy'; id: string; tab?: PolicyTab; intent?: PolicyIntent }
  | { type: 'openAccount'; id: string }
  | { type: 'openPortal'; view: PortalView; tab?: PendingTab; customerKey?: string; policyId?: string; page?: ProofPage }
  | { type: 'policiesSeeded'; records: PolicyRecord[]; replace?: string[] }
  | { type: 'openPage'; page: PortalPage }
  | { type: 'setPicker'; open: boolean }
  | { type: 'setTrainerMode'; on: boolean }
  | { type: 'setQuoteState'; state: StateName }
  | { type: 'setPolicyTab'; tab: PolicyTab }
  | { type: 'bindPolicy'; policyNumber: string; boundAt: string }
  | { type: 'navigate'; step: number }
  | { type: 'showDashboard' }
  | { type: 'toggleHints' }
  | { type: 'toggleKeyboardHelp' }
  | { type: 'load'; data: QuoteData; maxStep: number }
  | { type: 'reset' }
  | { type: 'setCommercial'; quote: CommercialQuote | null; show?: boolean }
  | { type: 'commercialIssued'; records: PolicyRecord[]; quote: CommercialQuote };

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
      const productQuotes = 'zip' in action.patch ? followZip(state.productQuotes, state.insured.address.zip, address.zip) : state.productQuotes;
      return { ...state, insured: { ...state.insured, address }, vehicles, productQuotes };
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
      return signProducts({ ...state, ratedSignature: ratingSignature(state), premiumChange: null });
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
      return signProducts({ ...next, ratedSignature: ratingSignature(next), premiumChange: before !== null && before !== after ? { from: before, to: after } : null });
    }
    case 'posOrderCancelled':
      return { ...state, reports: { ...emptyReports(state.reports.requestId + 1), orderClue: state.reports.orderClue, orderMvr: state.reports.orderMvr } };
    case 'dismissPremiumChange':
      return { ...state, premiumChange: null };
    case 'updateAgent':
      return { ...state, agent: action.agent, policy: state.policy.policyNumber ? state.policy : { ...state.policy, agentCode: agentCodeFor(action.agent) } };
    case 'duplicateQuote': {
      // A duplicate keeps every answer but is a new, unsold quote that must be re-rated and re-ordered.
      const productQuotes = Object.fromEntries(Object.entries(state.productQuotes).map(([key, product]) => [key, { ...product!, quoteNumber: `5500${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, ratedSignature: '' }]));
      return { ...state, productQuotes, policy: { ...state.policy, quoteNumber: action.quoteNumber, policyNumber: '', boundAt: '' }, reports: emptyReports(state.reports.requestId + 1), ratedSignature: '', premiumChange: null };
    }
    case 'showDocuments':
      return { ...state, ui: { ...state.ui, view: 'documents' } };
    case 'startQuote':
      return { ...withDefaults(createQuoteData(state.agent, state.ui.quoteState), action.coverages, action.vehicleDefaults), products: action.products, productQuotes: action.productQuotes, agent: state.agent, policies: state.policies, simDate: state.simDate, commercial: state.commercial, trainerMode: state.trainerMode, reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, view: 'wizard', step: 0, maxStep: 0, activeProduct: action.products[0], pickerOpen: false } };
    case 'addProducts': {
      const products = [...state.products, ...action.products.filter((key) => !state.products.includes(key))];
      // Auto is always listed first, as on the carrier's product tabs.
      products.sort((a, b) => (a === 'auto' ? -1 : b === 'auto' ? 1 : 0));
      const productQuotes = { ...state.productQuotes };
      for (const [key, product] of Object.entries(action.productQuotes)) productQuotes[key as OtherProductKey] = state.productQuotes[key as OtherProductKey] ? { ...state.productQuotes[key as OtherProductKey]!, suspended: false } : product;
      return { ...state, products, productQuotes, ui: { ...state.ui, activeProduct: action.products[0] ?? state.ui.activeProduct } };
    }
    case 'suspendProduct': {
      const products = state.products.filter((key) => key !== action.key);
      if (!products.length) return state;
      const productQuotes = action.key === 'auto' ? state.productQuotes : { ...state.productQuotes, [action.key]: { ...state.productQuotes[action.key]!, suspended: true } };
      return { ...state, products, productQuotes, ui: { ...state.ui, activeProduct: products[0] } };
    }
    case 'setActiveProduct':
      return { ...state, ui: { ...state.ui, activeProduct: action.key } };
    case 'addUnit':
      return updateProductQuote(state, action.key, (product) => ({ ...product, units: [...product.units, action.unit] }));
    case 'removeUnit':
      return updateProductQuote(state, action.key, (product) => (product.units.length <= 1 ? product : { ...product, units: product.units.filter((unit) => unit.id !== action.unitId) }));
    case 'updateUnit':
      return updateProductQuote(state, action.key, (product) => ({ ...product, units: product.units.map((unit) => (unit.id === action.unitId ? { ...unit, values: { ...unit.values, ...action.values }, coverages: { ...unit.coverages, ...action.coverages } } : unit)) }));
    case 'updateProduct':
      return updateProductQuote(state, action.key, (product) => ({ ...product, ...action.patch }));
    case 'policiesIssued':
      return { ...state, policies: [...action.records, ...state.policies], policy: { ...state.policy, policyNumber: action.records[0]?.policyNumber ?? '', boundAt: action.boundAt } };
    case 'updatePolicyRecord':
      return { ...state, policies: state.policies.map((record) => (record.id === action.record.id ? action.record : record)) };
    case 'advanceClock':
      return { ...state, simDate: action.to, policies: state.policies.map((record) => advancePolicy(record, state.simDate, action.to)) };
    case 'clearPolicies':
      return { ...state, policies: [], policy: { ...state.policy, policyNumber: '', boundAt: '' } };
    case 'openPolicies':
      return { ...state, ui: { ...state.ui, view: 'policies', policyQuery: { ...EMPTY_POLICY_QUERY, ...action.query } } };
    case 'openPolicy':
      return { ...state, ui: { ...state.ui, view: 'policy', policyId: action.id, policyTab: action.tab ?? 'summary', policyIntent: action.intent ?? '' } };
    case 'openAccount':
      return { ...state, ui: { ...state.ui, view: 'account', policyId: action.id, policyIntent: '' } };
    case 'openPortal':
      return { ...state, ui: { ...state.ui, view: action.view, pendingTab: action.tab ?? state.ui.pendingTab, customerKey: action.customerKey ?? state.ui.customerKey, policyId: action.policyId ?? state.ui.policyId, proofPage: action.page ?? 'hub' } };
    case 'policiesSeeded':
      return { ...state, policies: [...action.records, ...state.policies.filter((policy) => !action.replace?.includes(policy.id))] };
    case 'openPage':
      return { ...state, ui: { ...state.ui, view: 'portal', portalPage: action.page, pickerOpen: false } };
    case 'setPicker':
      return { ...state, ui: { ...state.ui, pickerOpen: action.open } };
    case 'setQuoteState':
      return { ...state, ui: { ...state.ui, quoteState: action.state } };
    case 'setTrainerMode':
      return { ...state, trainerMode: action.on, ui: { ...state.ui, hintMode: action.on && state.ui.hintMode } };
    case 'setPolicyTab':
      return { ...state, ui: { ...state.ui, policyTab: action.tab } };
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
      // The practice customer fills the shared and Auto pages; products already chosen stay on the quote.
      return { ...action.data, products: state.products, productQuotes: followZip(state.productQuotes, state.insured.address.zip, action.data.insured.address.zip), agent: state.agent, policies: state.policies, simDate: state.simDate, commercial: state.commercial, trainerMode: state.trainerMode, reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, maxStep: Math.max(state.ui.maxStep, action.maxStep), activeProduct: state.products[0] } };
    case 'reset':
      return { ...createQuoteData(state.agent, state.policy.quoteState), agent: state.agent, policies: state.policies, simDate: state.simDate, commercial: state.commercial, trainerMode: state.trainerMode, reports: emptyReports(state.reports.requestId + 1), ui: { ...state.ui, step: 0, maxStep: 0, activeProduct: 'auto' } };
    case 'setCommercial':
      return { ...state, commercial: action.quote, ui: action.show ? { ...state.ui, view: 'commercial' } : state.ui };
    case 'commercialIssued':
      return { ...state, commercial: action.quote, policies: [...action.records, ...state.policies] };
  }
}

/** Agent default coverages (Quote Preferences) applied to a brand-new quote. */
function withDefaults(data: QuoteData, coverages?: Partial<Coverages>, vehicleDefaults?: Partial<Vehicle>): QuoteData {
  return { ...data, coverages: { ...data.coverages, ...coverages }, vehicles: data.vehicles.map((vehicle) => ({ ...vehicle, ...vehicleDefaults })) };
}

/** Units still garaged at the old mailing ZIP (or none yet) follow the new mailing ZIP. */
function followZip(productQuotes: QuoteState['productQuotes'], oldZip: string, newZip: string): QuoteState['productQuotes'] {
  return Object.fromEntries(Object.entries(productQuotes).map(([key, product]) => [key, { ...product!, units: product!.units.map((unit) => ('garagingZip' in unit.values && (unit.values.garagingZip === oldZip || !unit.values.garagingZip) ? { ...unit, values: { ...unit.values, garagingZip: newZip } } : unit)) }]));
}

function updateProductQuote(state: QuoteState, key: OtherProductKey, update: (product: ProductQuote) => ProductQuote): QuoteState {
  const product = state.productQuotes[key];
  return product ? { ...state, productQuotes: { ...state.productQuotes, [key]: update(product) } } : state;
}

/** Marks every active non-Auto product as rated against the current inputs. */
function signProducts(state: QuoteState): QuoteState {
  const productQuotes = { ...state.productQuotes };
  for (const key of state.products) {
    if (key === 'auto' || !productQuotes[key]) continue;
    productQuotes[key] = { ...productQuotes[key]!, ratedSignature: productSignature(key, state) };
  }
  return { ...state, productQuotes };
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
