/**
 * 本地开发服务器：把 web/ 当静态目录 + 转发 /api/chat 到 api/chat.js
 * ---------------------------------------------------------------
 * 启动：npm run dev   （会先读取根目录 .env）
 * 访问：http://localhost:3000/
 *
 * 这只是开发辅助，不参与生产部署；生产环境用 Vercel 即可。
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// 读取根目录 .env（兼容 .env / .env.local / .env.txt），避免依赖额外包
function loadEnvFile(filePath){if(!fs.existsSync(filePath))return false;let text=fs.readFileSync(filePath,'utf8');if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);text.split(/\r?\n/).forEach(function(line){const trimmed=line.trim();if(!trimmed||trimmed.startsWith('#'))return;const idx=trimmed.indexOf('=');if(idx<0)return;const key=trimmed.slice(0,idx).trim();let val=trimmed.slice(idx+1).trim();if((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'")))val=val.slice(1,-1);if(key&&!(key in process.env))process.env[key]=val;});return true;}

const ROOT_DIR = path.join(__dirname, '..');
const envCandidates = ['.env', '.env.local', '.env.txt'];
let envLoadedFrom = null;
envCandidates.forEach(function (name) {
  const p = path.join(ROOT_DIR, name);
  if (loadEnvFile(p)) envLoadedFrom = p;
});

// 启动时打印安全日志（绝不打印真实 key，只显示存在性 + 长度）
console.log('--- env diagnostics ---');
console.log('  env file loaded:    ' + (envLoadedFrom ? path.basename(envLoadedFrom) : '(none found in .env / .env.local / .env.txt)'));
var _orKey = process.env.OPENROUTER_API_KEY;
var _orModel = process.env.OPENROUTER_MODEL;
console.log('  OPENROUTER_API_KEY loaded: ' + (typeof _orKey === 'string' && _orKey.length > 0));
console.log('  OPENROUTER_API_KEY length: ' + (typeof _orKey === 'string' ? _orKey.length : 0));
console.log('  OPENROUTER_MODEL:          ' + (_orModel || '(not set, will use code default openrouter/free)'));
console.log('------------------------');

const ROOT = path.join(__dirname, '..');
const WEB  = path.join(ROOT, 'web');
const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8'
};

function safeJoin(base, requested) {
  const decoded = decodeURIComponent((requested || '/').split('?')[0]);
  const target = path.normalize(path.join(base, decoded));
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

const server = http.createServer(async function (req, res) {
  // API：转发到 api/chat.js
  if (req.url && req.url.startsWith('/api/')) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', async function () {
      try {
        const handler = require('./chat.js');
        // 模拟 Vercel 给的 req 对象（body 已解析）
        let parsed;
        try { parsed = body ? JSON.parse(body) : {}; }
        catch (e) { parsed = body; }
        const fakeReq = Object.assign({}, req, { method: req.method, body: parsed });
        // 包装 res：让本地原生 Node http.ServerResponse 兼容 Vercel API
        //   res.status(code).json(obj) / res.setHeader(...) / res.end()
        const fakeRes = Object.create(res);
        fakeRes.status = function (code) { res.statusCode = code; return fakeRes; };
        fakeRes.json = function (obj) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(obj));
          }
        };

        await handler(fakeReq, fakeRes);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
        console.error('[dev-server] api error:', err);
      }
    });
    return;
  }

  // 静态文件：默认 index.html
  let urlPath = req.url || '/';
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = safeJoin(WEB, urlPath);
  if (!filePath) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found: ' + urlPath);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, function () {
  console.log('===================================================');
  console.log(' 琴小助 · 本地开发服务器');
  console.log(' 静态目录：' + WEB);
  console.log(' API 路由：POST http://localhost:' + PORT + '/api/chat');
  console.log(' 网页地址：http://localhost:' + PORT + '/');
  console.log(' 按 Ctrl+C 退出');
  console.log('===================================================');
});