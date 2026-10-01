// Which policy changes (endorsements) each product supports in Change Policy.
import type { PolicyRecord } from '@/types/policy';
import { configFor } from '@/products/configs';

export type ChangeType = 'address' | 'contact' | 'addVehicle' | 'replaceVehicle' | 'removeVehicle' | 'addDriver' | 'removeDriver' | 'coverages' | 'lienholder' | 'addUnit' | 'removeUnit';

export function availableTypes(policy: PolicyRecord): ChangeType[] {
  if (policy.product === 'auto') return ['address', 'contact', 'addVehicle', 'replaceVehicle', 'removeVehicle', 'addDriver', 'removeDriver', 'coverages', 'lienholder'];
  const config = configFor(policy.product);
  const types: ChangeType[] = ['address', 'contact'];
  if (config?.multiUnit) types.push('addUnit', 'removeUnit');
  types.push('coverages');
  if (policy.product === 'commercialAuto') types.push('addDriver', 'removeDriver');
  if (config?.idField === 'vin' || config?.idField === 'hin' || policy.product === 'renters') types.push('lienholder');
  return types;
}
