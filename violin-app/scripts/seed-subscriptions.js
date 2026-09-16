#!/usr/bin/env node
/**
 * 把今天所有 booked 的 lessons 自动给老师 + 学生都加上"订阅授权"记录。
 *
 * ⚠️ 这只是测试用:它绕过真实的 wx.requestSubscribeMessage 弹窗,
 * 直接写 subscriptions 表,假装用户已经同意授权。
 * 生产环境永远不要这么做——用户必须主动点同意才能发推送。
 *
 * 使用: 先跑过 seed-test-data.js,再跑这个
 * 跑法: node scripts/seed-subscriptions.js
 */

const { getAccessToken, dbQuery, dbAdd } = require('./lib/db-api.js');

(async () => {
  console.log('seeding fake subscriptions...\n');
  const token = await getAccessToken();

  const today = (() => {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  })();

  const lessons = await dbQuery(token, 'lessons', { date: today, status: 'booked' });
  if (!lessons.length) {
    console.error('今天没有 booked 的 lessons。先跑 seed-test-data.js。');
    process.exit(1);
  }
  console.log('[OK] 找到 ' + lessons.length + ' 节今天的课程');

  const teachers = await dbQuery(token, 'teachers');
  const students = await dbQuery(token, 'students');
  if (!teachers.length || !students.length) {
    console.error('缺少 teachers 或 students 数据。');
    process.exit(1);
  }

  const teacher = teachers[0];
  const student = students[0];
  let count = 0;

  for (const lesson of lessons) {
    for (const templateType of ['before', 'after']) {
      for (const person of [teacher, student]) {
        await dbAdd(token, 'subscriptions', {
          openid: person.openid,
          lessonId: lesson._id,
          templateType: templateType,
          createdAt: new Date(),
        });
        count++;
      }
    }
  }

  console.log('[OK] 写了 ' + count + ' 条订阅记录');
  console.log('现在 sendReminders 在窗口期内会推送。\n');
})().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});

