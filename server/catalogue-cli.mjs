import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Catalogue } from './catalogue.mjs';
import { ProjectEvidence } from './project-evidence.mjs';
import { withSharedCatalogue } from './shared-catalogue.mjs';
import { SupabaseStore } from './supabase-store.mjs';
import { loadDeploymentEnv } from '../scripts/deployment-env.mjs';

const usage = `Private catalogue operator commands (never exposed over HTTP/MCP):
  npm run catalogue -- init
  npm run catalogue -- registry
  npm run catalogue -- source <source.json> <actor>
  npm run catalogue -- project <project.json> <actor>
  npm run catalogue -- building <building.json> <actor>
  npm run catalogue -- import <source-id> <listings.csv>
  npm run catalogue -- reviews [run-id]
  npm run catalogue -- approve <review-id> <reviewer> <note> [--ack-duplicates]
  npm run catalogue -- reject <review-id> <reviewer> <note>
  npm run catalogue -- withdraw <listing-id> <actor> <reason>
  npm run catalogue -- history <listing-id>
  npm run catalogue -- published
  npm run catalogue -- evidence-stage <evidence.json> <actor>
  npm run catalogue -- evidence-reviews
  npm run catalogue -- evidence-approve <review-id> <reviewer> <note>
  npm run catalogue -- evidence-reject <review-id> <reviewer> <note>
  npm run catalogue -- evidence-withdraw <evidence-id> <actor> <reason>
  npm run catalogue -- evidence-published
  npm run catalogue -- evidence-watchlist
Set CATALOGUE_DB to choose a local database; default: private-data/catalogue.sqlite.
Set CATALOGUE_BACKEND=supabase for the shared operator store (loads ignored deployment settings).
Use opaque internal references for permission/updater evidence, not personal details.`;
const [command, ...args] = process.argv.slice(2);
if (!command || command === 'help') { console.log(usage); process.exit(0); }
function operate(catalogue) {
  const evidence = new ProjectEvidence(catalogue);
  const json = file => JSON.parse(readFileSync(file, 'utf8'));
  const exactArgs = (min, max = min) => { if (args.length < min || args.length > max) throw new Error(usage); };
  let result;
  switch (command) {
    case 'init': {
      exactArgs(0);
      const seeds = json(new URL('../data/source-candidates.json', import.meta.url));
      const existing = new Set(catalogue.registry().source.map(source => source.id));
      for (const seed of seeds) if (!existing.has(seed.id)) catalogue.putSource(seed, 'initial-source-research');
      result = { initialized: true, candidateSources: seeds.length, note: 'Candidates only; no permission or live inventory granted.' };
      break;
    }
    case 'registry': exactArgs(0); result = catalogue.registry(); break;
    case 'source': exactArgs(2); result = catalogue.putSource(json(args[0]), args[1]); break;
    case 'project': exactArgs(2); result = catalogue.putProject(json(args[0]), args[1]); break;
    case 'building': exactArgs(2); result = catalogue.putBuilding(json(args[0]), args[1]); break;
    case 'import': exactArgs(2); result = catalogue.importCsv(args[0], readFileSync(args[1], 'utf8')); break;
    case 'reviews': exactArgs(0, 1); result = catalogue.reviews(args[0]); break;
    case 'approve': exactArgs(3, 4); if (args[3] && args[3] !== '--ack-duplicates') throw new Error(usage); result = catalogue.approve(args[0], args[1], args[2], { acknowledgeDuplicates: args[3] === '--ack-duplicates' }); break;
    case 'reject': exactArgs(3); result = catalogue.reject(...args) ?? { rejected: args[0] }; break;
    case 'withdraw': exactArgs(3); result = catalogue.withdraw(...args) ?? { withdrawn: args[0] }; break;
    case 'history': exactArgs(1); result = catalogue.history(args[0]); break;
    case 'published': exactArgs(0); result = catalogue.publicListings(); break;
    case 'evidence-stage': exactArgs(2); result = evidence.stage(json(args[0]), args[1]); break;
    case 'evidence-reviews': exactArgs(0); result = evidence.reviews(); break;
    case 'evidence-approve': exactArgs(3); result = evidence.approve(...args); break;
    case 'evidence-reject': exactArgs(3); result = evidence.reject(...args) ?? { rejected: args[0] }; break;
    case 'evidence-withdraw': exactArgs(3); result = evidence.withdraw(...args) ?? { withdrawn: args[0] }; break;
    case 'evidence-published': exactArgs(0); result = evidence.publicItems(); break;
    case 'evidence-watchlist': exactArgs(0); result = json(new URL('../data/evidence-watchlist.json', import.meta.url)); break;
    default: throw new Error(usage);
  }
  return result;
}
let catalogue;
try {
  let result;
  if (process.env.CATALOGUE_BACKEND === 'supabase') {
    loadDeploymentEnv();
    const store = new SupabaseStore({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY });
    const readOnly = ['registry','reviews','history','published','evidence-reviews','evidence-published','evidence-watchlist'].includes(command);
    result = await withSharedCatalogue(store, operate, { write: !readOnly });
  } else {
    if (process.env.CATALOGUE_BACKEND && process.env.CATALOGUE_BACKEND !== 'local') throw new Error('Invalid CATALOGUE_BACKEND');
    catalogue = new Catalogue(resolve(process.env.CATALOGUE_DB || 'private-data/catalogue.sqlite'));
    result = operate(catalogue);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { catalogue?.close(); }
