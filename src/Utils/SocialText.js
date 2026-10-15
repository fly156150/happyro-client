// Fixed-width social packet strings reserve one byte for the terminating NUL.
export const SOCIAL_TEXT_LIMITS = { name: 23, subject: 59, notice: 119, reason: 39 };
const labels = { name: '名称', subject: '公告标题', notice: '公告内容', reason: '原因' };
const encoder = new TextEncoder();
export function validateSocialText(fields) {
	for (const [field, raw] of Object.entries(fields)) {
		const value = String(raw ?? '');
		if (value.includes('\0')) return `${labels[field]}不能包含空字符`;
		if (field === 'name' && !value.trim()) return '请输入名称';
		const limit = SOCIAL_TEXT_LIMITS[field];
		if (encoder.encode(value).length > limit)
			return `${labels[field]}过长（最多 ${limit} 字节，汉字通常占 3 字节）`;
	}
	return '';
}
