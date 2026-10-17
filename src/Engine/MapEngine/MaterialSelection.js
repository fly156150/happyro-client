import PACKET from '../../Network/PacketStructure.js';

/** Both material conversion and elemental analysis use the versioned selection packet. */
export function createMaterialSelectionPacket({ Type, Action, MaterialList }) {
	const packet = new PACKET.CZ.ITEMLISTWIN_RES();
	packet.Type = Type;
	packet.Action = Action;
	packet.MaterialList = MaterialList;
	return packet;
}
