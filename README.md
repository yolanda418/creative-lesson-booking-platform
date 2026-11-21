# 琴小助 · Creative Lesson Booking Platform

> 面向音乐与美术兴趣课程的预约与学生管理作品集。

> 🌐 Languages: **中文（当前）** · [English](./README.en.md)

**版本 1.0 — 已上线的作品集项目**

当前正式版本聚焦小提琴课程发现、AI 课程咨询、试听预约与已授权学员的课程管理，
同时平台架构本身按多类别、可扩展设计，支持后续接入钢琴、视觉艺术等更多课程类别。

![Status](https://img.shields.io/badge/status-V1.0%20Live-brightgreen)
![Stack](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Node.js-blue)
![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash--Lite-orange)
![Deploy](https://img.shields.io/badge/deploy-Vercel-black)

---

## 项目概览

本仓库包含一个面向音乐与美术兴趣课程的真实场景预约平台的**公开部分**：
**小提琴是当前的主实现**，平台按**可扩展的多类别课程结构**设计，
可承载钢琴、视觉艺术等更多课程类别。

这里有**两个有意分离的入口**：

| 入口 | 使用对象 | 用途 |
|---|---|---|
| 公开网站（`web/`） | 到访工作室的任何访客 | 课程浏览、老师介绍、AI 课程咨询、试听预约 |
| 微信小程序（`violin-app/`） | 仅限已报名并经机构授权的学员 | 查看课程、预约/取消时段、接收上课提醒 |

> 小程序**不是**公开的预约入口。它只面向已经通过工作室微信课程顾问报名、
> 并获得机构授权的学员。这是公开浏览与在读学员运营之间的有意隔离，
> 并不是功能缺失。

---

## 为什么做这个项目

在一家小型工作室里，业务流程天然分成两个阶段：

1. **咨询与试听** —— 意向学员访问公开网站，浏览课程，向 AI 助手询问小提琴
   及其他课程类别，然后通过微信联系顾问安排试听课。
2. **在读学习** —— 报名之后，机构授权该学员进入小程序，在其中管理课程、
   预约与提醒。

如果把两类使用者强行塞进同一个入口，要么会在公开页面上暴露学员隐私数据，
要么会把工作室对仅仅好奇的人隐藏起来。本项目让两条流程彼此分离，
同时共用同一套品牌形象与同一份课程知识库。

公开演示使用匿名化 / 示例数据，以保护老师与学员的隐私。不暴露任何真实的
老师背景、价格、课表或学员记录。

---

## 核心功能

- **响应式公开网站** —— 单文件 HTML/CSS/JS，无构建步骤
- **小提琴课程**为当前主实现，并采用**模块化课程结构**，可扩展接入
  钢琴、视觉艺术等更多课程类别
- **老师介绍页**，展示名经过刻意匿名化，配图使用通用音乐场景素材
  （不暴露真实肖像与资质信息）
- **试听预约**，通过微信课程顾问对接
- **AI 课程助手**以内嵌聊天组件的形式出现在每个页面
- **本地关键词兜底**，上游 LLM 不可用时助手也不会没有回复
- **需授权的微信小程序**，配套云函数支持课程、预约、取消与提醒调度
- **注重隐私的演示数据** —— 不含任何真实姓名、手机号或记录

---

## AI 课程助手

助手回答课程相关问题（课程体系、适合年龄、试听流程等），
同时拒绝编造敏感信息（老师背景、确切价格、课表、私人联系方式）。

**请求链路：**

```
浏览器
  └─> POST /api/chat
        └─> api/chat.js  (Node.js Serverless Function)
              └─> OpenRouter (OpenAI 兼容 API)
                    └─> google/gemini-2.5-flash-lite
                          └─> 响应校验 / 安全过滤 / 兜底
                                └─> { reply: "..." } 返回浏览器
```

**关键设计取舍：**

- 使用官方 `openai` Node SDK，指向 OpenRouter 的
  `https://openrouter.ai/api/v1` base URL
- 生产环境模型固定为 `google/gemini-2.5-flash-lite`，以保证行为一致、
  结果可复现（本地实验时可通过 `OPENROUTER_MODEL` 覆盖）
- API key 从 `OPENROUTER_API_KEY` 读取（基于环境变量的密钥处理），
  不写日志，也不会下发到浏览器
- **不保存任何聊天记录**，AI 后端**不保存任何学员记录** —— 每次请求都是无状态的
- 响应清洗由本地 `test_sanitize.js` 回归测试覆盖
- 若上游调用失败、返回空内容或包含不安全内容，浏览器会退回本地关键词匹配 ——
  用户永远拿得到回复
- 系统提示词明确禁止模型编造老师资质、价格、课表或个人信息
- 服务端日志只记录 `finish_reason`、`model` 与 `reply_length` —— 不记录原始回复内容与用户消息

---

## 隐私与数据设计

- 公开演示**只使用匿名化 / 示例数据**
- 公开网站**不保存任何学员记录**（无数据库，不持久化聊天记录）
- 微信小程序的数据只存放在机构自有的微信云开发（腾讯云）环境里 —— 不落在任何公开服务器上
- API key 从环境变量读取，**绝不**出现在客户端代码、HTML 或 README 示例中
- 面向公开访问的老师介绍使用刻意匿名化的展示名（"朱老师"、"任老师"）与通用音乐场景配图，
  不暴露真实肖像与资质信息

---

## 技术栈

| 层次 | 技术 |
|---|---|
| 公开网站 | HTML、CSS、原生 JavaScript（无框架，无构建步骤） |
| 后端 API | Node.js、OpenAI Node SDK、OpenRouter |
| AI 模型 | 经 OpenRouter 调用 `google/gemini-2.5-flash-lite` |
| 部署 | Vercel Serverless Function（`api/chat.js`）；本地开发服务器（`api/dev-server.js`） |
| 微信小程序 | 微信开发者工具、微信云开发（云函数 + 数据库） |

---

## 项目结构

```
creative-lesson-booking/
├── api/
│   ├── chat.js              # POST /api/chat —— OpenRouter 后端
│   └── dev-server.js        # 本地开发服务器（web/ + /api/chat）
├── web/                     # 公开网站
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── ai-assistant.js      # 聊天组件 + 关键词兜底
│   └── assets/
├── assets/                  # 预留的共享资源目录
├── violin-app/              # 微信小程序（已授权学员）
│   ├── cloudfunctions/      # 13 个云函数
│   ├── database/            # 数据结构说明
│   ├── miniprogram/         # 前端页面（学员端 + 老师端）
│   └── scripts/             # 本地种子/清理脚本（不提交任何密钥）
├── screenshots/             # 作品集截图（已 gitignore）
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

> `node_modules/`、`.env`、`project.private.config.json`、根目录下的
> 临时截图以及 `web-backup-*/` 均有意不提交。

---

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

把 `.env.example` 复制为 `.env` 并填入自己的值：

```bash
cp .env.example .env   # macOS / Linux
copy .env.example .env # Windows
```

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash-lite   # 生产环境默认值
```

> 到 <https://openrouter.ai/keys> 获取 API key。切勿提交 `.env`。

### 3. 启动本地服务器

```bash
node api/dev-server.js
# 或者
npm run dev
```

在 Windows PowerShell 下，如果 `npm` 被执行策略拦截：

```powershell
node api\\dev-server.js
```

### 4. 打开站点

```
http://localhost:3000/
```

此时 AI 助手在上游可用时应返回真实 LLM 输出，不可用时返回本地兜底回复。

---

## 线上演示

公开网站已部署在 Vercel：

- **公开网站（已上线）：** <https://creative-lesson-booking-platform.vercel.app/>
  —— 课程浏览、AI 课程助手、试听预约。
- **AI 课程助手（已上线）：** 通过 `POST /api/chat` serverless 路由内嵌在公开网站中，
  每个页面都可使用。
- **微信小程序：** 仅面向已授权的在读学员（入口隔离说明见[项目概览](#项目概览)）。
  它不是公开的预约入口，公开站点也不提供其跳转链接。

---

## 截图

作品集截图放在 `screenshots/`（已 gitignore）。建议覆盖：

- 公开落地页
- AI 课程助手实际对话
- 微信小程序（已授权学员视角）

---

## 可选的后续增强

版本 1.0 已交付并上线。下面这些是可选的、增量式的增强方向，
可以在后续迭代中探索 —— 当前版本已算完整，并不依赖它们。

- 为更多课程类别（钢琴、视觉艺术）建立**更丰富的 AI 知识库**，配合工作室课程目录扩充
- **多语言 AI 助手**回复，在当前中文 + 英文之外扩展
- 工作室的**可选管理工作流**（不引入数据库依赖，契合当前的隐私优先设计）
- **更丰富的课程内容** —— 更多老师介绍、试听流程细化、精选课程描述

---

## 免责声明

本公开演示中的姓名、图片与课程信息均使用匿名化或示例数据，
以保护讲师与学员隐私。老师姓名（"朱老师"、"任老师"）是刻意匿名化的展示名，
公开站点使用的图片是通用音乐场景摄影，而非真实讲师的肖像。

---

## AI 辅助说明

编码工作使用了 AI 辅助。