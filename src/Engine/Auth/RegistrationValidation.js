/** Match HappyRO PACKETVER=20211103: login.cpp defaults and 24-byte login fields. */
const encoder = new TextEncoder();

export function registrationError(username, password) {
	if (!/_[mf]$/i.test(username)) return null;
	const accountLength = encoder.encode(username.slice(0, -2)).length;
	if (accountLength < 6) {
		return '账号最少 6 个字节';
	}
	if (accountLength > 21) {
		return '账号最多 21 个字节';
	}
	const passwordLength = encoder.encode(password).length;
	if (passwordLength < 6) {
		return '密码最少 6 个字节';
	}
	if (passwordLength > 23) {
		return '密码最多 23 个字节';
	}
	return null;
}

// Source: happyro-server/src/login/registration.hpp (PACKETVER=20211103).
const serverErrors = new Map([
	[200, '账号最少 6 个字节'],
	[201, '密码最少 6 个字节'],
	[202, '账号已存在'],
	[203, '注册过于频繁'],
	[204, '账号保存失败'],
	[205, '未开放注册'],
	[206, '不支持当前密码加密方式'],
	[207, '性别后缀无效']
]);
export function registrationServerError(code) {
	return serverErrors.get(code);
}
