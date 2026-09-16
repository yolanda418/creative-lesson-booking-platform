/* ============================================================
   琴小助 · AI 课程咨询助手 (v1.0)
   ----------------------------------------------------------
   纯前端版：不接真实 LLM API，使用本地关键词匹配。
   未来接入 OpenAI / 其他大模型时，只需替换 getLocalAssistantReply()
   函数内部实现，其余 UI 与事件系统保持不变。

   依赖：复用页面现有的 #bookingModal 弹窗（通过触发任意
   [data-open-modal] 元素的方式打开），不创建第二套弹窗。
   ============================================================ */
(() => {
  'use strict';

  // ---------- 1. 课程知识库 ----------
  const KNOWLEDGE = [
    { keywords: ['小提琴'],
      answer: '小提琴是琴小助目前主推的课程。\n面向儿童启蒙（建议 4 岁以上）、成人零基础和考级方向，\n从持琴、运弓、音准到第一首乐曲，一步步扎实推进。\n可以先预约一次试听，感受一下课堂节奏。',
      suggestBooking: true },
    { keywords: ['钢琴'],
      answer: '钢琴课程目前还在筹备中。\n我们会在师资与课程体系就绪后开放预约，\n现在可以先添加课程顾问微信，留下你的意向，\n上线后会第一时间通知你。',
      suggestBooking: true },
    { keywords: ['美术', '画画', '绘画', '色彩'],
      answer: '美术课程筹备中。\n未来会覆盖儿童创意美术、素描基础与水彩/综合材料方向，\n面向儿童与成人兴趣学习。\n可以先留下你的意向，开放时第一时间通知你。',
      suggestBooking: true },
    { keywords: ['儿童', '孩子', '小孩', '宝宝', '几岁', '多大'],
      answer: '儿童通常从 4 岁左右开始接触乐器是合适的窗口期。\n建议先从兴趣入手，让孩子感受音乐本身的乐趣，\n而不是一开始就练习技法。\n可以先预约一次试听，看看孩子的反应再决定。',
      suggestBooking: true },
    { keywords: ['成人', '大人', '零基础', '成年', '工作了', '上班族'],
      answer: '成人零基础完全没问题，节奏可以完全按你的情况来。\n建议固定每周一次课，平时每天 15–30 分钟练习即可。\n先预约一次试听，告诉我们你的目标和可投入的时间，\n我们会给一个适合起步的建议。',
      suggestBooking: true },
    { keywords: ['老人', '退休', '中老年', '年纪大'],
      answer: '学习乐器任何时候都不晚。\n我们会按你的节奏安排更舒缓、循序渐进的课程内容，\n目标是让学习本身成为一种享受。\n建议先预约一次试听聊聊看。',
      suggestBooking: true },
    { keywords: ['试听', '预约', '报名', '怎么开始', '怎么上课', '流程'],
      answer: '预约试听一般分 4 步：\n1) 选择感兴趣的课程\n2) 添加课程顾问微信，告知学员年龄与基础\n3) 与老师沟通合适的试听时间\n4) 确认时间地点，开启第一节课\n\n具体时间、费用与授课方式，最终以和老师沟通确认为准。',
      suggestBooking: true },
    { keywords: ['价格', '费用', '多少钱', '收费', '课时费'],
      answer: '具体课时费用会根据课程类型、时长和老师略有差异。\n试听阶段通常不收费，方便你先感受课堂氛围。\n欢迎添加课程顾问微信咨询具体方案。',
      suggestBooking: true },
    { keywords: ['老师', '教师', '师资', '朱老师', '任老师'],
      answer: '目前小提琴方向由朱老师与任老师负责。\n他们都毕业于专业院校，有多年一线教学经验，\n善于根据不同学员调整节奏。\n老师详细介绍与真人照片会在后续版本逐步更新。' },
    { keywords: ['小程序', '正式学生', '上课后', '报完名'],
      answer: '微信小程序主要面向已经正式报名的学生使用。\n正式学生会由机构授权后进入小程序，\n用于查看课程与学习相关功能。\n试听阶段主要通过课程顾问进行预约。' },
    { keywords: ['你好', '您好', 'hi', 'hello', '在吗'],
      answer: '你好呀！我是琴小助的 AI 课程助手 ♪\n可以问我关于课程选择、试听流程、年龄建议等问题。\n你也可以直接点击下方的快捷问题开始。' },
    { keywords: ['谢谢', '感谢', 'thanks'],
      answer: '不客气～有任何问题随时再问我 :)' }
  ];

  const FALLBACK =
    '这个问题我暂时还不能准确回答。\n' +
    '你可以咨询课程顾问，或点击下方的"预约试听"进一步了解。';

  // ---------- 2. 核心回答逻辑 ----------
  /**
   * Future: replace local response logic with real LLM API call
   *
   * 现在：基于关键词匹配，返回 { text, suggestBooking }
   * 未来：可在此处发起对 OpenAI / 其他大模型的 fetch 请求，
   *       把返回结果包装成同样的 { text, suggestBooking } 形式。
   */
  function getLocalAssistantReply(message) {
    const input = String(message || '').toLowerCase().trim();
    if (!input) {
      return { text: '请输入你的问题，或点击下方快捷问题开始 :)', suggestBooking: false };
    }
    for (const rule of KNOWLEDGE) {
      for (const kw of rule.keywords) {
        if (input.indexOf(kw.toLowerCase()) !== -1) {
          return { text: rule.answer, suggestBooking: rule.suggestBooking === true };
        }
      }
    }
    return { text: FALLBACK, suggestBooking: false, source: 'local' };
  }

  // ---------- 3. 复用现有预约 Modal ----------
  function openBookingModal() {
    const trigger = document.querySelector('[data-open-modal]');
    if (trigger) { trigger.click(); return; }
    const modal = document.getElementById('bookingModal');
    if (modal && typeof modal.showModal === 'function') {
      modal.showModal();
      document.body.classList.add('modal-open');
    }
  }

  // ---------- 4. 快捷问题 ----------
  const QUICK_QUESTIONS = [
    { label: '儿童适合学什么？',      message: '儿童适合学什么' },
    { label: '成人零基础怎么选？',    message: '成人零基础怎么选' },
    { label: '小提琴课程介绍',        message: '小提琴课程介绍' },
    { label: '钢琴课程介绍',          message: '钢琴课程介绍' },
    { label: '美术课程介绍',          message: '美术课程介绍' },
    { label: '如何预约试听？',        message: '如何预约试听' }
  ];

  // ---------- 5. 状态 ----------
  const state = { fab: null, panel: null, body: null, quick: null, form: null, input: null, welcomeShown: false };

  window.getLocalAssistantReply = getLocalAssistantReply;

  const AI_CSS = ".ai-fab{position:fixed;right:32px;bottom:36px;z-index:60;display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:999px;background:var(--green,#354739);color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 10px 28px rgba(40,60,40,.25),0 3px 8px rgba(40,60,40,.14);font-size:14px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,background .2s ease;font-family:inherit;animation:aiFabIn .4s ease .15s both}.ai-fab:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(40,60,40,.32);background:#4d614c}.ai-fab:active{transform:translateY(0)}.ai-fab:focus-visible{outline:3px solid #b17b38;outline-offset:4px}.ai-fab.is-active{background:#293b30}.ai-fab-icon{width:22px;height:22px;display:inline-grid;place-items:center;animation:aiFabPulse 2.6s ease-in-out 1.2s infinite;transform-origin:center}.ai-fab-icon svg{width:22px;height:22px}.ai-fab-label{white-space:nowrap}.ai-chat{position:fixed;right:32px;bottom:108px;z-index:59;width:min(400px,calc(100vw - 64px));height:min(620px,calc(100vh - 160px));max-height:calc(100vh - 160px);background:#fff;color:var(--ink,#293b30);border:1px solid var(--line,#dcded3);border-radius:14px;box-shadow:0 22px 56px rgba(40,60,40,.24),0 6px 14px rgba(40,60,40,.12);display:flex;flex-direction:column;overflow:hidden;font-family:inherit;animation:aiChatIn .28s ease}@keyframes aiChatIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes aiFabIn{from{opacity:0;transform:translateY(12px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes aiFabPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}.ai-chat-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line,#dcded3);background:#fbf9f3}.ai-chat-title{display:flex;align-items:center;gap:12px;min-width:0}.ai-chat-avatar{width:36px;height:36px;border-radius:50%;background:var(--green,#354739);color:#fff;display:grid;place-items:center;flex-shrink:0}.ai-chat-avatar svg{width:22px;height:22px}.ai-chat-title strong{display:block;font-size:14px;font-weight:600;color:var(--ink,#293b30)}.ai-chat-title small{display:block;font-size:11px;color:var(--muted,#697068);margin-top:2px;line-height:1.4}.ai-chat-close{width:32px;height:32px;border-radius:50%;background:transparent;color:var(--muted,#697068);font-size:22px;line-height:1;display:grid;place-items:center;cursor:pointer;transition:background .2s,color .2s;flex-shrink:0}.ai-chat-close:hover{background:#f3efe5;color:var(--ink,#293b30)}.ai-chat-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px;background:#fbfaf6;scrollbar-width:thin}.ai-chat-body::-webkit-scrollbar{width:6px}.ai-chat-body::-webkit-scrollbar-thumb{background:#dcded3;border-radius:3px}.ai-msg{display:flex;gap:10px;align-items:flex-start;animation:aiMsgIn .2s ease}.ai-msg-loading .ai-msg-bubble{opacity:.7;font-style:italic;color:var(--muted,#697068)}@keyframes aiMsgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.ai-msg-bot{align-items:flex-start}.ai-msg-user{flex-direction:row-reverse}.ai-msg-avatar{width:28px;height:28px;border-radius:50%;background:var(--green,#354739);color:#fff;display:grid;place-items:center;flex-shrink:0;margin-top:2px}.ai-msg-avatar svg{width:18px;height:18px}.ai-msg-user .ai-msg-avatar{background:#a46a37}.ai-msg-bubble{background:#fff;border:1px solid var(--line,#dcded3);border-radius:12px;padding:10px 13px;font-size:14px;line-height:1.65;max-width:78%;word-wrap:break-word;white-space:pre-wrap;color:var(--ink,#293b30)}.ai-msg-user .ai-msg-bubble{background:var(--green,#354739);color:#fff;border-color:var(--green,#354739)}.ai-msg-cta{display:block;margin-top:8px;padding:8px 16px;background:var(--green,#354739);color:#fff;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:background .2s;font-family:inherit;align-self:flex-start}.ai-msg-cta:hover{background:#4d614c}.ai-msg-cta:focus-visible{outline:3px solid #b17b38;outline-offset:3px}.ai-chat-quick{padding:10px 18px 6px;display:flex;flex-wrap:wrap;gap:6px;background:#fbfaf6;border-top:1px solid var(--line,#dcded3)}.ai-quick-btn{background:#fff;border:1px solid var(--line,#dcded3);color:var(--ink,#293b30);border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;transition:background .2s,border-color .2s,color .2s;font-family:inherit;line-height:1.4}.ai-quick-btn:hover{background:#f3efe5;border-color:var(--green,#354739);color:var(--green,#354739)}.ai-quick-btn:focus-visible{outline:3px solid #b17b38;outline-offset:2px}.ai-chat-form{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--line,#dcded3);background:#fff}.ai-chat-form input[type=text]{flex:1;border:1px solid var(--line,#dcded3);background:#fbfaf6;border-radius:999px;padding:10px 16px;font-size:14px;color:var(--ink,#293b30);font-family:inherit;outline:none;transition:border-color .2s,background .2s;min-width:0}.ai-chat-form input[type=text]:focus{border-color:var(--green,#354739);background:#fff}.ai-chat-form input[type=text]::placeholder{color:var(--muted,#697068)}.ai-chat-send{width:40px;height:40px;border-radius:50%;background:var(--green,#354739);color:#fff;display:grid;place-items:center;cursor:pointer;border:none;transition:background .2s,transform .2s;flex-shrink:0}.ai-chat-send:hover{background:#4d614c;transform:translateY(-1px)}.ai-chat-send svg{width:18px;height:18px}.ai-chat-send:focus-visible{outline:3px solid #b17b38;outline-offset:3px}@media(max-width:600px){.ai-fab{right:16px;bottom:20px;padding:12px 18px;font-size:13px}.ai-fab-label{display:none}.ai-fab-icon{width:24px;height:24px}.ai-fab-icon svg{width:24px;height:24px}.ai-chat{right:16px;left:16px;width:auto;bottom:88px;height:min(70vh,560px);max-height:calc(100vh - 110px);border-radius:16px}.ai-chat-form{padding-bottom:calc(12px + env(safe-area-inset-bottom))}}@media(hover:none){.ai-fab,.ai-chat-send,.ai-quick-btn,.ai-msg-cta{min-height:40px}}@media(prefers-reduced-motion:reduce){.ai-fab,.ai-fab-icon,.ai-chat,.ai-msg,.ai-chat-send{transition:none!important;animation:none!important}}";

  // ---------- 6. 消息渲染 ----------
  function appendMessage(body, role, text, opts) {
    const msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg-' + role;
    const avatar = document.createElement('span');
    avatar.className = 'ai-msg-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = role === 'user'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 13c1 1.2 2.4 2 4 2s3-.8 4-2" stroke-linecap="round"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/></svg>';
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';
    text.split('\n').forEach(function (line, i) {
      if (i > 0) bubble.appendChild(document.createElement('br'));
      bubble.appendChild(document.createTextNode(line));
    });
    if (opts && opts.loading) msg.classList.add('ai-msg-loading');

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    body.appendChild(msg);

    if (opts && opts.suggestBooking) {
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'ai-msg-cta';
      cta.textContent = '预约试听';
      cta.addEventListener('click', function () { closeChat(); openBookingModal(); });
      msg.appendChild(cta);
    }
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function renderQuickQuestions(container) {
    container.innerHTML = '';
    QUICK_QUESTIONS.forEach(function (q) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-quick-btn';
      btn.textContent = q.label;
      btn.addEventListener('click', function () { handleUserSend(q.message); });
      container.appendChild(btn);
    });
  }

  function openChat() {
    if (!state.panel) return;
    state.panel.hidden = false;
    state.fab.setAttribute('aria-expanded', 'true');
    state.fab.classList.add('is-active');
    if (!state.welcomeShown) {
      state.welcomeShown = true;
      appendMessage(state.body, 'bot',
        '你好，我是 AI 课程助手 👋\n' +
        '我可以帮助你了解小提琴、钢琴、美术课程，以及试听和报名流程。');
    }
    setTimeout(function () { state.input && state.input.focus(); }, 50);
  }

  function closeChat() {
    if (!state.panel) return;
    state.panel.hidden = true;
    state.fab.setAttribute('aria-expanded', 'false');
    state.fab.classList.remove('is-active');
  }

  function handleUserSend(rawMessage) {
    const text = String(rawMessage || '').trim();
    if (!text) return;
    appendMessage(state.body, 'user', text);
    state.input.value = '';
    const loadingMsg = appendMessage(state.body, 'bot', 'AI 正在思考...', { loading: true });
    getAIReply(text).then(function (reply) {
      replaceMessage(loadingMsg, reply.text, { suggestBooking: reply.suggestBooking, source: reply.source });
    }).catch(function () {
      const fallback = getLocalAssistantReply(text);
      const friendly = '（AI 助手暂时无法连接，我先根据基础课程信息为你回答。）\n\n';
      replaceMessage(loadingMsg, friendly + fallback.text, { suggestBooking: fallback.suggestBooking, source: 'local' });
    });
  }

  function replaceMessage(msgEl, text, opts) {
    if (!msgEl) return;
    msgEl.classList.remove('ai-msg-loading');
    const bubble = msgEl.querySelector('.ai-msg-bubble');
    if (bubble) {
      bubble.innerHTML = '';
      text.split('\n').forEach(function (line, i) {
        if (i > 0) bubble.appendChild(document.createElement('br'));
        bubble.appendChild(document.createTextNode(line));
      });
    }
    const oldCta = msgEl.querySelector('.ai-msg-cta');
    if (oldCta) oldCta.remove();
    if (opts && opts.suggestBooking) {
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'ai-msg-cta';
      cta.textContent = '预约试听';
      cta.addEventListener('click', function () { closeChat(); openBookingModal(); });
      msgEl.appendChild(cta);
    }
    state.body.scrollTop = state.body.scrollHeight;
  }

  async function getAIReply(message) {
    const text = String(message || '').trim();
    if (!text) return Object.assign({}, getLocalAssistantReply(text), { source: 'local' });

    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;

    try {
      const fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      };
      if (controller) fetchOpts.signal = controller.signal;

      const res = await fetch('/api/chat', fetchOpts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || typeof data.reply !== 'string' || !data.reply) throw new Error('Empty reply');
      return { text: data.reply, suggestBooking: false, source: 'openai' };
    } catch (err) {
      console.warn('[ai-assistant] /api/chat failed, fallback to local:', err && err.message);
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // ---------- 7. DOM 构建 ----------
  function buildDOM() {
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'ai-fab';
    fab.setAttribute('aria-label', '打开 AI 课程助手');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', 'aiChatPanel');
    fab.innerHTML =
      '<span class="ai-fab-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
          '<circle cx="12" cy="12" r="9"/>' +
          '<path d="M8 13c1 1.2 2.4 2 4 2s3-.8 4-2" stroke-linecap="round"/>' +
          '<circle cx="9" cy="10" r=".8" fill="currentColor"/>' +
          '<circle cx="15" cy="10" r=".8" fill="currentColor"/>' +
        '</svg>' +
      '</span>' +
      '<span class="ai-fab-label">AI 课程助手</span>';

    const panel = document.createElement('section');
    panel.className = 'ai-chat';
    panel.id = 'aiChatPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI 课程助手');
    panel.setAttribute('aria-modal', 'false');
    panel.hidden = true;
    panel.innerHTML =
      '<header class="ai-chat-header">' +
        '<div class="ai-chat-title">' +
          '<span class="ai-chat-avatar" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
              '<circle cx="12" cy="12" r="9"/>' +
              '<path d="M8 13c1 1.2 2.4 2 4 2s3-.8 4-2" stroke-linecap="round"/>' +
              '<circle cx="9" cy="10" r=".8" fill="currentColor"/>' +
              '<circle cx="15" cy="10" r=".8" fill="currentColor"/>' +
            '</svg>' +
          '</span>' +
          '<div>' +
            '<strong>AI 课程助手</strong>' +
            '<small>可以帮你了解课程、选择方向和试听流程</small>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="ai-chat-close" aria-label="关闭聊天窗口">×</button>' +
      '</header>' +
      '<div class="ai-chat-body" id="aiChatBody" role="log" aria-live="polite"></div>' +
      '<div class="ai-chat-quick" id="aiChatQuick" aria-label="快捷问题"></div>' +
      '<form class="ai-chat-form" id="aiChatForm">' +
        '<input type="text" id="aiChatInput" name="message" autocomplete="off" placeholder="输入你的问题…" aria-label="输入问题">' +
        '<button type="submit" class="ai-chat-send" aria-label="发送">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M4 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</button>' +
      '</form>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    state.fab = fab;
    state.panel = panel;
  }

  function injectCSS() {
    if (document.getElementById('ai-assistant-style')) return;
    const s = document.createElement('style');
    s.id = 'ai-assistant-style';
    s.textContent = AI_CSS;
    document.head.appendChild(s);
  }

  // ---------- 8. 启动 ----------
  function init() {
    injectCSS();
    buildDOM();
    state.body  = document.getElementById('aiChatBody');
    state.quick = document.getElementById('aiChatQuick');
    state.form  = document.getElementById('aiChatForm');
    state.input = document.getElementById('aiChatInput');

    renderQuickQuestions(state.quick);

    state.fab.addEventListener('click', function () {
      if (state.panel.hidden) openChat(); else closeChat();
    });
    state.panel.querySelector('.ai-chat-close').addEventListener('click', closeChat);
    state.form.addEventListener('submit', function (e) { e.preventDefault(); handleUserSend(state.input.value); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !state.panel.hidden) { closeChat(); state.fab.focus(); }
    });

    window.QinXiaoAI = {
      open: openChat, close: closeChat,
      toggle: function () { state.panel.hidden ? openChat() : closeChat(); },
      getLocalAssistantReply: getLocalAssistantReply,
      getAIReply: getAIReply
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
