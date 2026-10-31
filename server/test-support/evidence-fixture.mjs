export const forumSource = {
  id: 'test-forum', name: 'TEST ONLY · Forum', kind: 'forum', url: 'https://forum.example.test/',
  permission: 'granted', allowedUses: ['reference-display', 'summary'], accessMethod: 'manual-reference',
  permissionReference: 'private-source-permission-test',
};
export const officialSource = {
  ...forumSource, id: 'test-authority', kind: 'official', name: 'TEST ONLY · Authority', url: 'https://authority.example.test/',
};
export function evidenceRecord(date = '2026-10-25', changes = {}) {
  return {
    sourceId: 'test-forum', sourceRecordId: 'thread-a-post-123', projectId: 'test-project', buildingId: 'test-building',
    kind: 'community', topic: 'parking', verification: 'unverified',
    summary: 'TEST ONLY · A synthetic account raises a parking question.',
    question: 'TEST ONLY · Check parking allocation directly with management.',
    sourceScope: 'TEST ONLY · Source scope to be checked against the building/project', reportingPeriod: null,
    sourceUrl: 'https://forum.example.test/thread-a#post-123', sourceLocator: 'Post 123',
    sourcePublishedAt: date, checkedAt: date, reviewDueAt: date,
    permissionReference: 'private-item-permission-test', ...changes,
  };
}
