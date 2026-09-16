#!/usr/bin/env node
// 配置检查脚本: 扫一遍项目里所有需要你手动填的"占位符",
// 告诉你哪些已经填好、哪些还差。改完任意一项,再跑一次即可。
//
// 用法:
//   node scripts/check-config.js
//
// 退出码: 全部 OK = 0; 有缺失项 = 1。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 一个项目里"需要手动填的占位符"清单。每条规则:
//   file:     文件相对路径(从项目根)
//   pattern:  要匹配的字符串(这里写人类可读的字面量即可,不用正则)
//   label:    给用户看的"这一项是干嘛的"
//   whereToGet: 用户从哪拿到这个值
let allOk = true;
const lines = [];
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);

const checks = [
  {
    file: 'project.config.json',
    pattern: '填入你自己的小程序AppID',
    label: '小程序 AppID',
    whereToGet: '微信公众平台 mp.weixin.qq.com → 开发管理 → 开发设置 → 开发者ID(小程序ID)'
  },
  {
    file: 'miniprogram/app.js',
    pattern: 'your-cloud-env-id',
    label: '云开发环境 ID',
    whereToGet: '微信开发者工具 → 顶部"云开发"按钮 → 开通/选择环境 → 复制环境 ID'
  },
  {
    file: 'cloudfunctions/sendReminders/index.js',
    pattern: '你的-上课提醒-模板ID',
    label: '订阅消息:上课提醒模板 ID',
    whereToGet: '微信公众平台 → 订阅消息 → 公共模板库 → 搜"课程提醒" → 选1个 → 我的模板里复制'
  },
  {
    file: 'cloudfunctions/sendReminders/index.js',
    pattern: '你的-下课提醒-模板ID',
    label: '订阅消息:下课提醒模板 ID',
    whereToGet: '同上,选另一个"下课提醒"模板'
  },
  {
    file: 'miniprogram/pages/student/detail/detail.js',
    pattern: '你的-上课提醒-模板ID',
    label: '订阅消息(学生端):上课提醒模板 ID(必须跟 sendReminders 一致)',
    whereToGet: '复制 sendReminders 里同一个值'
  },
  {
    file: 'miniprogram/pages/student/detail/detail.js',
    pattern: '你的-下课提醒-模板ID',
    label: '订阅消息(学生端):下课提醒模板 ID(必须跟 sendReminders 一致)',
    whereToGet: '复制 sendReminders 里同一个值'
  },
  {
    file: 'miniprogram/pages/teacher/students/students.js',
    pattern: '你的-上课提醒-模板ID',
    label: '订阅消息(老师端):上课提醒模板 ID(必须跟 sendReminders 一致)',
    whereToGet: '复制 sendReminders 里同一个值'
  },
  {
    file: 'miniprogram/pages/teacher/students/students.js',
    pattern: '你的-下课提醒-模板ID',
    label: '订阅消息(老师端):下课提醒模板 ID(必须跟 sendReminders 一致)',
    whereToGet: '复制 sendReminders 里同一个值'
  }
];

// 额外检查:三个文件里的"上课提醒"模板 ID 是不是同一个值(避免只改一处忘改别处)
function checkTemplateIdConsistency() {
  const files = [
    'cloudfunctions/sendReminders/index.js',
    'miniprogram/pages/student/detail/detail.js',
    'miniprogram/pages/teacher/students/students.js'
  ];
  const re = /const TEMPLATE_ID_BEFORE = '([^']+)'/;
  const vals = files.map(f => {
    const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = c.match(re);
    return m ? m[1] : null;
  });
  if (vals.every(v => v && v.startsWith('你的-'))) return null; // 都还没填,不算不一致
  const uniq = [...new Set(vals)];
  if (uniq.length === 1 && !uniq[0].startsWith('你的-')) return null; // 全填好了且一致
  return { files, vals, uniq };
}

console.log('');
console.log('=================================================');
console.log('  小提琴小程序 - 配置检查');
console.log('=================================================');
console.log('');

for (const c of checks) {
  const filePath = path.join(ROOT, c.file);
  if (!fs.existsSync(filePath)) {
    lines.push(`❌ [文件不存在] ${c.file}`);
    allOk = false;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const found = content.includes(c.pattern);
  if (found) {
    lines.push(`⏳ [未填]  ${c.label}`);
    lines.push(`        文件: ${c.file}`);
    lines.push(`        怎么拿到: ${c.whereToGet}`);
    console.log(`⏳ 待填: ${c.label}`);
    console.log(`     文件: ${c.file}`);
    console.log(`     怎么拿到: ${c.whereToGet}`);
    console.log('');
    allOk = false;
  } else {
    console.log(`✅ 已填: ${c.label}  (${c.file})`);
  }
}

const consistency = checkTemplateIdConsistency();
if (consistency) {
  console.log('');
  console.log('⚠️  三个文件里的"上课提醒"模板 ID 不一致(请检查):');
  consistency.files.forEach((f, i) => {
    console.log(`     ${f}:  ${consistency.vals[i] || '(未填)'}`);
  });
  console.log('     -> 把它们改成同一个值,否则只会有部分用户能收到提醒');
  allOk = false;
}

console.log('');
console.log('=================================================');
if (allOk) {
  console.log('🎉 所有占位符都已填好!可以打开微信开发者工具导入项目测试了。');
  console.log('');
  console.log('下一步提醒:');
  console.log('  1. 微信开发者工具 → 导入项目 → 选 D:\\violin-app\\violin-app');
  console.log('  2. 在云开发控制台建 6 个集合 (subjects/teachers/students/lessons/subscriptions/cancellations)');
  console.log('  3. 在 subjects 集合插一行 {name:"小提琴", icon:"🎻"}');
  console.log('  4. 把 cloudfunctions/ 下 13 个文件夹挨个"上传并部署"');
} else {
  console.log('还有占位符没填,见上方说明。改完重跑这个脚本。');
}
console.log('=================================================');
console.log('');

process.exit(allOk ? 0 : 1);
