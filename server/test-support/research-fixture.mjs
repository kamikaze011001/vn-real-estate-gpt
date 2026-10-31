import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fingerprint } from '../research-links.mjs';

export function researchFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'hanoi-research-'));
  const dbPath = join(dir, 'crawl.sqlite'), manifestPath = join(dir, 'links.json');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE item(id TEXT PRIMARY KEY, source_id TEXT, data TEXT, last_seen_at TEXT, expires_at TEXT)');
  const manifest = { version: 1, scope: 'research-source-links', curatedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', entries: [] };
  for (let i = 1; i <= 3; i++) {
    const id = `otofun:${i}:post-${i}`, data = JSON.stringify({ title: i === 3 ? 'Hết hạn TEST ONLY' : 'TEST ONLY', text: 'PRIVATE BODY SECRET phone CONTACT SECRET', author: 'PRIVATE AUTHOR SECRET', format: 'public-post', post_role: 'opening-ad', date_extraction_version: 2, source_url: `https://www.otofun.net.vn/threads/test.${i}/#post-${i}`, posted_at: '2026-01-01', source_edited_at: '2026-01-02T00:00:00Z' });
    db.prepare('INSERT INTO item VALUES(?,?,?,?,?)').run(id, 'otofun', data, '2026-01-03T00:00:00Z', '2099-01-01T00:00:00Z');
    manifest.entries.push({ sourceItemId: id, fingerprint: fingerprint(data), label: `TEST ONLY Mỹ Đình ${i}`, priceExpressions: [{ raw: '78 triệu', basis: 'per_m2', uncertain: false }], areaExpressions: ['68.68 m2'], bedroomExpressions: ['2 phòng ngủ'], risks: ['rate-not-total'] });
  }
  const save = () => writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
  save();
  return { dir, db, dbPath, manifestPath, manifest, save, cleanup() { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

