import { z } from 'zod';

const text = z.string().trim().min(1).max(500);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const httpUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
}, 'Use an HTTP(S) URL without embedded credentials');
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
export const sourceSchema = z.object({
  id, name: text, kind: z.enum(['direct', 'licensed-feed', 'forum', 'official']),
  url: httpUrl.nullable().default(null),
  permission: z.enum(['pending', 'granted', 'revoked']).default('pending'),
  allowedUses: z.array(z.enum(['listing-display', 'reference-display', 'summary', 'photos', 'embeddings'])).default([]),
  accessMethod: z.enum(['manual-submission', 'licensed-feed', 'manual-reference']).default('manual-reference'),
  permissionReference: text.nullable().default(null),
  permissionExpiresAt: date.nullable().default(null),
  updaterReference: text.nullable().default(null),
}).strict().superRefine((source, ctx) => {
  if (source.permission === 'granted' && !source.permissionReference) ctx.addIssue({ code: 'custom', path: ['permissionReference'], message: 'Record the permission evidence' });
});
export const projectSchema = z.object({ id, name: text, district: text, aliases: z.array(text).default([]) }).strict();
export const buildingSchema = z.object({
  id, projectId: id, name: text, address: text,
  completed: z.boolean(), completionReference: text.nullable().default(null),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  locationReference: text.nullable().default(null),
}).strict().superRefine((building, ctx) => {
  if (building.completed && !building.completionReference) ctx.addIssue({ code: 'custom', path: ['completionReference'], message: 'Completion needs evidence' });
  if ((building.lat == null) !== (building.lng == null) || (building.lat != null && !building.locationReference)) ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Coordinates need a pair and a checked source' });
});

export const csvColumns = [
  'supplierListingId', 'buildingId', 'title', 'description', 'transaction', 'priceVnd',
  'priceOriginal', 'priceConfirmedAt', 'areaM2', 'areaBasis', 'bedrooms', 'direction',
  'availability', 'availabilityConfirmedAt', 'sourceUpdatedAt', 'sourceUrl',
];
const optionalText = z.preprocess(value => value === '' || value == null ? null : value, text.nullable());
const optionalDate = z.preprocess(value => value === '' || value == null ? null : value, date.nullable());
const number = schema => z.preprocess(value => value === '' || value == null ? null
  : typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value, schema.nullable());
export const listingSchema = z.object({
  supplierListingId: id, buildingId: id, title: text,
  description: z.string().trim().max(3000).default(''),
  transaction: z.literal('resale'),
  priceVnd: number(z.number().int().min(100_000_000).max(1_000_000_000_000)),
  priceOriginal: optionalText, priceConfirmedAt: optionalDate,
  areaM2: number(z.number().positive().max(2000)),
  areaBasis: z.enum(['net', 'gross', 'unknown']),
  bedrooms: number(z.number().int().min(0).max(20)), direction: optionalText,
  availability: z.enum(['available', 'unknown', 'unavailable']),
  availabilityConfirmedAt: optionalDate, sourceUpdatedAt: date,
  sourceUrl: z.preprocess(value => value === '' || value == null ? null : value, httpUrl.nullable()),
}).strict().superRefine((listing, ctx) => {
  if (listing.priceVnd != null && (!listing.priceOriginal || !listing.priceConfirmedAt)) ctx.addIssue({ code: 'custom', path: ['priceVnd'], message: 'Known price needs original expression and confirmation date' });
  if (listing.priceVnd == null && listing.priceConfirmedAt) ctx.addIssue({ code: 'custom', path: ['priceConfirmedAt'], message: 'Cannot confirm a missing price' });
  if (listing.availability === 'available' && !listing.availabilityConfirmedAt) ctx.addIssue({ code: 'custom', path: ['availabilityConfirmedAt'], message: 'Available needs a confirmation date' });
});

// Small strict RFC-4180-style reader: quoted commas/newlines and escaped quotes;
// ambiguous formats are rejected rather than silently repairing a supplier file.
export function parseCsv(input) {
  if (Buffer.byteLength(input) > 2_000_000) throw new Error('CSV exceeds the 2 MB pilot limit');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ''; closed = false; };
  const finishRow = () => { finishField(); if (row.some(value => value !== '')) rows.push(row); row = []; };
  const data = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    if (quoted) {
      if (char === '"' && data[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') finishField();
    else if (char === '\n') finishRow();
    else if (char === '"' && !field && !closed) quoted = true;
    else if (char === '"' || closed || char === '\r') throw new Error('Malformed CSV quoting or line ending');
    else field += char;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length || closed) finishRow();
  const header = rows.shift();
  if (!header || new Set(header).size !== header.length || header.length !== csvColumns.length || csvColumns.some(key => !header.includes(key))) throw new Error(`CSV must contain exactly these columns: ${csvColumns.join(',')}`);
  if (!rows.length || rows.length > 500) throw new Error('Import 1–500 rows per file');
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV row ${index + 2} has ${values.length} cells; expected ${header.length}`);
    return Object.fromEntries(header.map((key, i) => [key, values[i].trim()]));
  });
}
