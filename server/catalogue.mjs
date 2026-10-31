import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sourceSchema, projectSchema, buildingSchema, listingSchema, parseCsv } from './listing-import.mjs';
import { evidenceSourceErrors } from './project-evidence.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const offerId = (sourceId, supplierId) => `listing-${digest(JSON.stringify([sourceId, supplierId])).slice(0, 24)}`;
const day = now => new Date(now).toISOString().slice(0, 10);
const requireNote = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new Error(`${label} is required (1–1000 characters)`);
};

export class Catalogue {
  constructor(path, { now = () => Date.now() } = {}) {
    this.now = now;
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (this.db.prepare('PRAGMA user_version').get().user_version > 2) { this.db.close(); throw new Error('Catalogue schema is newer than this application'); }
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS source (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS project (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS building (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES project(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_run (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), fingerprint TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(source_id, fingerprint));
      CREATE TABLE IF NOT EXISTS review_item (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES import_run(id), row_number INTEGER NOT NULL, offer_id TEXT, data TEXT NOT NULL, errors TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer TEXT, note TEXT);
      CREATE TABLE IF NOT EXISTS listing_offer (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), supplier_id TEXT NOT NULL, data TEXT NOT NULL, published INTEGER NOT NULL, review_id TEXT NOT NULL REFERENCES review_item(id), UNIQUE(source_id, supplier_id));
      CREATE TABLE IF NOT EXISTS listing_observation (id INTEGER PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES listing_offer(id), review_id TEXT NOT NULL UNIQUE REFERENCES review_item(id), observed_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_event (id INTEGER PRIMARY KEY, action TEXT NOT NULL, subject_id TEXT NOT NULL, actor TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence_review (id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL, source_id TEXT NOT NULL REFERENCES source(id), fingerprint TEXT NOT NULL UNIQUE, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer TEXT, note TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS project_evidence (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), data TEXT NOT NULL, review_id TEXT NOT NULL REFERENCES evidence_review(id), published INTEGER NOT NULL);
      PRAGMA user_version = 2;
    `);
  }
  close() { this.db.close(); }
  atomic(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(action, subject, actor, note) {
    this.db.prepare('INSERT INTO audit_event(action, subject_id, actor, note, created_at) VALUES(?,?,?,?,?)').run(action, subject, actor, note, new Date(this.now()).toISOString());
  }
  read(table, id) {
    if (!['source', 'project', 'building'].includes(table)) throw new Error('Invalid registry');
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
    return row ? JSON.parse(row.data) : null;
  }
  registry() {
    return Object.fromEntries(['source', 'project', 'building'].map(table => [table, this.db.prepare(`SELECT data FROM ${table} ORDER BY id`).all().map(row => JSON.parse(row.data))]));
  }
  putSource(input, actor) {
    requireNote(actor, 'Actor');
    const source = sourceSchema.parse(input);
    return this.atomic(() => {
      this.db.prepare('INSERT INTO source(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(source.id, JSON.stringify(source));
      // Revocation/restriction cannot resurrect old offers when a later grant is added.
      if (this.sourceErrors(source).length) this.db.prepare('UPDATE listing_offer SET published=0 WHERE source_id=?').run(source.id);
      if (evidenceSourceErrors(source, this.now()).length) this.db.prepare('UPDATE project_evidence SET published=0 WHERE source_id=?').run(source.id);
      this.audit('source-updated', source.id, actor, `Permission: ${source.permission}`);
      return source;
    });
  }
  putProject(input, actor) {
    requireNote(actor, 'Actor'); const project = projectSchema.parse(input);
    return this.atomic(() => {
      const previous = this.read('project', project.id);
      this.db.prepare('INSERT INTO project(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(project.id, JSON.stringify(project));
      if (previous && JSON.stringify(previous) !== JSON.stringify(project)) {
        for (const row of this.db.prepare('SELECT id,data FROM project_evidence WHERE published=1').all()) {
          if (JSON.parse(row.data).projectId === project.id) this.db.prepare('UPDATE project_evidence SET published=0 WHERE id=?').run(row.id);
        }
        for (const row of this.db.prepare('SELECT id,data FROM listing_offer WHERE published=1').all()) {
          const building = this.read('building', JSON.parse(row.data).buildingId);
          if (building?.projectId === project.id) this.db.prepare('UPDATE listing_offer SET published=0 WHERE id=?').run(row.id);
        }
      }
      this.audit('project-updated', project.id, actor, 'Canonical project record; changed offers require new review');
      return project;
    });
  }
  putBuilding(input, actor) {
    requireNote(actor, 'Actor'); const building = buildingSchema.parse(input);
    if (!this.read('project', building.projectId)) throw new Error('Unknown project');
    // Existing evidence changes require offers to be reviewed again, preventing silent scope/location changes.
    return this.atomic(() => {
      const previous = this.read('building', building.id);
      this.db.prepare('INSERT INTO building(id,project_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,data=excluded.data').run(building.id, building.projectId, JSON.stringify(building));
      if (previous && JSON.stringify(previous) !== JSON.stringify(building)) {
        for (const row of this.db.prepare('SELECT id,data FROM project_evidence WHERE published=1').all()) {
          if (JSON.parse(row.data).buildingId === building.id) this.db.prepare('UPDATE project_evidence SET published=0 WHERE id=?').run(row.id);
        }
        for (const row of this.db.prepare('SELECT id,data FROM listing_offer WHERE published=1').all()) {
          if (JSON.parse(row.data).buildingId === building.id) this.db.prepare('UPDATE listing_offer SET published=0 WHERE id=?').run(row.id);
        }
      }
      this.audit('building-updated', building.id, actor, 'Canonical building evidence; changed offers require new review');
      return building;
    });
  }
  sourceErrors(source) {
    if (!source) return ['Unknown source'];
    const errors = [];
    if (!['direct', 'licensed-feed'].includes(source.kind)) errors.push('Forum/official sources cannot publish listing inventory');
    if (source.permission !== 'granted' || !source.allowedUses.includes('listing-display')) errors.push('Listing display permission is not granted');
    if (!source.permissionReference || !source.updaterReference) errors.push('Permission evidence and an internal updater reference are required');
    if (!['manual-submission', 'licensed-feed'].includes(source.accessMethod)) errors.push('Listing access method is not authorized');
    if (source.permissionExpiresAt && source.permissionExpiresAt < day(this.now())) errors.push('Source permission has expired');
    return errors;
  }
  validationErrors(data, source) {
    const errors = this.sourceErrors(source);
    const building = this.read('building', data.buildingId);
    if (!building?.completed || !building.completionReference) errors.push('A completed building with evidence is required');
    const dates = ['sourceUpdatedAt', 'priceConfirmedAt', 'availabilityConfirmedAt'];
    for (const key of dates) if (data[key] && data[key] > day(this.now())) errors.push(`${key} cannot be in the future`);
    return errors;
  }
  importCsv(sourceId, csv) {
    const source = this.read('source', sourceId);
    if (!source) throw new Error('Register the source before importing');
    const fingerprint = digest(csv);
    const existing = this.db.prepare('SELECT id FROM import_run WHERE source_id=? AND fingerprint=?').get(sourceId, fingerprint);
    if (existing) return { runId: existing.id, reused: true, items: this.reviews(existing.id) };
    const rows = parseCsv(csv);
    const counts = new Map();
    for (const row of rows) counts.set(row.supplierListingId, (counts.get(row.supplierListingId) || 0) + 1);
    return this.atomic(() => {
      const runId = randomUUID();
      this.db.prepare('INSERT INTO import_run VALUES(?,?,?,?)').run(runId, sourceId, fingerprint, new Date(this.now()).toISOString());
      rows.forEach((raw, index) => {
        const parsed = listingSchema.safeParse(raw);
        const errors = parsed.success ? this.validationErrors(parsed.data, source) : parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        if (counts.get(raw.supplierListingId) > 1) errors.push('Duplicate supplierListingId in this import; separate updates into ordered files');
        this.db.prepare('INSERT INTO review_item(id,run_id,row_number,offer_id,data,errors) VALUES(?,?,?,?,?,?)').run(randomUUID(), runId, index + 2,
          parsed.success ? offerId(sourceId, parsed.data.supplierListingId) : null, JSON.stringify(parsed.success ? parsed.data : raw), JSON.stringify(errors));
      });
      return { runId, reused: false, items: this.reviews(runId) };
    });
  }
  reviews(runId) {
    return this.db.prepare('SELECT * FROM review_item WHERE (? IS NULL OR run_id=?) ORDER BY rowid').all(runId ?? null, runId ?? null).map(row => ({
      ...row, data: JSON.parse(row.data), errors: JSON.parse(row.errors),
    }));
  }
  duplicateCandidates(data, excludingId) {
    return this.db.prepare('SELECT id,data FROM listing_offer WHERE id != ? AND published=1').all(excludingId).filter(row => {
      const other = JSON.parse(row.data);
      return other.buildingId === data.buildingId && other.areaM2 != null && data.areaM2 != null
        && Math.abs(other.areaM2 - data.areaM2) < 1 && other.bedrooms === data.bedrooms;
    }).map(row => row.id);
  }
  approve(reviewId, reviewer, note, { acknowledgeDuplicates = false } = {}) {
    requireNote(reviewer, 'Reviewer'); requireNote(note, 'Review note');
    return this.atomic(() => {
      const row = this.db.prepare('SELECT r.*, i.source_id FROM review_item r JOIN import_run i ON i.id=r.run_id WHERE r.id=?').get(reviewId);
      if (!row || row.status !== 'pending') throw new Error('Review item is missing or already decided');
      if (JSON.parse(row.errors).some(error => error.startsWith('Duplicate supplierListingId'))) throw new Error('Resolve duplicate IDs in a corrected CSV before approval');
      const data = listingSchema.parse(JSON.parse(row.data));
      const errors = this.validationErrors(data, this.read('source', row.source_id));
      if (errors.length) throw new Error(errors.join('; '));
      const latest = this.db.prepare('SELECT data FROM listing_offer WHERE id=?').get(row.offer_id);
      if (latest) {
        const old = JSON.parse(latest.data);
        for (const key of ['sourceUpdatedAt', 'priceConfirmedAt', 'availabilityConfirmedAt']) {
          if (old[key] && (!data[key] || data[key] < old[key])) throw new Error(`Update would lose or roll back ${key}; use withdraw for immediate removal`);
        }
      }
      const duplicates = this.duplicateCandidates(data, row.offer_id);
      if (duplicates.length && !acknowledgeDuplicates) throw new Error(`Review potential duplicates first: ${duplicates.join(', ')}. Use --ack-duplicates with a reason after checking.`);
      this.db.prepare(`INSERT INTO listing_offer VALUES(?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,published=1,review_id=excluded.review_id`).run(row.offer_id, row.source_id, data.supplierListingId, JSON.stringify(data), row.id);
      this.db.prepare('INSERT INTO listing_observation(offer_id,review_id,observed_at,data) VALUES(?,?,?,?)').run(row.offer_id, row.id, new Date(this.now()).toISOString(), JSON.stringify(data));
      this.db.prepare("UPDATE review_item SET status='approved',reviewer=?,note=? WHERE id=?").run(reviewer, note, row.id);
      this.audit('offer-approved', row.offer_id, reviewer, note);
      return { id: row.offer_id, duplicateCandidates: duplicates };
    });
  }
  reject(reviewId, reviewer, note) {
    requireNote(reviewer, 'Reviewer'); requireNote(note, 'Review note');
    return this.atomic(() => {
      const result = this.db.prepare("UPDATE review_item SET status='rejected',reviewer=?,note=? WHERE id=? AND status='pending'").run(reviewer, note, reviewId);
      if (!result.changes) throw new Error('Pending review item not found');
      this.audit('offer-rejected', reviewId, reviewer, note);
    });
  }
  withdraw(id, actor, reason) {
    requireNote(actor, 'Actor'); requireNote(reason, 'Withdrawal reason');
    return this.atomic(() => {
      const result = this.db.prepare('UPDATE listing_offer SET published=0 WHERE id=?').run(id);
      if (!result.changes) throw new Error('Listing not found');
      this.db.prepare("UPDATE review_item SET status='rejected', reviewer=?,note=? WHERE offer_id=? AND status='pending'").run(actor, `Withdrawn: ${reason}`, id);
      this.audit('offer-withdrawn', id, actor, reason);
    });
  }
  history(id) {
    return {
      observations: this.db.prepare('SELECT observed_at,data FROM listing_observation WHERE offer_id=? ORDER BY id').all(id).map(row => ({ observedAt: row.observed_at, data: JSON.parse(row.data) })),
      events: this.db.prepare('SELECT action,actor,note,created_at FROM audit_event WHERE subject_id=? ORDER BY id').all(id),
    };
  }
  publicListings() {
    const records = [];
    for (const row of this.db.prepare('SELECT * FROM listing_offer WHERE published=1 ORDER BY id').all()) {
      const source = this.read('source', row.source_id);
      if (this.sourceErrors(source).length) continue;
      const data = JSON.parse(row.data);
      const building = this.read('building', data.buildingId);
      const project = building && this.read('project', building.projectId);
      if (!building?.completed || !project || data.availability === 'unavailable') continue;
      const fresh = value => value && value <= day(this.now()) && this.now() - Date.parse(`${value}T00:00:00Z`) < 7 * 86400000;
      // Explicit projection: internal permission evidence, updater details and raw rows never leave the operator store.
      records.push({
        id: row.id, title: data.title, description: data.description, district: project.district,
        projectId: project.id, project: project.name, buildingId: building.id, building: building.name,
        priceVnd: data.priceVnd, priceConfirmedAt: data.priceConfirmedAt,
        priceStatus: data.priceVnd == null ? 'unknown' : fresh(data.priceConfirmedAt) ? 'confirmed' : 'stale',
        areaM2: data.areaM2, areaBasis: data.areaBasis, bedrooms: data.bedrooms, direction: data.direction,
        lat: building.lat, lng: building.lng, locationPrecision: building.lat == null ? 'unknown' : 'building',
        completed: true, transaction: 'resale',
        availability: data.availability === 'available' && fresh(data.availabilityConfirmedAt) ? 'available' : 'unknown',
        availabilityConfirmedAt: data.availabilityConfirmedAt, checkedAt: data.availabilityConfirmedAt,
        sourceUpdatedAt: data.sourceUpdatedAt, source: source.name, sourceUrl: data.sourceUrl,
        demo: false,
      });
    }
    return records;
  }
}
