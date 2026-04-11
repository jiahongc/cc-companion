# CC Companion

<p align="center">
  <img src="assets/icon_1024.png" alt="CC Companion 图标" width="80">
</p>

实时监控 Claude Code 会话的桌面小工具，基于 Electron 构建。

CC Companion 是一个轻量的置顶悬浮窗，停靠在屏幕顶部，帮你一目了然地掌握机器上所有 Claude Code 实例的状态——项目名称、工作还是空闲、CPU 和内存占用、Token 消耗、对话轮数，以及各状态的持续时长。

<div align="center">

https://github.com/user-attachments/assets/df42aecd-d983-4839-9bad-8368281be0e0

</div>

<table>
  <tr>
    <td><img src="assets/screenshots/light-mode.png" alt="浅色模式" width="300"></td>
    <td><img src="assets/screenshots/light-working.png" alt="浅色工作中" width="300"></td>
    <td><img src="assets/screenshots/settings-dark.png" alt="设置面板" width="300"></td>
  </tr>
  <tr>
    <td align="center"><em>浅色模式</em></td>
    <td align="center"><em>工作中</em></td>
    <td align="center"><em>设置 + 详情</em></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/detail-dark.png" alt="深色模式详情" width="300"></td>
    <td><img src="assets/screenshots/session-history.png" alt="会话历史" width="300"></td>
    <td></td>
  </tr>
  <tr>
    <td align="center"><em>深色模式详情面板</em></td>
    <td align="center"><em>会话历史</em></td>
    <td></td>
  </tr>
</table>

## 功能

### Claude Code 实例追踪
- 自动发现所有 Claude Code 进程，自动过滤 Claude 桌面应用和子代理
- 每个实例一张磁贴，展示项目名、模型、状态和上下文用量
- **会话分析**：对话轮数、输入/输出 Token、上下文用量、模型名——直接读取 Claude 会话文件，无需额外配置
- **会话计时**：详情面板显示启动时间（跨天会带日期）和总耗时
- **防闪烁**：3 秒宽限期，避免工具调用间的短暂停顿造成状态来回跳动
- **智能计时**：每轮新对话自动重置计时器，快速来回交互不会累计之前的时长
- 2 列网格排列，超过 6 个自动滚动
- **重命名** —— 右键磁贴自定义名称，同一项目跑多个实例时很实用
- **关闭实例** —— 右键磁贴确认后终止会话（终端标签页不受影响）
- 点击磁贴直接聚焦对应终端窗口——支持 Terminal.app、iTerm2、Ghostty、WezTerm、kitty、Cursor、VS Code（详见[终端支持](#终端支持)）
- 拖拽磁贴自由排序

### 会话历史
- **历史面板**（⏳）—— 浏览最近 50 条 Claude Code 会话，跨所有项目
- 显示项目名、首条消息、对话轮数和相对时间
- **一键恢复** —— 在对应项目目录打开新终端并执行 `claude --resume`
- 数据来自 `~/.claude/history.jsonl`，纯本地读取

### 设置面板
点击齿轮按钮弹出设置窗口（所有配置自动保存）：
- **主题** —— 深色 / 浅色切换
- **工作计时** —— 活跃实例显示已工作时长
- **空闲计时** —— 空闲实例显示已等待时长
- **透明度** —— 背景透明度三档（浅 80% / 中 90% / 满 100%），不影响文字清晰度

### 实例详情
点击磁贴上的 `ⓘ` 查看完整信息：
- 启动时间与总耗时
- 模型、Git 分支
- 上下文使用百分比
- 输入 / 输出 / 缓存 Token 数
- CPU、内存占用
- 工作目录

### 控制栏
- **设置**（⚙）—— 打开设置面板
- **历史**（⏳）—— 浏览和恢复历史会话
- **居中**（⊙）—— 吸附到屏幕顶部正中
- **最小化**（−）—— 收起到 Dock（原生 macOS 动画）
- **退出**（✕）—— 关闭应用
- 所有按钮均有悬停提示

## 快速开始

### 从源码运行（推荐）

```bash
git clone https://github.com/jiahongc/cc-companion.git
cd cc-companion
npm install
npm start
```

需要 [Node.js](https://nodejs.org/) v18+。

### DMG 安装

在 [Releases](https://github.com/jiahongc/cc-companion/releases) 页面下载预构建 DMG。应用未签名，macOS 首次打开会拦截。拖入"应用程序"后执行：

```
xattr -cr /Applications/CC\ Companion.app
```

## 项目结构

```
cc-companion/
├── electron/
│   ├── main.js          # 主进程：IPC、窗口管理
│   ├── preload.js       # Context Bridge API
│   └── watcher.js       # 进程检测与会话分析
├── src/
│   ├── compact.html     # 灵动岛窗口
│   ├── compact.css      # 灵动岛样式
│   └── compact.js       # 灵动岛渲染逻辑
├── test/
│   └── watcher.test.js  # 61 个测试
├── assets/
│   ├── icon_1024.png    # 应用图标源文件
│   ├── icon.icns        # macOS 图标
│   └── iconTemplate.png # 托盘图标
└── package.json
```

## 工作原理

### 进程检测
监视器每 2 秒调用 `ps` 扫描 Claude CLI 进程（不区分大小写），过滤 Claude 桌面应用、辅助进程、子代理和系统二进制。通过 `lsof -d cwd` 获取每个进程的工作目录，从而识别项目名。异步初始化阶段有防重复机制。

**活动检测**采用多信号 + 分层过期策略：

1. **JSONL 状态（首选信号）** —— 读取会话 JSONL 最后一条记录判断真实状态。`end_turn`、`system`、`file-history-snapshot` 直接视为空闲；活跃记录按类型设定过期阈值：

   | 记录类型 | 过期时间 | 说明 |
   |---------|---------|------|
   | `assistant(null)` | 10 秒 | 流式输出应持续进行，10 秒无动静视为中断 |
   | `assistant(tool_use)` | 5 分钟 | 工具执行（编译、浏览器等）耗时长 |
   | `progress` | 5 分钟 | 子代理长时间运行 |
   | `user` | 2 分钟 | Claude 应在 2 分钟内开始回复 |
   | `queue-operation` | 30 秒 | 队列通知，预期很快完成 |
   | `result` | 30 秒 | 工具输出，Claude 应迅速接手 |

2. **CPU 兜底** —— 超过过期阈值后，若 CPU ≥ 5% 仍视为活跃。新进程还没有 JSONL 文件时也用此方式判断。

3. **空闲宽限期** —— 活跃 → 空闲的转换需等待 3 秒（连续 2 次轮询确认），避免工具调用间隙的界面闪烁。

4. **对话感知计时** —— 检测到新用户轮次（空闲→活跃且轮数增加）时自动重置工作计时器，快速对话不会累计之前的时长。

所有状态转换都记录时间戳，用于计算持续时长。

### 会话分析
每个实例读取两个文件：
- `~/.claude/sessions/{pid}.json` —— 会话 ID 和启动时间
- `~/.claude/projects/{project-key}/{session-id}.jsonl` —— 对话日志

从 JSONL 提取：
- **对话轮数** —— 仅统计用户真实提问（排除工具调用结果）
- **Token 用量** —— 输入、输出、缓存读取、缓存创建
- **上下文 Token** —— 当前上下文窗口填充量（取最后一条记录的输入 + 缓存读取 + 缓存创建）
- **模型** —— 当前 Claude 模型
- **Git 分支** —— 当前分支名

每 5 秒刷新一次，数据无变化时不推送更新（快照去重）。

## 终端支持

点击实例磁贴会将对应终端标签页置前。聚焦方式因终端而异：

| 终端 | 机制 | 说明 |
|---|---|---|
| Terminal.app | 原生 AppleScript，按 TTY 匹配 | 开箱即用 |
| iTerm2 | 原生 AppleScript，按 TTY 匹配 | 开箱即用 |
| Ghostty | 原生 AppleScript，按 CWD 匹配 | 开箱即用 |
| WezTerm | `wezterm cli activate-pane`，按 CWD 匹配 | 开箱即用，使用 `wezterm` CLI |
| kitty | `kitty @ focus-tab`，按 CWD 匹配 | 需要在 `kitty.conf` 中开启 `allow_remote_control yes` 并配置 `listen_on` |
| Cursor / VS Code | System Events，按窗口标题匹配 | 窗口标题默认包含项目名，可用 |
| Warp、Alacritty、Hyper、Rio、Tabby | System Events 兜底 | 尽力而为——至少会把应用带到前台 |

## 测试

```bash
npm test          # 运行全部 64 个测试
npm run test:watch  # 监听模式
```

测试覆盖：活动检测、状态转换、空闲宽限期、计时器重置、`/clear` 后会话重置、模型切换、Token 计数、快照去重、防重复创建、格式化工具函数。

## 构建

打包为 `.dmg`：

```bash
npm run build:mac
```

产物在 `dist/` 目录。

## 安全与隐私

- **纯本地** —— 不发送任何数据、不发起网络请求、无遥测、无分析
- **只读** —— 只读取 `~/.claude/sessions/` 和 `~/.claude/projects/` 下的会话文件，绝不写入或修改
- **无密钥** —— 不接触 API 密钥或凭证，只读取进程元数据和对话结构
- **进程隔离** —— `contextIsolation: true`、`nodeIntegration: false`，渲染进程通过受限预加载 API 通信
- **开源** —— 可直接查看源码，运行前自行审计

## 参与贡献

1. Fork 本仓库
2. 新建分支（`git checkout -b feature/my-feature`）
3. 提交改动（`git commit -am 'Add my feature'`）
4. 推送分支（`git push origin feature/my-feature`）
5. 发起 Pull Request

## 许可证

MIT
