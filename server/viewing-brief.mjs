import { z } from 'zod';
import context from '../data/viewing-context.json' with { type: 'json' };

const day = 86400000;
export const requirementsSchema = z.object({
  maxPriceVnd: z.number().int().positive().max(1e15).optional(),
  minAreaM2: z.number().positive().max(5000).optional(),
  minBedrooms: z.number().int().min(0).max(20).optional(),
  areas: z.array(z.string().trim().min(1).max(100)).min(1).max(10).optional(),
  otherMustHaves: z.array(z.string().trim().min(1).max(200)).min(1).max(10).optional(),
}).strict();
export const requirementFields = {
  requirements: requirementsSchema.optional().describe('Only explicit must-haves already stated by the user. These are brief context, never source-search filters or verified matches. Unchanged fields carry forward.'),
  clearRequirements: z.array(z.enum(Object.keys(requirementsSchema.shape))).max(5).optional().describe('Clear only requirements the user explicitly asks to remove.'),
};
export function mergeRequirements(previous = {}, changes = {}, clear = []) {
  const result = { ...requirementsSchema.parse(previous) };
  for (const key of clear) { if (!(key in requirementsSchema.shape)) throw new Error('Invalid requirement'); delete result[key]; }
  return requirementsSchema.parse({ ...result, ...requirementsSchema.parse(changes) });
}
const factSchema = z.object({
  id: z.string(), topic: z.enum(['identity', 'completion', 'parking', 'operations']), text: z.string(),
  scope: z.enum(['project', 'building']), buildingId: z.string().nullable(),
  url: z.string().url(), publisher: z.string(), authorType: z.string(), publishedAt: z.string().nullable(),
  effectivePeriod: z.string().nullable(), timeBasis: z.enum(['historical', 'undated', 'announced-period']),
  checkedAt: z.string(), reviewDueAt: z.string(), locator: z.string(), limitation: z.string(),
}).strict();
const checkSchema = z.object({ key: z.string(), label: z.string(), status: z.enum(['unknown', 'supported', 'conflict']), detail: z.string() }).strict();
export const briefSchema = z.object({
  generatedAt: z.string(), requirements: requirementsSchema,
  items: z.array(z.object({
    leadId: z.string(), label: z.string(), sourceUrl: z.string().url(),
    action: z.enum(['ask-first', 'consider-viewing', 'set-aside']), actionLabel: z.string(), reason: z.string(),
    association: z.enum(['unresolved', 'tentative-project', 'project', 'building']), associationLabel: z.string(),
    keyFinding: z.string(), biggestGap: z.string(), checks: z.array(checkSchema), context: z.array(factSchema),
    questions: z.array(z.object({ question: z.string(), why: z.string() }).strict()).max(3),
  }).strict()).min(1).max(3),
}).strict();

// Only current-revision server-side reviews can select a family. Never infer it
// from a title, model-supplied slug, similar price, or a neighbouring building.
export function buildViewingBrief(leads, requirements = {}, reviews = new Map(), clock = Date.now(), bundle = context) {
  requirements = requirementsSchema.parse(requirements);
  const items = leads.map(lead => {
    const review = reviews.get(lead.id);
    const family = bundle.projects.find(project => project.id === review?.project_id);
    const validReview = family && ['tentative-project', 'project', 'building'].includes(review.match_level) &&
      (review.match_level === 'building' ? family.buildingIds.includes(review.building_id) : review.building_id === null) && Date.parse(review.reviewed_at) <= clock && Date.parse(review.review_due_at) > clock;
    const exact = validReview && review.match_level === 'building' && family.buildingIds.includes(review.building_id);
    const association = !validReview ? 'unresolved' : exact ? 'building' : review.match_level === 'project' ? 'project' : 'tentative-project';
    const notes = validReview ? family.notes.filter(note => Date.parse(note.checkedAt) <= clock && Date.parse(note.reviewDueAt) > clock &&
      (note.scope === 'project' || (exact && note.buildingId === review.building_id))).map(note => factSchema.parse(note)) : [];
    const associationLabel = association === 'unresolved' ? 'Chưa có đối chiếu dự án cho phiên bản tin này.' :
      association === 'tentative-project' ? `Có thể liên quan ${family.label}; chưa xác nhận đúng dự án hoặc tòa.` :
      association === 'project' ? `Đã đối chiếu dự án ${family.label}; chưa xác nhận đúng tòa.` : `Đã đối chiếu tòa ${review.building_id} thuộc ${family.label}.`;
    const checks = [], questions = [];
    const add = (key, label, status, detail) => checks.push({ key, label, status, detail });
    const ask = (question, why) => questions.push({ question, why });
    add('identity', 'Đúng dự án và tòa', exact ? 'supported' : 'unknown', associationLabel);
    if (!exact) ask('Căn này thuộc chính xác dự án, tòa và địa chỉ nào? Anh/chị gửi giúp ảnh tên tòa hoặc tài liệu ghi địa chỉ căn.', 'Tên trong tin chưa đủ để gắn tài liệu của một tòa với căn đang xem.');
    const conflicts = [];
    const fresh = Number.isFinite(Date.parse(lead.collectedAt)) && Date.parse(lead.collectedAt) <= clock && Date.parse(lead.collectedAt) >= clock - 3 * day && Date.parse(lead.expiresAt) > clock && lead.sourceStatus !== 'source-expired' && lead.quality?.state !== 'archive';
    const quantities = fresh && lead.quality?.advertisedPriceVnd != null && lead.quality?.advertisedAreaM2 != null &&
      !lead.risks.some(risk => ['area-discrepancy', 'quantity-context-unresolved', 'price-unresolved', 'rate-not-total', 'area-unit-unresolved', 'project-label-conflict'].includes(risk));
    for (const [key, label, value, ok, describe] of [
      ['maxPriceVnd', 'Ngân sách tối đa', lead.quality?.advertisedPriceVnd, (v, r) => v <= r, v => `${new Intl.NumberFormat('vi-VN').format(v)} VND giá chào theo nguồn`],
      ['minAreaM2', 'Diện tích tối thiểu', lead.quality?.advertisedAreaM2, (v, r) => v >= r, v => `${v} m² theo nguồn; cần kiểm tra cách tính diện tích`],
    ]) {
      if (requirements[key] === undefined) continue;
      // An area basis has not been reviewed by the current source-assessment
      // contract, so even a coherent m² value cannot establish usable area fit.
      const known = quantities && key !== 'minAreaM2';
      const status = !known ? 'unknown' : ok(value, requirements[key]) ? 'supported' : 'conflict';
      add(key, label, status, known ? describe(value) : 'Chưa có thông số cùng căn và cách tính đã đối chiếu để kiểm tra yêu cầu này.');
      if (status === 'conflict') conflicts.push(label);
    }
    for (const [key, label] of [['minBedrooms', 'Số phòng ngủ tối thiểu'], ['areas', 'Khu vực chấp nhận'], ['otherMustHaves', 'Điều kiện bắt buộc khác']]) {
      if (requirements[key] !== undefined) add(key, label, 'unknown', 'Chưa có bằng chứng cùng căn đã đối chiếu cho yêu cầu này.');
    }
    if (!Object.keys(requirements).length) add('requirements', 'Yêu cầu của bạn', 'unknown', 'Chưa gắn yêu cầu từ cuộc trò chuyện. Bạn vẫn có thể xem thông tin và câu hỏi bên dưới.');
    const unresolvedFit = checks.some(check => check.key !== 'identity' && check.status === 'unknown');
    if (unresolvedFit || lead.risks.some(risk => ['area-discrepancy', 'quantity-context-unresolved', 'room-layout-uncertain', 'rate-not-total'].includes(risk))) {
      ask('Anh/chị xác nhận tổng giá chào, diện tích thông thủy trên giấy tờ và số phòng ngủ hiện có của đúng căn này? Nếu tin ghi khác nhau, con số nào đúng?', 'Biểu thức nguồn có thể mâu thuẫn, là đơn giá hoặc phương án sửa; chưa đủ để kiểm tra các điều kiện bắt buộc.');
    }
    const availability = fresh && lead.quality?.availabilityConfirmed === true && Date.parse(lead.quality.supplierConfirmedAt) <= clock && Date.parse(lead.quality.supplierConfirmedAt) >= clock - 7 * day;
    add('availability', 'Còn bán', availability ? 'supported' : 'unknown', availability ? `Chủ nhà/đơn vị được ủy quyền báo còn bán lúc ${lead.quality.supplierConfirmedAt}; không phải kiểm chứng độc lập.` : 'Chưa có xác nhận còn bán từ chủ nhà/đơn vị được ủy quyền trong 7 ngày. Đọc lại tin không xác nhận còn bán.');
    const completion = exact && notes.some(note => note.scope === 'building' && note.topic === 'completion');
    add('completion', 'Hoàn thành / bàn giao đúng tòa', completion ? 'supported' : 'unknown', completion ? 'Có nguồn về tình trạng sử dụng của đúng tòa; xem ngày và giới hạn bên dưới. Không chứng nhận nghiệm thu hay pháp lý căn.' : 'Chưa có bằng chứng bàn giao gắn với đúng tòa của căn này. Thông tin cấp dự án không thay thế.');
    add('fees', 'Phí sinh hoạt và chỗ đỗ xe hiện tại', 'unknown', 'Chưa có biểu phí hiện hành có ngày áp dụng hoặc xác nhận quyền/chỗ đỗ xe. Không dùng giá mời thầu hay mô tả cũ làm phí cư dân.');
    if (questions.length < 3) ask('Căn còn bán và có thể xem khi nào? Anh/chị gửi biểu phí quản lý, phí và điều kiện chỗ đỗ xe đang áp dụng, cùng thông tin bàn giao đúng tòa.', 'Cần xác nhận tình trạng hiện tại; mô tả dự án hoặc tài liệu lịch sử không thay thế xác nhận của căn.');
    const ready = exact && completion && availability && !unresolvedFit && !conflicts.length && !lead.risks.some(risk => !['source-date-semantics-unresolved'].includes(risk));
    const action = conflicts.length ? 'set-aside' : ready ? 'consider-viewing' : 'ask-first';
    const biggestGap = checks.find(check => check.status === 'conflict')?.detail ?? checks.find(check => check.status === 'unknown')?.detail ?? 'Cần tự đối chiếu giấy tờ và tình trạng thực tế khi xem nhà.';
    const keyFinding = notes[0]?.text ?? 'Chưa có tài liệu dự án đã đối chiếu cho phiên bản tin này. Các thông số trong tin vẫn là lời rao chưa xác minh.';
    return { leadId: lead.id, label: lead.label, sourceUrl: lead.sourceUrl, action,
      actionLabel: action === 'set-aside' ? 'Tạm gác' : action === 'consider-viewing' ? 'Có thể cân nhắc đi xem' : 'Hỏi rõ trước',
      reason: conflicts.length ? `Thông số đã đối chiếu theo nguồn mâu thuẫn điều kiện bắt buộc: ${conflicts.join(', ')}. Giữ nguyên yêu cầu của bạn.` : ready ? 'Đã có nhận dạng tòa, thông tin cho yêu cầu đã ghi nhận và xác nhận còn bán gần đây. Vẫn cần kiểm tra thực tế và giấy tờ.' : 'Còn thiếu hoặc mâu thuẫn bằng chứng quan trọng; hỏi rõ trước khi sắp xếp đi xem.',
      association, associationLabel, keyFinding, biggestGap, checks, context: notes, questions: questions.slice(0, 3) };
  });
  return briefSchema.parse({ generatedAt: new Date(clock).toISOString(), requirements, items });
}
