import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';

const pending = new Map();
let nextId = 0;
export const EQUIPMENT_BATCH_SIZE = 100;

onConnectionEnd(() => {
 for (const request of [...pending.values()]) request.finish(new Error('游戏连接已断开'));
});

function requestBatch(position, items, signal) {
 if (signal?.aborted) return Promise.reject(new Error('查询已取消'));
 if (pending.size >= 8) return Promise.reject(new Error('查询过于频繁'));
 const packet = new PACKET.CZ.HAPPYRO_EQUIPMENT_AVAILABILITY();
 do { nextId = (nextId + 1) >>> 0; } while (pending.has(nextId));
 packet.requestId = nextId;
 packet.position = position;
 packet.items = items;
 return new Promise((resolve, reject) => {
  const abort = () => finish(new Error('查询已取消'));
  const timer = setTimeout(() => finish(new Error('查询超时')), 5000);
  function finish(error, result) {
   if (!pending.delete(packet.requestId)) return;
   clearTimeout(timer);
   signal?.removeEventListener('abort', abort);
   if (error) reject(error); else resolve(result);
  }
  pending.set(packet.requestId, { count: items.length, finish });
  signal?.addEventListener('abort', abort, { once: true });
  try {
   if (Network.sendPacket(packet) === false) throw new Error('游戏连接已断开');
  } catch (error) { finish(error); }
 });
}

export async function requestEquipmentAvailability(position, items, signal) {
 const available = [];
 let blocked = false;
 for (let offset = 0; offset < items.length; offset += EQUIPMENT_BATCH_SIZE) {
  const result = await requestBatch(position, items.slice(offset, offset + EQUIPMENT_BATCH_SIZE), signal);
  available.push(...result.available);
  blocked ||= result.blocked;
 }
 return { available, blocked };
}

export function handleEquipmentAvailability(packet) {
 const request = pending.get(packet.requestId);
 if (!request) return false;
 if (packet.available.length !== request.count) {
  request.finish(new Error('装备查询结果不完整'));
  return false;
 }
 request.finish(null, { available: packet.available, blocked: packet.blocked });
 return true;
}
