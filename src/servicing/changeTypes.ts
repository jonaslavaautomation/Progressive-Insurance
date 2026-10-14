// Which policy changes (endorsements) each product supports in Change Policy.
import type { PolicyRecord } from '@/types/policy';
import { configFor } from '@/products/configs';
import { MORTGAGEE_PRODUCTS } from '@/products/property';
import type { OtherProductKey } from '@/products/types';

export type ChangeType = 'address' | 'contact' | 'addVehicle' | 'changeVehicle' | 'replaceVehicle' | 'removeVehicle' | 'addDriver' | 'changeDriver' | 'removeDriver' | 'coverages' | 'lienholder' | 'addUnit' | 'removeUnit' | 'dwelling' | 'mortgagee';

export function availableTypes(policy: PolicyRecord): ChangeType[] {
  if (policy.product === 'auto') return ['address', 'contact', 'addVehicle', 'changeVehicle', 'replaceVehicle', 'removeVehicle', 'addDriver', 'changeDriver', 'removeDriver', 'coverages', 'lienholder'];
  if (MORTGAGEE_PRODUCTS.includes(policy.product as OtherProductKey)) return ['address', 'contact', 'dwelling', 'coverages', 'mortgagee'];
  const config = configFor(policy.product);
  const types: ChangeType[] = ['address', 'contact'];
  if (config?.multiUnit) types.push('addUnit', 'removeUnit');
  types.push('coverages');
  if (policy.source.kind === 'commercial' && config?.motorized) types.push('addDriver', 'changeDriver', 'removeDriver');
  if (config?.idField === 'vin' || config?.idField === 'hin' || policy.product === 'renters') types.push('lienholder');
  return types;
}
