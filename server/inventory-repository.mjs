import { resolve } from 'node:path';
import { inventory } from './demo-inventory.mjs';
import { ProjectEvidence, evidenceResult } from './project-evidence.mjs';
import { operationContext } from './operation-context.mjs';

export const inventoryMode = process.env.INVENTORY_MODE || 'demo';
if (!['demo', 'real'].includes(inventoryMode)) throw new Error('INVENTORY_MODE must be demo or real');
const shared = process.env.SESSION_BACKEND === 'supabase';
if (process.env.VERCEL && inventoryMode === 'real' && !shared) throw new Error('Hosted real inventory requires the shared Supabase catalogue; private SQLite stays local.');
// Demo does not open or initialize the operator database.
const catalogue = inventoryMode === 'real' && !shared
  ? new (await import('./catalogue.mjs')).Catalogue(resolve(process.env.CATALOGUE_DB || 'private-data/catalogue.sqlite'))
  : null;
const currentCatalogue = () => {
  const current = operationContext()?.catalogue ?? catalogue;
  if (inventoryMode === 'real' && !current) throw new Error('Shared catalogue context is required');
  return current;
};

export function activeInventory() {
  return inventoryMode === 'demo' ? inventory : currentCatalogue().publicListings();
}
export function propertyEvidence(listing) {
  return inventoryMode === 'real' ? new ProjectEvidence(currentCatalogue()).forListing(listing) : evidenceResult(listing);
}
export function activeEvidence() { return inventoryMode === 'real' ? new ProjectEvidence(currentCatalogue()).publicItems() : []; }
