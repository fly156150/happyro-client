/** Reasons sent by rAthena in ZC_ACK_TOUSESKILL (PACKETVER 20211103). */
export const skillFailReasons = {
	0: '未通过技能判定，服务端未提供具体原因',
	1: 'SP 不足',
	2: 'HP 不足',
	3: '所需材料不足',
	4: '技能仍在冷却或施放间隔中，请稍后再试',
	5: 'Zeny 不足',
	6: '当前武器类型不符合要求',
	7: '需要红色魔力矿石',
	8: '需要蓝色魔力矿石',
	9: '负重过高，请先减轻负重',
	10: '服务端未提供具体原因',
	11: '当前目标不符合技能要求',
	12: '携带的圣灵药数量已达上限',
	13: '需要圣水',
	14: '需要圣灵药',
	15: '作用范围内已有同类效果',
	16: '需要先使用前置技能',
	17: '缺少协助施法的角色',
	18: '施放方向不符合要求',
	19: '召唤数量已达上限',
	20: '所需召唤物或召唤数量不足',
	21: '没有可使用的复制技能',
	22: '同类技能或状态已经生效',
	23: '当前状态不满足技能条件',
	24: '需要绘画笔',
	25: '需要先骑乘龙',
	26: '当前位置无法施放此技能',
	27: '协助者 SP 不足',
	28: '需要靠近墙壁',
	29: '需要至少 1% 的经验值',
	30: '合唱成员 SP 不足',
	31: '需要先触发武器格挡',
	32: '需要先使用武器涂毒',
	33: '需要乘坐魔导机甲',
	34: '需要装备足够的苦无',
	35: '只能对玩家使用',
	36: '目标体型不符合要求',
	37: '需要装备炮弹',
	40: '需要先启动魔导机甲悬浮',
	43: '需要十字斩首者毒药',
	50: '乘坐魔导机甲时不能使用此技能',
	51: '需要魔法书',
	52: '尚未学会魔法书中的技能，阅读失败并陷入睡眠',
	53: '魔法保存点数不足',
	54: '无法阅读魔法书，请检查阅读技能等级及保存栏位',
	57: '需要先装备手推车',
	60: '没有可释放的保存魔法',
	70: '技能条件不满足',
	71: '所需物品不足',
	72: '缺少指定装备',
	73: '需要在对应连招期间使用',
	74: '气弹数量不足',
	75: '需要先进入爆气状态',
	76: '当前 HP 过高，不满足施放条件',
	77: '需要先进入皇家禁卫队状态',
	78: '需要装备指定类型的武器',
	79: '需要先召唤元素精灵',
	80: '亲密度不足',
	81: '需要切换为攻击模式',
	82: '需要切换为格斗模式',
	83: '距离 NPC 太近，请离开后再试',
	84: '装备的子弹数量不足',
	85: '硬币数量不足',
	86: '需要先学习至少一种灵物交流技能',
	87: '当前地图禁止使用此技能',
	88: '召唤物 SP 不足',
	89: '附近已有同类商店',
	90: '需要装备子弹',
	91: '需要装备箭矢',
	92: '需要先加入队伍',
	93: '只有队长可以使用',
	94: '搭档 SP 不足',
	95: '需要装备武器',
	96: '能量球数量不足',
	97: '需要先触发武器格挡',
	98: '陷阱数量已达上限',
	99: '需要魔法书',
	100: 'AP 不足',
	101: '侍从武器数量不足',
	102: '需要先使用闪耀银河',
	103: '灵魂能量不足',
	104: '护符数量不足',
	105: '需要装备格林机枪或霰弹枪',
	106: '需要装备步枪或左轮手枪',
	107: '需要装备榴弹发射器或步枪',
	108: '需要装备格林机枪或左轮手枪',
	109: '需要装备霰弹枪或榴弹发射器',
	110: '需要装备盾牌',
	111: '目标不在影子空间中',
	112: '未满足技能要求的姿态或环境条件',
	113: '缺少技能要求的前置状态',
	114: '未装备技能要求的弹药'
};

/** Basic skill response subtype 1 is reserved for emotion requests. */
export function isEmotionFailure(pkt) {
	return Boolean(pkt && !pkt.result && pkt.SKID === 1 && pkt.NUM === 1);
}

const emotionFailureReasons = {
	0: '发送表情需要「基础技能」Lv.2，或「新基础技能」Lv.1，请先在技能界面学习。',
	4: '表情发送太快了，请稍后再试。',
	11: '这个表情不能主动发送，请选择其它表情。',
	23: '当前状态不能发送表情，请稍后再试。'
};

/** Keep server-provided quantities and item IDs; never infer an unreported cause. */
export function skillFailMessage(pkt, { skillName, itemName } = {}) {
	if (!pkt || pkt.result) return '';
	if (isEmotionFailure(pkt) && emotionFailureReasons[pkt.cause]) return emotionFailureReasons[pkt.cause];
	let reason = skillFailReasons[pkt.cause];
	if (pkt.cause === 71 || pkt.cause === 72) {
		const item = pkt.itemId ? itemName?.(pkt.itemId) || `物品 #${pkt.itemId}` : '指定物品';
		reason =
			pkt.cause === 72
				? `需要装备「${item}」`
				: `需要「${item}」${pkt.NUM > 0 ? ` ×${pkt.NUM}` : ''}，当前数量不足`;
	} else if ([74, 85, 96, 101, 103, 104].includes(pkt.cause) && pkt.NUM > 0) {
		reason += `（需要 ${pkt.NUM} 个）`;
	} else if (pkt.cause === 20 && pkt.SKID === 5499) {
		reason = '需要先召唤 10 枚同属性护符';
	} else if (pkt.cause === 0 && pkt.SKID === 1) {
		reason = '基础技能等级不足';
	} else if (pkt.cause === 112) {
		reason = requiredStateReasons[pkt.NUM] || reason;
	} else if (pkt.cause === 113 && pkt.NUM > 0) {
		const prerequisite = skillName?.(pkt.NUM);
		if (prerequisite) reason = `需要先获得「${prerequisite}」状态`;
	} else if (pkt.cause === 114) {
		const ammo = Object.entries(ammoNames)
			.filter(([type]) => pkt.NUM & (1 << Number(type)))
			.map(([, name]) => name);
		if (ammo.length) reason = `需要装备${ammo.join('或')}`;
	} else if (pkt.cause === 73 && pkt.NUM > 0) {
		const prerequisite = skillName?.(pkt.NUM);
		if (prerequisite) reason = `需要在「${prerequisite}」的连招期间使用`;
	}

	if (!reason) reason = `服务端返回了未识别的失败原因（${pkt.cause}）`;
	const name = skillName?.(pkt.SKID);
	return `${name ? `「${name}」` : '技能'}使用失败：${reason}。`;
}

// e_require_state in the server skill database.
export const requiredStateReasons = {
	1: '需要先进入隐匿状态',
	2: '需要先骑乘大嘴鸟或龙',
	3: '需要先携带猎鹰',
	4: '需要先装备手推车',
	5: '需要装备盾牌',
	6: '负重过高，无法自然恢复',
	7: '当前无法移动，不能使用此技能',
	8: '需要处于水域、水领域或水遁范围内',
	9: '需要先骑乘龙',
	10: '需要先召唤战狼',
	11: '需要先骑乘战狼',
	12: '需要乘坐魔导机甲',
	13: '需要先召唤元素精灵',
	14: '需要先召唤元素精灵',
	15: '需要先骑乘大嘴鸟',
	16: '需要太阳姿态或宇宙姿态',
	17: '需要月亮姿态或宇宙姿态',
	18: '需要星星姿态或宇宙姿态',
	19: '需要宇宙姿态'
};

// e_ammo_type; the server sends the accepted types as a bitmask.
const ammoNames = {
	1: '箭矢',
	2: '飞刀',
	3: '子弹',
	4: '霰弹',
	5: '榴弹',
	6: '手里剑',
	7: '苦无',
	8: '炮弹',
	9: '投掷物'
};
