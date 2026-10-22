export const MAIL_TEXT_LIMITS = { recipient: 23, title: 39, body: 499 };
const bytes = value => new TextEncoder().encode(value).length;
export function validateMailRecipient(name) {
	return !name.trim() || /[\0\t\r\n]/.test(name) || bytes(name) > MAIL_TEXT_LIMITS.recipient
		? '收件人角色名无效（最多 23 字节）'
		: '';
}
export function validateMailContent(title, body) {
	if (!title.trim()) return '请输入邮件标题';
	if (/[\0]/.test(title + body)) return '邮件内容不能包含空字符';
	if (bytes(title) > MAIL_TEXT_LIMITS.title || bytes(body) > MAIL_TEXT_LIMITS.body)
		return '标题最多 39 字节，正文最多 499 字节（汉字通常占 3 字节）';
	return '';
}
