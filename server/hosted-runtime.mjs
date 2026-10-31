import { inOperation } from './operation-context.mjs';

export class HostedRuntime {
  constructor(store) { this.store = store; }
  async run(kind, args, action) {
    const id = kind === 'research' ? args.researchSessionId : args.explorerSessionId;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const [row, records] = await Promise.all([
        id ? this.store.load(kind, id) : null,
        kind === 'research' ? this.store.researchRecords() : null,
      ]);
      const original = row ? JSON.stringify(row.state) : null;
      const states = new Map(row ? [[id, structuredClone(row.state)]] : []);
      const result = await inOperation({ sessions: new Map([[kind, states]]), researchRecords: records }, action);
      if (result?.isError) return result;
      let conflict = false;
      for (const [key, state] of states) {
        if (key === id && JSON.stringify(state) === original) continue;
        if (!(await this.store.commit(kind, key, key === id ? row?.version ?? null : null, state))) { conflict = true; break; }
      }
      if (!conflict) return result;
      // Retry pure state operations against the newest version; no response or
      // external side effect is published before the successful database commit.
    }
    throw new Error('Lựa chọn đang được cập nhật ở nơi khác. Hãy thử lại.');
  }
}
