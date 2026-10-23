/** Names emitted by the current server storage protocol. */
export function storageTitle(name) {
 switch (name) {
  case 'Storage': return '仓库';
  case 'Guild Storage': return '公会仓库';
  default: return name;
 }
}
