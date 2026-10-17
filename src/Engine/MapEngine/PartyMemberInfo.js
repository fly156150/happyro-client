/** Update member metadata without replacing identity, leadership or life state. */
export function updatePartyMemberInfo(party, packet) {
	const member = party.getSocialSnapshot().party.find(member => member.AID === packet.AID);
	if (!member) return;
	party.addPartyMember({ ...member, class_: packet.job, baseLevel: packet.level });
}
