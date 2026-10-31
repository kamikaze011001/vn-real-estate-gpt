import { Catalogue } from './catalogue.mjs';

// Reuse the same review, freshness, identity and permission rules locally/cloud.
// No operator method is exposed as an HTTP or MCP tool.
export async function withSharedCatalogue(store, action, { write = false, now } = {}) {
  const row = await store.request('rpc/load_catalogue', { method: 'POST', body: {} });
  const catalogue = new Catalogue(':memory:', now ? { now } : {});
  try {
    catalogue.restore(row.tables);
    const result = await action(catalogue);
    if (write && !(await store.request('rpc/commit_catalogue', { method: 'POST', body: {
      p_expected_version: row.version, p_tables: catalogue.snapshot(),
    } }))) throw new Error('Catalogue changed in another operation. Reload and review before retrying.');
    return result;
  } finally { catalogue.close(); }
}
