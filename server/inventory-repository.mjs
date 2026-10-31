import { resolve } from 'node:path';
import { inventory } from './demo-inventory.mjs';
import { ProjectEvidence, evidenceResult } from './project-evidence.mjs';

export const inventoryMode = process.env.INVENTORY_MODE || 'demo';
if (!['demo', 'real'].includes(inventoryMode)) throw new Error('INVENTORY_MODE must be demo or real');
if (process.env.VERCEL && inventoryMode === 'real') throw new Error('The private SQLite catalogue stays local. A reviewed Supabase inventory adapter is required for hosted real inventory.');
// Demo does not open or initialize the operator database.
const catalogue = inventoryMode === 'real'
  ? new (await import('./catalogue.mjs')).Catalogue(resolve(process.env.CATALOGUE_DB || 'private-data/catalogue.sqlite'))
  : null;
const evidence = catalogue ? new ProjectEvidence(catalogue) : null;

export function activeInventory() {
  return inventoryMode === 'demo' ? inventory : catalogue.publicListings();
}
export function propertyEvidence(listing) {
  return evidence ? evidence.forListing(listing) : evidenceResult(listing);
}
export function activeEvidence() { return evidence ? evidence.publicItems() : []; }
