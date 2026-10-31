import { randomUUID, createHash } from 'node:crypto';
import { sessionMap } from './operation-context.mjs';
import { getProperty } from './properties.mjs';
import { inventoryMode, activeInventory, activeEvidence } from './inventory-repository.mjs';

// Temporary explorer context, isolated by an unguessable session ID.
// No account data, chats, or memories are stored here.
const localSessions = new Map();
const sessions = () => sessionMap('explorer', localSessions);
const lifetimeMs = 60 * 60 * 1000;
function prune() {
  const now = Date.now();
  for (const [id, session] of sessions()) if (now - session.updatedAt > lifetimeMs) sessions().delete(id);
}
export function newExplorerSession() {
  prune();
  const id = randomUUID();
  sessions().set(id, { ids: [], focusedListingId: null, savedListingIds: [], filters: {}, view: 'list', revision: 0, updatedAt: Date.now() });
  return id;
}
export function readSelection(explorerSessionId) {
  prune();
  const session = sessions().get(explorerSessionId);
  if (!session) throw new Error('Phiên chọn căn đã hết hạn. Hãy mở lại danh sách căn hộ.');
  const records = activeInventory();
  const currentIds = new Set(records.map(record => record.id));
  const signature = createHash('sha256').update(JSON.stringify([records, activeEvidence()])).digest('hex');
  if (session.inventorySignature !== signature) {
    if (session.inventorySignature) session.revision += 1;
    session.inventorySignature = signature;
    session.ids = session.ids.filter(id => currentIds.has(id));
    session.savedListingIds = session.savedListingIds.filter(id => currentIds.has(id));
    if (!currentIds.has(session.focusedListingId)) session.focusedListingId = null;
  }
  return {
    explorerSessionId, selectedListingIds: [...session.ids], focusedListingId: session.focusedListingId,
    savedListingIds: [...session.savedListingIds], filters: { ...session.filters }, view: session.view,
    revision: session.revision, demo: inventoryMode === 'demo',
  };
}
export function writeSelection(explorerSessionId, ids, context = {}) {
  readSelection(explorerSessionId);
  if (ids.length > 3 || new Set(ids).size !== ids.length || ids.some(id => !getProperty(id))) throw new Error('Danh sách căn được chọn không hợp lệ.');
  if (context.focusedListingId != null && !getProperty(context.focusedListingId)) throw new Error('Căn đang xem không hợp lệ.');
  if (context.savedListingIds && (context.savedListingIds.length > 30 || new Set(context.savedListingIds).size !== context.savedListingIds.length || context.savedListingIds.some(id => !getProperty(id)))) throw new Error('Danh sách căn đã lưu không hợp lệ.');
  if (context.view && !['list', 'map', 'details', 'comparison'].includes(context.view)) throw new Error('Chế độ xem không hợp lệ.');
  const session = sessions().get(explorerSessionId);
  sessions().set(explorerSessionId, {
    ...session, ids: [...ids],
    focusedListingId: context.focusedListingId === undefined ? session.focusedListingId : context.focusedListingId,
    savedListingIds: context.savedListingIds ? [...context.savedListingIds] : session.savedListingIds,
    filters: context.filters ? { ...context.filters } : session.filters,
    view: context.view || session.view, revision: session.revision + 1, updatedAt: Date.now(),
  });
  return readSelection(explorerSessionId);
}

export function resolveFilters(explorerSessionId, changes = {}, clearFilters = []) {
  const filters = explorerSessionId ? readSelection(explorerSessionId).filters : {};
  for (const field of clearFilters) delete filters[field];
  return { ...filters, ...changes };
}
