/** CZ_WHISPER reserves 24 bytes for a UTF-8 name, including its terminator. */
export function privateRecipientError(name) {
	if (!name.trim()) return '请输入角色名';
	if (name.includes('\0')) return '角色名不能包含空字符';
	if (new TextEncoder().encode(name).length > 23)
		return '角色名过长：最多 23 个 UTF-8 字节（纯中文最多 7 个字）';
	return '';
}
