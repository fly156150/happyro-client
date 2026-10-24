# UI 组件维护

实现位于 `src/UI/GUIComponent.js`、`src/UI/UIManager.js` 和 `src/UI/Elements/`。维护现有窗口时核对所用基类，不把移动端公共布局与桌面 Shadow DOM 组件混为一套。

## 生命周期与状态

- `render()` 提供内部结构；在 `init()` 绑定一次性事件，在 `onAppend()` 恢复状态，在 `onRemove()` 保存偏好并清理本次挂载的监听、计时器和异步操作。
- 从 `getRoot()` 查询 Shadow DOM；元素是否挂载使用 `isConnected`，不能依赖 `closest('body')`。
- `this.ui` 仅用于既有互操作，新业务使用原生 DOM。按需打开的窗口不要在 `init()` 隐藏后遗漏显示步骤。
- 服务端回包及异步资源可能晚于窗口关闭；查询结果判空，重复节点使用 `querySelectorAll`，移除后不重新打开窗口。
- 保留依赖调用方 `this` 的普通函数回调，尤其是纹理与 Canvas 回调，不机械替换成箭头函数。

## 尺寸、可见性与样式

- `:host` 管理外部位置和尺寸，内部根节点管理内容布局。内容决定高度时保留正常布局流；固定全屏窗口明确设置宿主及内部区域大小。
- 显隐时保留原来的 flex/grid 模式，不用 jQuery `.show()` 强制改成 block。仅查看 inline style 不足时使用 `getComputedStyle`。
- Shadow DOM 内样式不作用于 body，也不会自动继承全局组件规则；共享规则放在对应公共样式中。移动元素到 Shadow DOM 外前核对样式归属。
- 浮层位置基于 `getBoundingClientRect()` 和可视视口，不能混用不同祖先的 offset；拖动与吸附仍需核对基类的坐标契约。
- 固定底部元素需要有效的父级高度；自适应窗口避免宿主与内部根节点重复设置不一致的尺寸。
- 游戏界面资源使用 `DBManager.INTERFACE_PATH`，避免复制资源根路径。

## 输入与文本

- 在 Shadow DOM 内绑定需要识别内部目标的事件；跨边界时事件 target 可能指向宿主。
- 优先处理的事件使用捕获阶段；右键显式阻止浏览器菜单，不能依赖 jQuery 的隐式行为。
- 输入组件检查 `shadowRoot.activeElement` 并阻止游戏快捷键接管输入。模态窗口必须阻挡地图交互；宿主禁用 pointer-events 时按实际交互模式恢复子区域事件。
- 程序事件使用 `CustomEvent.detail`，不依赖 jQuery `isTrigger`。共享拖放状态必须同时核对所有生产者和消费者，不能单窗口删除。
- 界面文案引用名称或内容时统一使用直角引号「」，不使用英文双引号或弯双引号；此规范不适用于代码语法及 HTML 属性。
- 普通文字用 `textContent`；RO 颜色控制码走已有 `DB.formatMsgToHtml()` 管线，不直接把任意输入当 HTML。
- `<ui-button>` 不具备原生 button 的默认装饰，需定义背景、对齐和边框；图片元素的属性回调可能先于挂载，初始化应允许这种顺序。
- 程序修改 scrollTop 后按[滚动条说明](scrollbar.md)同步滚动条。移动端尺寸、键盘和触摸规则见[菜单布局](mobile-menu-layout.md)。

## 多版本组件与共享工厂

先阅读组件聚合器中的 `versionInfo`、对应 HTML/CSS 和封包行为，再决定是否抽取公共工厂。每个选项必须对应当前真实版本差异，不引入未使用的兼容开关。

- 保留组件名称、Preferences 键、UIManager 注册和 PACKETVER 映射。
- 每实例可变状态放在工厂闭包内，不能提升为版本之间共享的模块变量。
- 各版本保留薄入口；实际不同的 HTML/CSS 不必强行合并。
- 重构应保持现有 DOM、资源路径、显隐、拖动、右键和键盘行为；功能变更按独立需求处理。

## 验证

执行相关单测，并经 Gateway 检查窗口开合、重复挂载、版本选择、拖动、滚动、输入焦点、资源加载和服务器回包。涉及移动端时覆盖手机横竖屏、平板与软键盘；Canvas 模拟测试不替代真机角色预览。构建与提交检查见[构建与测试](../build-and-test.md)。

## 数量步进组件

`src/UI/Components/QuantityStepper.js` 的 `createQuantityStepper` 返回 `element`、原生 `input` 与 `setBounds({ min, max })`。移动端 NPC 购买和冒险工具发放复用该组件，固定顺序为 −10、−1、输入框、+1、+10。组件自带局部样式，按钮与输入框共用 `--quantity-control-height`（默认跟随 `--panel-control`），页面不再单独覆盖内部尺寸。

调用方传入可访问标签、初始值和整数上下限；用户编辑与步进均发出原生 `input` 事件，兼容菜单键盘编辑器。动态库存通过 `beforeStep` 刷新，返回 `false` 可取消步进；`setBounds` 不修改草稿值，由原生校验提示越界。弹窗、确认、权限、实时业务校验与提交由调用方负责，组件不请求接口、不创建弹窗。

## 移动菜单导航

`src/UI/Mobile/game/MenuNavigation.css` 是菜单页签及顶部返回／关闭按钮的公共外观来源，由 `GameHUDView` 和 `AdventureTools` 在布局样式之后加载。分类栏添加 `menu-tabs`，通过现有 `aria-selected` 或 `aria-pressed` 表达选中状态，页面只负责位置、宽度与排列方向，不再单独定义选中颜色、边框和圆角。

控件高度默认跟随 `--panel-control`；聊天预览通过 `--menu-tab-height` 保留紧凑尺寸。聊天分类保留宽屏纵向和窄竖屏横向布局。顶部动作与底部提交按钮分开管理，不以全局 `button` 规则覆盖业务动作。

顶部返回／关闭按钮及页签底部统一保留 6px 外边距。所有位置的页签均保留完整底边框与整组四角圆角，不再将选中页签底边隐藏，也不在内容区叠加直角连接线。

## 移动弹窗输入

`src/UI/Mobile/game/MobileModalInput.css` 由移动确认弹窗与 `MobileInputEditor` 共用，统一数量步进输入与键盘编辑浮层的字体、颜色、边框及焦点。单行输入高度为 `max(36px, --panel-control)`，数量加减按钮使用同一高度；输入字号统一为 16px。规则限定在移动弹窗内部，避免底层菜单表单覆盖，也不覆盖桌面确认弹窗或其它数量组件。

## 桌面冒险工具按钮

`GameToolsButtons.css` 是桌面冒险工具操作按钮的公共外观层，仅由桌面 `GameTools` 加载。角色表单、分页及确认弹窗按钮为 28px 高，底部操作栏按钮为 24px 高以保留上下空白；共用柔和灰色小圆角外观与悬停／按下／禁用／键盘焦点状态；宽度由页面布局决定，角色按钮跟随输入框列宽。页签、列表项、下拉框、开关和文字链接不使用操作按钮外观。

## 桌面浅色主题

`DesktopLightTheme.css` 集中管理桌面浅色背景、边框、文字、交互色及滚动条，仅由桌面战斗辅助及冒险工具加载。`AutoCombatLight.css` 与 `GameToolsLight.css` 负责各窗口的外观映射；共享业务组件和移动端样式不依赖这些文件。主题层不修改列表比例、角色表单列宽或底栏按钮高度。

桌面浅色窗口须设置 `GUIComponent.nativeScrolling = true`，让浏览器滚动条主题实际生效；否则框架会注入旧 RO 自绘滚动条并将 `overflow-y` 改为 `hidden`。验收须在真实 GUIComponent 窗口检查无 `.ro-custom-scrollbar`，并验证滚轮移动。

## 背包与装备快照

完整背包列表先清空旧背包、已装备索引和装备模型，再按封包重建；装备切换完整列表替换旧配置，空列表也会清空。区分物品许可部位 `location`、实际穿戴部位 `equipped` 和切换配置部位，不能互相代替。

切换预览使用独立副本，不修改真实装备；迟到的图片回调须核对当前配置或预览对象，多部位装备绘制和清理所有匹配格子。转职后的双持权限由服务端刷新，不要求重新登录。跨仓库边界与自动化证据见[装备权限审查](../../../../docs/development/equipment-permission-audit/README.md)。
