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
- 普通文字用 `textContent`；RO 颜色控制码走已有 `DB.formatMsgToHtml()` 管线，不直接把任意输入当 HTML。
- `<ui-button>` 不具备原生 button 的默认装饰，需定义背景、对齐和边框；图片元素的属性回调可能先于挂载，初始化应允许这种顺序。
- 程序修改 scrollTop 后按[滚动条说明](scrollbar.md)同步滚动条。移动端尺寸、键盘和触摸规则见[菜单布局](../mobile-menu-layout.md)。

## 多版本组件与共享工厂

先阅读组件聚合器中的 `versionInfo`、对应 HTML/CSS 和封包行为，再决定是否抽取公共工厂。每个选项必须对应当前真实版本差异，不引入未使用的兼容开关。

- 保留组件名称、Preferences 键、UIManager 注册和 PACKETVER 映射。
- 每实例可变状态放在工厂闭包内，不能提升为版本之间共享的模块变量。
- 各版本保留薄入口；实际不同的 HTML/CSS 不必强行合并。
- 重构应保持现有 DOM、资源路径、显隐、拖动、右键和键盘行为；功能变更按独立需求处理。

## 验证

执行相关单测，并经 Gateway 检查窗口开合、重复挂载、版本选择、拖动、滚动、输入焦点、资源加载和服务器回包。涉及移动端时覆盖手机横竖屏、平板与软键盘；Canvas 模拟测试不替代真机角色预览。构建与提交检查见[构建与测试](../build-and-test.md)。
