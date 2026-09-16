// Local sanitize / handler behavior test
// Mocks the openai SDK so we never touch the real OpenRouter API.

const Module = require('module');

// ---------- Fake openai SDK ----------
class FakeCompletions {
  async create(_opts) {
    if (!global.__FAKE_NEXT__) throw new Error('No fake response set');
    const r = global.__FAKE_NEXT__;
    global.__FAKE_NEXT__ = null;
    return r;
  }
}
class FakeChat { constructor() { this.completions = new FakeCompletions(); } }
class FakeOpenAI { constructor(_opts) { this.chat = new FakeChat(); } }

const _origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'openai') return FakeOpenAI;
  return _origRequire.call(this, id);
};

// ---------- env ----------
process.env.OPENROUTER_API_KEY = 'sk-fake-for-test-only';
delete process.env.OPENROUTER_MODEL; // use code default openrouter/free

function mkReq(msg) { return { method: 'POST', body: { message: msg } }; }
function mkRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    end() { return this; }
  };
}

const cases = [
  {
    name: 'normal_course_reply_5yo_piano',
    msg: '5岁儿童可以学钢琴吗？',
    fakeResp: { choices: [{ message: { content: '5岁是很好的钢琴启蒙年龄。建议从兴趣入手，先感受键盘和节奏。' }, finish_reason: 'stop' }] },
    expect: { status: 200, noSafety: true, noReason: true, hasReply: true }
  },
  {
    name: 'safety_classification_only_6yo_violin',
    msg: '6岁儿童适合学习小提琴吗？',
    fakeResp: { choices: [{ message: { content: 'User Safety: safe\nAssistant Safety: safe' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'classification_with_bracket_and_safety_line_7yo',
    msg: '7岁儿童可以学小提琴吗？',
    fakeResp: { choices: [{ message: { content: 'User Safety: safe\nAssistant Safety: safe\n[SAFE]\nSafety: safe' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'mixed_classification_plus_real_reply_adult',
    msg: '成人零基础怎么选？',
    fakeResp: { choices: [{ message: { content: 'User Safety: safe\n成人零基础完全没问题。节奏可以按你的情况来。' }, finish_reason: 'stop' }] },
    expect: { status: 200, noSafety: true, noReason: true, hasReply: true, replyContains: '成人零基础' }
  },
  {
    name: 'empty_content_no_reasoning_fallback_booking',
    msg: '如何预约试听？',
    fakeResp: { choices: [{ message: { content: '', reasoning: 'huge reasoning block here that should NEVER reach the user' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'mixed_text_8yo_pick',
    msg: '我孩子8岁，完全没学过音乐，学钢琴还是小提琴？',
    fakeResp: { choices: [{ message: { content: '8岁完全零基础，建议先从兴趣出发。' }, finish_reason: 'stop' }] },
    expect: { status: 200, noSafety: true, noReason: true, hasReply: true, replyContains: '8岁' }
  },
  {
    name: 'offtopic_weather_refused',
    msg: '今天天气怎么样？',
    fakeResp: { choices: [{ message: { content: '我是琴小助 AI 课程助手，目前主要帮助你了解小提琴、钢琴、美术课程以及试听报名流程。如果你想了解课程，我可以继续帮你。' }, finish_reason: 'stop' }] },
    expect: { status: 200, noSafety: true, noReason: true, hasReply: true, replyContains: '琴小助' }
  },
  {
    name: 'finish_reason_content_filter',
    msg: '再测一次 5岁儿童可以学钢琴吗？',
    fakeResp: { choices: [{ message: { content: 'User Safety: safe\nAssistant Safety: safe' }, finish_reason: 'content_filter' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'reasoning_field_alone_no_content',
    msg: '只想测 reasoning 是否被吞掉',
    fakeResp: { choices: [{ message: { content: null, reasoning: 'this entire reasoning chain must NEVER reach the user, no matter what' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'inline_safety_marker_inside_text',
    msg: '5岁儿童可以学钢琴吗？',
    // simulate: model writes a sentence then appends a classification line and a real line again,
    // and also embeds "User Safety: safe" inline in another line
    fakeResp: { choices: [{ message: { content: '好的，我来回答。\n检测结果：User Safety: safe 这是我的分析。\n5岁儿童可以开始接触键盘乐理，从兴趣入手。' }, finish_reason: 'stop' }] },
    expect: { status: 200, noSafety: true, noReason: true, hasReply: true, replyContains: '5岁' }
  },
  {
    name: 'only_inline_safety_no_real_reply',
    msg: '7岁儿童可以学小提琴吗？',
    fakeResp: { choices: [{ message: { content: '好的。\nUser Safety: safe\nAssistant Safety: safe' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'refusal_field_set_no_content',
    msg: '再来测一次',
    fakeResp: { choices: [{ message: { content: '', refusal: 'this refusal text must never reach the user' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'trivially_short_after_sanitize',
    msg: 'short case',
    fakeResp: { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] },
    expect: { status: 500, noSafety: true, noReason: true }
  },
  {
    name: 'wall_of_text_capped_at_2000',
    msg: 'long case',
    fakeResp: { choices: [{ message: { content: 'a'.repeat(5000) }, finish_reason: 'stop' }] },
    expect: { status: 200, noSafety: true, noReason: true, hasReply: true, replyMaxLen: 2000 }
  }
];

(async () => {
  let allPass = true;
  for (const tc of cases) {
    delete require.cache[require.resolve('./api/chat.js')];
    const handler = require('./api/chat.js');
    global.__FAKE_NEXT__ = tc.fakeResp;
    const req = mkReq(tc.msg);
    const res = mkRes();
    try { await handler(req, res); } catch (e) { /* swallow */ }
    const body = res.body || {};
    const out = body.reply || body.error || '';
    const statusOk = res.statusCode === tc.expect.status;
    const noSafety = !/user safety|assistant safety|safety\s*[:：]/i.test(out);
    const noReason = !/reasoning|内部思考|安全分类|思考链|moderation|classification/i.test(out);
    const hasReply = typeof body.reply === 'string' && body.reply.length > 0;
    const replyContains = tc.expect.replyContains
      ? (typeof body.reply === 'string' && body.reply.indexOf(tc.expect.replyContains) !== -1)
      : true;
    const replyMaxLenOk = tc.expect.replyMaxLen
      ? (typeof body.reply === 'string' && body.reply.length <= tc.expect.replyMaxLen)
      : true;
    const pass = statusOk && noSafety && noReason && replyContains && replyMaxLenOk && (tc.expect.hasReply === undefined || tc.expect.hasReply === hasReply);
    if (!pass) allPass = false;
    console.log('[' + tc.name + '] status=' + res.statusCode + ' pass=' + pass);
    console.log('  body=' + JSON.stringify(body).slice(0, 260));
  }
  console.log('\n=== ALL PASS: ' + allPass + ' ===');
  process.exit(allPass ? 0 : 1);
})();
