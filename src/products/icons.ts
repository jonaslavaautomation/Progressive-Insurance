import { Bike, Building2, Bus, Caravan, Sailboat, type LucideIcon } from 'lucide-react';
import type { OtherProductKey } from '@/products/types';

export const PRODUCT_ICONS: Record<OtherProductKey, LucideIcon> = { motorcycle: Bike, boat: Sailboat, motorhome: Bus, trailer: Caravan, renters: Building2 };
