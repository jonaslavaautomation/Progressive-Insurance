import { Snowflake, Bike, Building, Building2, Bus, Caravan, House, HousePlus, Sailboat, type LucideIcon } from 'lucide-react';
import type { OtherProductKey } from '@/products/types';

export const PRODUCT_ICONS: Record<OtherProductKey, LucideIcon> = { snowmobile: Snowflake, motorcycle: Bike, boat: Sailboat, motorhome: Bus, trailer: Caravan, renters: Building2, homeowners: House, condo: Building, landlord: HousePlus };
