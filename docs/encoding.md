# 文本与资源路径编码

编码取决于数据来源；玩家可见文本和资源路径必须分别处理。实现入口为 `src/Utils/CodepageManager.js`，读取方还须核对具体加载器的约定。

## 数据契约

| 数据 | 处理规则 |
| --- | --- |
| GRF 文件名与内部资源查找 | 保留现有路径字节表示；不能为了显示中文，把身体、武器、头饰等资源键当 UI 文本重新解码 |
| Lua 资源名表 | `AccNameTable`、`RobeNameTable`、`JobNameTable` 用于文件名查找，保持查找语义 |
| 玩家可见 DB／Lua 文本 | 按加载器声明的来源编码解码；语言映射由 `detectEncodingByLangtype` 决定，不全局强制 UTF-8 |
| 服务端文本 | `decode(bytes, 'utf-8')` 先尝试 UTF-8；有替换字符时，当前实现固定回退 kRO `windows-949`，不是任意用户字符页 |
| 中文散装表 | 按表的实际 UTF-8 契约读取，例如卡片前缀；不要再次用韩文编码解释已解码字符串 |

## 加载流程

`Client.loadFile`／FileManager 返回原始字节，消费者负责选择文本解码或二进制解析。显示解码集中复用 CodepageManager；资源加载器的字节路径处理不能被统一显示解码替换。

不要使用 `String.fromCharCode` 拼接玩家文本，不对已经解码的 Unicode 再调用 `decodeString`，不绕过来源契约对全部文件直接 `new TextDecoder('utf-8')`。CSV／Base64 等包装先按对应解析器解包，再按正文编码解码，不依据扩展名推断内容。

## 修改与验证

修改编码时同时检查中文显示和真实资源查找：韩文资源路径、中文 NPC／物品名、固定长度网络字段、Lua 身体与附件名。文字正常不证明 SPR／ACT 路径正确，反之亦然。跨仓库资源覆盖见[运行时说明](happyro-runtime.md)，角色分层见[预览](ui/character-preview.md)，NPC 扩展包见[协议](network/npc-name-protocol.md)。
