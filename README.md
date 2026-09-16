# Creative Lesson Booking Platform

### 琴小助

A portfolio project that explores how a small music and art studio can
combine a **public marketing website** with an **authorized WeChat Mini
Program**, and use an **LLM-powered course assistant** to answer common
inquiries without exposing private student data.

![Status](https://img.shields.io/badge/status-portfolio-lightgrey)
![Stack](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Node.js-blue)
![Backend](https://img.shields.io/badge/AI-OpenRouter-orange)

---

## Overview

This repository contains the public-facing pieces of a real-world lesson
booking platform for music (violin, piano — preparing) and art
(preparing) classes.

There are **two intentionally separate entry points**:

| Entry point | Audience | Purpose |
|---|---|---|
| Public website (`web/`) | Anyone visiting the studio | Course discovery, teacher introduction, AI-assisted consultation, trial lesson inquiry |
| WeChat Mini Program (`violin-app/`) | Enrolled students only, authorized by the institution | View lessons, book/cancel slots, receive lesson reminders |

> The Mini Program is **not** a public booking entry point. It is reserved
> for students who have already signed up through the studio's WeChat
> consultant and have been authorized by the institution.

---

## Why This Project

In a small studio, the workflow is naturally split into two phases:

1. **Inquiry & trial** — A prospective student visits the public site,
   browses courses, asks the AI assistant about violin / piano / art
   classes, then reaches out via WeChat to arrange a trial lesson.
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
- **Violin course** is the main offering, with **piano and art**
  prepared as expansion-ready sections
- **Teacher profiles** with placeholders for future updates
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
                    └─> LLM response
                          └─> { reply: "..." } back to the browser
```

**Key design choices:**

- Uses the official `openai` Node SDK against OpenRouter's
  `https://openrouter.ai/api/v1` base URL
- Model is configurable via `OPENROUTER_MODEL` (default:
  `openrouter/free`)
- API key is read from `OPENROUTER_API_KEY`; never logged, never sent
  to the browser
- If the upstream call fails or the reply is empty, the browser falls
  back to a local keyword matcher — the user is never left without an
  answer
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
- Public-facing teacher profiles use placeholder names ("朱老师", "任老师")
  and stock music-scene imagery; no real portraits or credentials are
  exposed

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Public website | HTML, CSS, vanilla JavaScript (no framework, no build step) |
| Backend API | Node.js, OpenAI Node SDK, OpenRouter |
| Deployment | Vercel-ready Serverless Function (`api/chat.js`); local dev server (`api/dev-server.js`) |
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
├── assets/                  # Reserved for shared assets (currently empty)
├── violin-app/              # WeChat Mini Program (authorized students)
│   ├── cloudfunctions/      # 13 serverless functions
│   ├── database/            # Schema documentation
│   ├── miniprogram/         # Front-end pages (student + teacher)
│   └── scripts/             # Local seed/clear scripts (no secrets committed)
├── screenshots/             # Reserved for portfolio screenshots
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
OPENROUTER_MODEL=openrouter/free   # optional, defaults to openrouter/free
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

> Coming soon — pending Vercel deployment of the public website.

---

## Screenshots

Reserved for portfolio screenshots:

- Public landing page
- AI Course Assistant in action
- WeChat Mini Program (authorized student view)

Binary image files in `screenshots/` are gitignored. Add them manually
when preparing a release.

---

## Roadmap

- Switch to a stable, fixed model configuration (currently defaults to
  `openrouter/free` for easy evaluation)
- Expand the AI knowledge base (piano, art) as those courses come online
- Better multilingual support for the AI assistant
- Optional admin workflow for the studio (no DB dependency)
- Production deployment to a public host

---

## Disclaimer

Names, images, and course information in this public demo may use
anonymized or sample data to protect instructor and student privacy.
Teacher names ("朱老师", "任老师") are placeholders, and the imagery used
on the public site is stock music-scene photography rather than
portraits of real instructors.

---

### 关于中文项目名

琴小助 / Creative Lesson Booking Platform 是一个面向音乐与美术兴趣
课程的预约与学生管理作品集。公开网页负责课程展示、老师介绍、AI
课程咨询与试听预约；微信小程序仅向已正式报名、由机构授权的学生
开放。公开展示内容均使用匿名化或示例信息，以保护老师与学生的隐私。
