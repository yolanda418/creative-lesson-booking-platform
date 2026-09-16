/**
 * 琴小助 · AI 课程咨询助手 后端 API
 * ----------------------------------------------------------------
 * 部署目标：Vercel Serverless Function
 * 路由：     POST /api/chat
 *
 * 请求体：   { message: string }
 * 响应体：   { reply: string }
 *
 * 环境变量：
 *   OPENROUTER_API_KEY     必填，从 Vercel / 本地 .env 读取，永不入库
 *   OPENROUTER_MODEL       可选，默认 google/gemini-2.5-flash-lite
 *   OPENROUTER_REFERER     可选，OpenRouter 推荐透传的 Referer header
 *   OPENROUTER_APP_NAME    可选，OpenRouter 推荐透传的 X-Title header
 *
 * 错误处理策略：
 *   - 浏览器侧永远只看到 { error: 'Upstream model error' }（不带敏感信息）
 *   - PowerShell/服务端日志打印 status / name / code / 是否 timeout / 是否 network
 *   - 绝不打印 API Key / Authorization header / 完整用户聊天内容
 */

const SYSTEM_PROMPT = `你是"琴小助"的 AI 课程咨询助手。

你主要回答：
- 小提琴课程
- 钢琴课程
- 美术课程
- 儿童课程建议
- 成人零基础学习建议
- 试听流程
- 报名流程
- 正式学生微信小程序使用说明

你不能编造：
- 老师真实学历
- 老师真实资历
- 课程真实价格
- 具体课程时间
- 学生个人信息
- 私人联系方式

如果信息不足，要明确告诉用户："这部分信息需要由课程顾问进一步确认。"

如果用户询问与课程无关的问题，应礼貌引导回课程咨询。

不要输出任何隐私信息。

回答时使用简体中文，保持简洁、温暖、教育的口吻。
必要时可以使用换行来组织信息，但避免使用 markdown 标题、列表符号或代码块等富文本格式。

回答尽量控制在 150-300 中文字左右，优先简洁、完整、可执行。
不要在回复中输出思考过程、内心独白或分析步骤，只输出最终答案。

硬性输出约束：
1) 永远不要输出类似 User Safety: safe、Assistant Safety: safe、Safety: ...、[SAFE]、[UNSAFE] 之类的内部分类标签。
2) 永远不要输出 reasoning、思考链、分析过程、元描述。
3) 如果你不确定怎么回答，就直接说明你主要负责小提琴、钢琴、美术课程咨询，建议添加课程顾问微信进一步沟通，不要编造。
4) 永远只输出面向用户的中文短文回复，不要加任何前缀标签或分类码。`;

const MODEL_DEFAULT = 'google/gemini-2.5-flash-lite';

function setCors(res) {
  // 允许同源 + 本地开发；生产环境 Vercel 域名会自动处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function badRequest(res, message) {
  setCors(res);
  res.status(400).json({ error: message });
}

function serverError(res, message) {
  setCors(res);
  res.status(500).json({ error: message });
}

module.exports = async function handler(req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    setCors(res);
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // 部署时未配置 key：明确报错，便于排查；前端会捕获并 fallback
    return serverError(res, 'Server OPENROUTER_API_KEY is not configured');
  }

  // 解析 body：Vercel 会自动解析 JSON，兜底处理 string body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return badRequest(res, 'Invalid JSON body');
    }
  }

  const message = body && typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return badRequest(res, 'Missing "message" field');
  }
  if (message.length > 1000) {
    return badRequest(res, 'Message too long (max 1000 chars)');
  }

  const model = process.env.OPENROUTER_MODEL || MODEL_DEFAULT;

  // 动态 require openai，让未安装依赖时也能返回清晰的 fallback 错误
  let OpenAI;
  try {
    OpenAI = require('openai');
  } catch (e) {
    return serverError(res, 'OpenAI SDK not installed on server');
  }

  // OpenRouter 兼容 OpenAI SDK，通过 baseURL 切换
  // OpenRouter 推荐透传 Referer / X-Title 方便统计，部分模型也会要求
  const defaultHeaders = {};
  if (process.env.OPENROUTER_REFERER)  defaultHeaders['HTTP-Referer'] = process.env.OPENROUTER_REFERER;
  if (process.env.OPENROUTER_APP_NAME) defaultHeaders['X-Title']       = process.env.OPENROUTER_APP_NAME;

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: defaultHeaders
  });

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    // Strict extraction of user-facing final reply.
    // Rules:
    //   1) Only use message.content. Never fall back to reasoning
    //      (reasoning models put their thinking chain there, which is not for users).
    //   2) Sanitize content: strip common internal classification tags
    //      (User Safety: safe / Assistant Safety: safe / [SAFE] / [UNSAFE] etc.),
    //      both as standalone lines AND when embedded mid-line.
    //   3) If after sanitize the reply is empty or trivially short, return 500
    //      so the frontend local fallback takes over.
    //   4) Hard-cap the user-visible reply length as a final safety net.
    const _msg = (completion.choices && completion.choices[0] && completion.choices[0].message) || {};
    const _rawContent = (typeof _msg.content === 'string') ? _msg.content : '';
    const _rawReasoningLen = (typeof _msg.reasoning === 'string') ? _msg.reasoning.length : 0;
    const _rawRefusalLen = (typeof _msg.refusal === 'string') ? _msg.refusal.length : 0;

    // Internal classification / safety markers that must NEVER reach the user.
    // Match:
    //   - whole-line tags like "User Safety: safe" / "Assistant Safety: unsafe"
    //   - bracket tags like "[SAFE]" / "[UNSAFE]" / "[BLOCKED]"
    //   - mid-line embeds like "reply: User Safety: safe" or "Safety: safe"
    // Strategy: split into lines, drop any line containing these markers,
    // AND drop a line if a marker appears inside it (keep nothing partial).
    const _SAFETY_INLINE_RE = /(\b(user|assistant|user_input|assistant_response)\s*safety\s*[:：]|\bsafety\s*[:：]|\[(safe|unsafe|blocked|filtered|flagged|moderated|rejected)\])/i;

    function _sanitizeUserFacingReply(s) {
      if (!s) return '';
      let t = String(s);

      // 1. Remove XML-style reasoning blocks ( etc.) in full
      t = t.replace(/<\s*(think|reasoning|analysis|reflection)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');

      // 2. Per-line filtering: drop any line that is purely classification,
      //    OR contains a classification marker anywhere on the line.
      const lines = t.split(/\r?\n/);
      const kept = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue; // collapse blank lines
        if (_SAFETY_INLINE_RE.test(trimmed)) continue;
        kept.push(line);
      }
      return kept.join('\n').trim();
    }

    let reply = _sanitizeUserFacingReply(_rawContent);

    // 3. Defensive sanity floor: if "reply" is empty or trivially short,
    //    treat it as invalid (model only emitted metadata, not a real answer).
    const MIN_REPLY_CHARS = 4;
    if (reply.length < MIN_REPLY_CHARS) reply = '';

    // 4. Hard cap to keep the chat panel responsive if a model returns a wall of text.
    const MAX_REPLY_CHARS = 2000;
    if (reply.length > MAX_REPLY_CHARS) reply = reply.slice(0, MAX_REPLY_CHARS).trim();

    // Safe diagnostic log: only field presence + lengths, never actual content
    try {
      const _fr = (completion.choices && completion.choices[0]) ? completion.choices[0].finish_reason : null;
      console.error('[api/chat] completion', JSON.stringify({
        model: model,
        finish_reason: _fr || null,
        content_present: _rawContent.length > 0,
        content_raw_len: _rawContent.length,
        reasoning_len: _rawReasoningLen,
        refusal_len: _rawRefusalLen,
        reply_sanitized_len: reply.length,
        reply_truncated: _fr === 'length' || reply.length >= MAX_REPLY_CHARS
      }));
    } catch (_logErr) { /* ignore logging errors */ }

    if (!reply) {
      // After sanitize empty: do NOT return reasoning to frontend. Let local fallback take over.
      console.error('[api/chat] empty after sanitize; content_len=' + _rawContent.length + ', reasoning_len=' + _rawReasoningLen + ', refusal_len=' + _rawRefusalLen);
      return serverError(res, 'Empty response from model');
    }
    setCors(res);
    return res.status(200).json({ reply });
  } catch (err) {
    // 安全诊断日志：只打印 status / name / code / 是否 timeout / 是否 network，
    // 不打印 key / authorization header / 完整用户消息 / 完整 stack
    const status    = err && (err.status || err.statusCode || (err.response && err.response.status));
    const name      = err && err.name;
    const code      = err && err.code;
    const msg       = err && err.message;
    const isTimeout = !!(err && (code === 'ETIMEDOUT' || code === 'ECONNABORTED' ||
                                 /timeout/i.test(String(msg)) || /aborted/i.test(String(msg))));
    const isNetwork = !!(err && (code === 'ENOTFOUND' || code === 'ECONNREFUSED' ||
                                 code === 'EAI_AGAIN'  || code === 'ECONNRESET' ||
                                 /fetch failed/i.test(String(msg))));

    console.error('[api/chat] OpenRouter error', JSON.stringify({
      model: model,
      status: status || null,
      name: name || null,
      code: code || null,
      isTimeout: isTimeout,
      isNetwork: isNetwork,
      message: msg ? String(msg).slice(0, 200) : null
    }));

    return serverError(res, 'Upstream model error');
  }
};