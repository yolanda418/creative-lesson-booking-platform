# Creative Lesson Booking Platform

### 琴小助

**Version 1.0 — Live Portfolio Project**

The current production version focuses on violin lesson discovery,
AI-assisted course consultation, trial lesson inquiry, and authorized
student access, while the platform architecture is designed to support
additional music and art course categories such as piano and visual
arts.

![Status](https://img.shields.io/badge/status-V1.0%20Live-brightgreen)
![Stack](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Node.js-blue)
![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash--Lite-orange)
![Deploy](https://img.shields.io/badge/deploy-Vercel-black)

---

## Overview

This repository contains the public-facing pieces of a real-world lesson
booking platform for music and art classes, with **violin as the current
primary implementation** and an **extensible, multi-category course
structure** ready to host additional course categories such as piano
and visual arts.

There are **two intentionally separate entry points**:

| Entry point | Audience | Purpose |
|---|---|---|
| Public website (`web/`) | Anyone visiting the studio | Course discovery, teacher introduction, AI-assisted consultation, trial lesson inquiry |
| WeChat Mini Program (`violin-app/`) | Enrolled students only, authorized by the institution | View lessons, book/cancel slots, receive lesson reminders |

> The Mini Program is **not** a public booking entry point. It is reserved
> for students who have already signed up through the studio's WeChat
> consultant and have been authorized by the institution. This is an
> intentional separation between public discovery and enrolled student
> operations — not missing functionality.

---

## Why This Project

In a small studio, the workflow is naturally split into two phases:

1. **Inquiry & trial** — A prospective student visits the public site,
   browses courses, asks the AI assistant about violin and other
   course categories, then reaches out via WeChat to arrange a trial
   lesson.
2. **Enrolled learning** — After signing up, the institution authorizes
   the student to access the Mini Program, where they manage lessons,
   bookings, and reminders.

Forcing both audiences into a single entry point would either expose
private student data on a public page, or hide the studio from people
who are only curious. This project keeps the two flows separate while
sharing the same brand and the same course knowledge base.

The public demo uses anonymized / sample data to protect instructor and
student privacy. No real teacher background, pricing, schedule, or
student record is exposed.

---

## Key Features

- **Responsive public website** — single-file HTML/CSS/JS, no build step
- **Violin course** as the current primary implementation, with a
  **modular course structure** ready for additional course categories
  such as piano and visual arts
- **Teacher profiles** with intentionally anonymized display names and
  stock music-scene imagery (no real portraits or credentials exposed)
- **Trial lesson inquiry** via WeChat consultant
- **AI Course Assistant** embedded as a chat widget on every page
- **Local keyword fallback** so the assistant is never empty when the
  upstream LLM is unavailable
- **Authorized WeChat Mini Program** with cloud functions for lessons,
  bookings, cancellations, and reminder scheduling
- **Privacy-conscious demo data** — no real names, phone numbers, or
  records of any kind

---

## AI Course Assistant

The assistant answers course-related questions (curriculum, age
recommendations, trial flow, etc.) while refusing to fabricate
sensitive information (teacher background, exact price, schedule,
private contact details).

**Request flow:**

```
Browser
  └─> POST /api/chat
        └─> api/chat.js  (Node.js Serverless Function)
              └─> OpenRouter (OpenAI-compatible API)
                    └─> google/gemini-2.5-flash-lite
                          └─> Response validation / safety filter / fallback
                                └─> { reply: "..." } back to the browser
```

**Key design choices:**

- Uses the official `openai` Node SDK against OpenRouter's
  `https://openrouter.ai/api/v1` base URL
- Production model is fixed to `google/gemini-2.5-flash-lite` for
  consistent, reproducible behavior (overridable via `OPENROUTER_MODEL`
  for local experimentation)
- API key is read from `OPENROUTER_API_KEY` (environment-variable based
  secret handling); never logged, never sent to the browser
- **No chat history is stored** and **no student records are kept** in
  the AI backend — every request is stateless
- Response sanitization is covered by the local `test_sanitize.js`
  regression suite
- If the upstream call fails, returns empty, or contains unsafe
  content, the browser falls back to a local keyword matcher — the
  user is never left without an answer
- The system prompt explicitly forbids the model from inventing
  teacher credentials, prices, schedules, or personal information
- Server logs only `finish_reason`, `model`, and `reply_length` — never
  the raw reply content or the user message

---

## Privacy & Data Design

- The public demo uses **anonymized / sample data only**
- **No** student records are stored in the public website (no database,
  no chat history persisted)
- The WeChat Mini Program stores data only in the institution's own
  WeChat CloudBase (Tencent Cloud) — never on a public server
- The API key is read from environment variables; it is **never**
  included in client-side code, HTML, or README examples
- Public-facing teacher profiles use intentionally anonymized display
  names ("朱老师", "任老师") and stock music-scene imagery; no real
  portraits or credentials are exposed

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Public website | HTML, CSS, vanilla JavaScript (no framework, no build step) |
| Backend API | Node.js, OpenAI Node SDK, OpenRouter |
| AI model | `google/gemini-2.5-flash-lite` via OpenRouter |
| Deployment | Vercel Serverless Function (`api/chat.js`); local dev server (`api/dev-server.js`) |
| WeChat Mini Program | WeChat DevTools, WeChat CloudBase (cloud functions + database) |

---

## Project Structure

```
creative-lesson-booking/
├── api/
│   ├── chat.js              # POST /api/chat — OpenRouter backend
│   └── dev-server.js        # Local dev server (web/ + /api/chat)
├── web/                     # Public website
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── ai-assistant.js      # Chat widget + keyword fallback
│   └── assets/
├── assets/                  # Reserved for shared assets
├── violin-app/              # WeChat Mini Program (authorized students)
│   ├── cloudfunctions/      # 13 serverless functions
│   ├── database/            # Schema documentation
│   ├── miniprogram/         # Front-end pages (student + teacher)
│   └── scripts/             # Local seed/clear scripts (no secrets committed)
├── screenshots/             # Portfolio screenshots (gitignored)
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

> `node_modules/`, `.env`, `project.private.config.json`, root-level
> temporary screenshots, and `web-backup-*/` are intentionally not
> committed.

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env   # macOS / Linux
copy .env.example .env # Windows
```

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash-lite   # default for production
```

> Get an API key from <https://openrouter.ai/keys>. Never commit `.env`.

### 3. Start the local server

```bash
node api/dev-server.js
# or
npm run dev
```

On Windows PowerShell, if `npm` is blocked by the execution policy:

```powershell
node api\dev-server.js
```

### 4. Open the site

```
http://localhost:3000/
```

You should see the AI assistant respond with real LLM output (when the
upstream is available) and a local fallback reply otherwise.

---

## Live Demo

The public website is live on Vercel:

- **Public website (live):** <https://creative-lesson-booking-platform.vercel.app/>
  — course discovery, AI Course Assistant, trial lesson inquiry.
- **AI Course Assistant (live):** embedded in the public website via
  the `POST /api/chat` serverless route; available on every page.
- **WeChat Mini Program:** intended for authorized enrolled students
  only (see [Overview](#overview) for the access separation). It is
  not a public booking entry point and is not linked from the public
  site.

---

## Screenshots

Portfolio screenshots live in `screenshots/` (gitignored). Suggested
coverage:

- Public landing page
- AI Course Assistant in action
- WeChat Mini Program (authorized student view)

---

## Optional Future Enhancements

Version 1.0 is shipped and live. The items below are optional, additive
enhancements that could be explored in later iterations — they are not
required for the current release to be considered complete.

- **Richer AI knowledge base** for additional course categories (piano,
  visual arts) as the studio expands its course catalog
- **Multilingual AI assistant** responses beyond the current Chinese +
  English coverage
- **Optional admin workflow** for the studio (no DB dependency, fits the
  current privacy-first design)
- **Broader course content** — additional teacher profiles, trial flow
  refinements, and curated course descriptions

---

## Disclaimer

Names, images, and course information in this public demo use
anonymized or sample data to protect instructor and student privacy.
Teacher names ("朱老师", "任老师") are intentionally anonymized display
names, and the imagery used on the public site is stock music-scene
photography rather than portraits of real instructors.

---

### 关于中文项目名

琴小助 / Creative Lesson Booking Platform 是一个面向音乐与美术兴趣
课程的预约与学生管理作品集，当前主实现为小提琴课程，平台架构本
身为多类别、可扩展设计，支持后续接入钢琴、视觉艺术等更多课程类
别。公开网页负责课程展示、老师介绍、AI 课程咨询与试听预约；微
信小程序仅向已正式报名、由机构授权的学生开放。公开展示内容均使
用匿名化或示例信息，以保护老师与学生的隐私。
