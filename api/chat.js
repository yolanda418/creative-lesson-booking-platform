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
 *   OPENROUTER_MODEL       可选，默认 openrouter/free
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
不要在回复中输出思考过程、内心独白或分析步骤，只输出最终答案。`;

const MODEL_DEFAULT = 'openrouter/free';

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

    // OpenRouter 的 free 路由常指向推理模型，回复放在 message.content，
    // 但部分推理模型把正文放在 message.reasoning 或同时存在。
    // 这里按优先级尝试：content > reasoning；同时做隐私截断，
    // 避免把整段推理原始回传给网页用户。
    const _msg = (completion.choices && completion.choices[0] && completion.choices[0].message) || {};
    let _raw = '';
    if (typeof _msg.content === 'string')   _raw = _msg.content;
    if (!_raw && typeof _msg.reasoning === 'string') _raw = _msg.reasoning;
    const reply = String(_raw || '').trim();

    // 安全诊断：只打印 finish_reason / model / reply 长度；不打印用户内容或 key。
    // finish_reason = 'length' 表示被 max_tokens 截断；'stop' 表示正常结束；
    // 'content_filter' 表示命中过滤；其他值也一并打印便于排查。
    try {
      const _fr = (completion.choices && completion.choices[0]) ? completion.choices[0].finish_reason : null;
      console.error('[api/chat] completion', JSON.stringify({
        model: model,
        finish_reason: _fr || null,
        reply_length: reply.length,
        reply_truncated: _fr === 'length'
      }));
    } catch (_logErr) { /* ignore logging errors */ }

    if (!reply) {
      console.error('[api/chat] empty reply from model:', model);
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