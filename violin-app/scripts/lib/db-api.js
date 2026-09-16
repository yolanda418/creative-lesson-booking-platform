/**
 * CloudBase HTTP API 的小工具集(给 scripts/ 下的种子脚本用)
 * 必须配 scripts/seed-test-data.js 里的 APPID / APPSECRET / ENV_ID
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// 从 seed-test-data.js 读取配置(它和当前文件同根)
const seedPath = path.join(__dirname, '..', 'seed-test-data.js');
const seedSrc = fs.readFileSync(seedPath, 'utf8');
const APPID = seedSrc.match(/APPID\s*=\s*'([^']+)'/)[1];
const APPSECRET = seedSrc.match(/APPSECRET\s*=\s*'([^']+)'/)[1];
const ENV_ID = seedSrc.match(/ENV_ID\s*=\s*'([^']+)'/)[1];

function httpsGet(p) {
  return new Promise((resolve, reject) => {
    https.get('https://api.weixin.qq.com' + p, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse failed: ' + body)); }
      });
    }).on('error', reject);
  });
}

function httpsPost(p, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.weixin.qq.com' + p);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse failed: ' + body)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  const cachePath = path.join(__dirname, '..', '..', '.access_token.cache.json');
  if (fs.existsSync(cachePath)) {
    const c = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (c.expiresAt > Date.now() + 60000) {
      console.log('[OK] using cached access_token');
      return c.token;
    }
  }
  const r = await httpsGet('/cgi-bin/token?grant_type=client_credential&appid=' + APPID + '&secret=' + APPSECRET);
  if (!r.access_token) throw new Error('access_token failed: ' + JSON.stringify(r));
  fs.writeFileSync(cachePath, JSON.stringify({
    token: r.access_token,
    expiresAt: Date.now() + (r.expires_in - 200) * 1000,
  }));
  console.log('[OK] got new access_token');
  return r.access_token;
}

async function dbAdd(token, coll, data) {
  const r = await httpsPost('/tcb/' + coll + '?access_token=' + token, {
    env: ENV_ID, action: 'add', data: [data],
  });
  if (r.errcode && r.errcode !== 0) throw new Error('add ' + coll + ' failed: ' + JSON.stringify(r));
  return r;
}

async function dbQuery(token, coll, where) {
  where = where || {};
  const r = await httpsPost('/tcb/' + coll + '?access_token=' + token, {
    env: ENV_ID, action: 'query', query: JSON.stringify({ where: where, limit: 100 }),
  });
  if (r.errcode && r.errcode !== 0) throw new Error('query ' + coll + ' failed: ' + JSON.stringify(r));
  return r.data || [];
}

async function dbDelete(token, coll, docId) {
  const r = await httpsPost('/tcb/' + coll + '?access_token=' + token, {
    env: ENV_ID, action: 'delete', query: JSON.stringify({ _id: docId }),
  });
  if (r.errcode && r.errcode !== 0) throw new Error('delete failed: ' + JSON.stringify(r));
  return r;
}

module.exports = { getAccessToken, dbAdd, dbQuery, dbDelete, ENV_ID };

