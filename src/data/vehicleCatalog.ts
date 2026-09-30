// Small offline vehicle catalog standing in for the carrier's VIN/ISO lookup service.

interface BodyStyle { name: string; iso: number; isoOtc: number; isoCollision: number; msrp: number }
interface ModelEntry { name: string; fromYear: number; bodies: BodyStyle[] }

export const FIRST_MODEL_YEAR = 1995;
export const LATEST_MODEL_YEAR = new Date().getFullYear() + 1;

const catalog: Record<string, ModelEntry[]> = {
  Chevrolet: [
    { name: 'Equinox', fromYear: 2005, bodies: [{ name: 'Utility 4D', iso: 16, isoOtc: 38, isoCollision: 40, msrp: 29_000 }] },
    { name: 'Malibu', fromYear: 1997, bodies: [{ name: 'Sedan 4D', iso: 15, isoOtc: 36, isoCollision: 41, msrp: 25_500 }] },
    { name: 'Silverado 1500', fromYear: 1999, bodies: [{ name: 'Crew Cab Pickup', iso: 19, isoOtc: 44, isoCollision: 43, msrp: 44_000 }, { name: 'Regular Cab Pickup', iso: 17, isoOtc: 40, isoCollision: 40, msrp: 36_000 }] },
  ],
  Ford: [
    { name: 'Escape', fromYear: 2001, bodies: [{ name: 'Utility 4D', iso: 15, isoOtc: 37, isoCollision: 39, msrp: 28_500 }] },
    { name: 'F-150', fromYear: 1995, bodies: [{ name: 'SuperCrew Pickup', iso: 19, isoOtc: 45, isoCollision: 42, msrp: 46_000 }, { name: 'Regular Cab Pickup', iso: 17, isoOtc: 41, isoCollision: 39, msrp: 35_000 }] },
    { name: 'Mustang', fromYear: 1995, bodies: [{ name: 'Coupe 2D', iso: 22, isoOtc: 46, isoCollision: 50, msrp: 32_000 }, { name: 'Convertible 2D', iso: 24, isoOtc: 48, isoCollision: 52, msrp: 38_000 }] },
  ],
  Honda: [
    { name: 'Accord', fromYear: 1995, bodies: [{ name: 'Sedan 4D', iso: 15, isoOtc: 35, isoCollision: 41, msrp: 28_000 }] },
    { name: 'Civic', fromYear: 1995, bodies: [{ name: 'Sedan 4D', iso: 13, isoOtc: 33, isoCollision: 39, msrp: 24_000 }, { name: 'Hatchback 4D', iso: 14, isoOtc: 34, isoCollision: 40, msrp: 25_500 }] },
    { name: 'CR-V', fromYear: 1997, bodies: [{ name: 'Utility 4D', iso: 14, isoOtc: 34, isoCollision: 38, msrp: 30_500 }] },
  ],
  Hyundai: [
    { name: 'Elantra', fromYear: 1996, bodies: [{ name: 'Sedan 4D', iso: 13, isoOtc: 35, isoCollision: 40, msrp: 22_000 }] },
    { name: 'Tucson', fromYear: 2005, bodies: [{ name: 'Utility 4D', iso: 15, isoOtc: 38, isoCollision: 40, msrp: 28_000 }] },
  ],
  Jeep: [
    { name: 'Grand Cherokee', fromYear: 1995, bodies: [{ name: 'Utility 4D', iso: 19, isoOtc: 44, isoCollision: 43, msrp: 41_000 }] },
    { name: 'Wrangler', fromYear: 1997, bodies: [{ name: 'Utility 2D', iso: 18, isoOtc: 45, isoCollision: 41, msrp: 34_000 }, { name: 'Unlimited Utility 4D', iso: 19, isoOtc: 46, isoCollision: 42, msrp: 38_000 }] },
  ],
  Nissan: [
    { name: 'Altima', fromYear: 1995, bodies: [{ name: 'Sedan 4D', iso: 15, isoOtc: 37, isoCollision: 42, msrp: 26_500 }] },
    { name: 'Rogue', fromYear: 2008, bodies: [{ name: 'Utility 4D', iso: 15, isoOtc: 37, isoCollision: 39, msrp: 29_500 }] },
  ],
  Tesla: [
    { name: 'Model 3', fromYear: 2017, bodies: [{ name: 'Sedan 4D', iso: 24, isoOtc: 50, isoCollision: 55, msrp: 42_000 }] },
    { name: 'Model Y', fromYear: 2020, bodies: [{ name: 'Utility 4D', iso: 24, isoOtc: 50, isoCollision: 54, msrp: 47_000 }] },
  ],
  Toyota: [
    { name: 'Camry', fromYear: 1995, bodies: [{ name: 'Sedan 4D', iso: 14, isoOtc: 35, isoCollision: 42, msrp: 28_500 }] },
    { name: 'RAV4', fromYear: 1996, bodies: [{ name: 'Utility 4D', iso: 14, isoOtc: 35, isoCollision: 39, msrp: 31_000 }] },
    { name: 'Tacoma', fromYear: 1995, bodies: [{ name: 'Double Cab Pickup', iso: 17, isoOtc: 42, isoCollision: 40, msrp: 36_000 }] },
  ],
};

export const MODEL_YEARS = Array.from({ length: LATEST_MODEL_YEAR - FIRST_MODEL_YEAR + 1 }, (_, i) => String(LATEST_MODEL_YEAR - i));

export function makesFor(year: string): string[] {
  const y = Number(year);
  if (!y) return [];
  return Object.keys(catalog).filter((make) => catalog[make].some((model) => model.fromYear <= y));
}

export function modelsFor(year: string, make: string): string[] {
  const y = Number(year);
  return (catalog[make] ?? []).filter((model) => model.fromYear <= y).map((model) => model.name);
}

export function bodyStylesFor(make: string, model: string): string[] {
  return (catalog[make]?.find((entry) => entry.name === model)?.bodies ?? []).map((body) => body.name);
}

function findBody(make: string, model: string, bodyStyle: string) {
  return catalog[make]?.find((entry) => entry.name === model)?.bodies.find((body) => body.name === bodyStyle);
}

/** Fields the carrier fills from the ISO lookup once year/make/model/body are known. */
export function lookupVehicleDetails(year: string, make: string, model: string, bodyStyle: string) {
  const body = findBody(make, model, bodyStyle);
  const y = Number(year);
  if (!body || !y) return { isoSymbol: '', isoSymbolOtc: '', isoSymbolCollision: '', originalCostNew: '', marketValue: '', passiveRestraint: '' };
  // Newer model years are costlier to repair; nudge symbols up by model year band.
  const band = y >= 2020 ? 2 : y >= 2010 ? 1 : 0;
  const msrp = Math.round(body.msrp * (0.72 + (y - FIRST_MODEL_YEAR) * 0.009));
  const age = Math.max(0, new Date().getFullYear() - y);
  const marketValue = Math.round((msrp * Math.max(0.08, 0.85 ** age)) / 100) * 100;
  return {
    isoSymbol: String(body.iso + band),
    isoSymbolOtc: String(body.isoOtc + band),
    isoSymbolCollision: String(body.isoCollision + band),
    originalCostNew: msrp.toLocaleString('en-US'),
    marketValue: marketValue.toLocaleString('en-US'),
    passiveRestraint: y >= 1998 ? 'Airbag - Full' : 'Airbag - Driver Side',
  };
}

// Simulated VIN decode: World Manufacturer Identifier prefix -> make, 10th character -> model year.
const WMI: Record<string, string> = { '1G1': 'Chevrolet', '1GC': 'Chevrolet', '1FA': 'Ford', '1FT': 'Ford', '1FM': 'Ford', '1HG': 'Honda', '2HG': 'Honda', '5J6': 'Honda', 'KMH': 'Hyundai', 'KM8': 'Hyundai', '1C4': 'Jeep', '1J4': 'Jeep', '1N4': 'Nissan', 'JN8': 'Nissan', '5YJ': 'Tesla', '7SA': 'Tesla', '4T1': 'Toyota', 'JTM': 'Toyota', '2T3': 'Toyota', '3TM': 'Toyota' };
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export function decodeVin(vin: string): { year: string; make: string; model: string; bodyStyle: string } | null {
  if (vin.length !== 17) return null;
  const make = WMI[vin.slice(0, 3)];
  const code = YEAR_CODES.indexOf(vin[9]);
  if (!make || code < 0) return null;
  // Year codes repeat every 30 years; pick the most recent cycle that isn't in the future.
  let year = 2010 + code;
  if (year > LATEST_MODEL_YEAR) year -= 30;
  const model = modelsFor(String(year), make)[0];
  if (!model) return null;
  return { year: String(year), make, model, bodyStyle: bodyStylesFor(make, model)[0] };
}
