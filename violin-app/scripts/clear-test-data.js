#!/usr/bin/env node
/**
 * 清掉今天所有 lessons + 关联的 subscriptions(测试完跑一下,免得污染数据库)。
 *
 * 跑法: node scripts/clear-test-data.js
 */

const { getAccessToken, dbQuery, dbDelete } = require('./lib/db-api.js');

(async () => {
  console.log('clearing test data...\n');
  const token = await getAccessToken();

  const today = (() => {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  })();

  const lessons = await dbQuery(token, 'lessons', { date: today, status: 'booked' });
  console.log('[OK] 找到今天的 ' + lessons.length + ' 节 booked 课程');

  for (const lesson of lessons) {
    await dbDelete(token, 'lessons', lesson._id);
    console.log('  - 删除 lesson ' + lesson._id);
  }

  const subs = await dbQuery(token, 'subscriptions');
  console.log('\n[OK] 找到 ' + subs.length + ' 条订阅记录');
  for (const s of subs) {
    if (lessons.find((l) => l._id === s.lessonId)) {
      await dbDelete(token, 'subscriptions', s._id);
      console.log('  - 删除 subscription ' + s._id);
    }
  }

  console.log('\nDone.\n');
})().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});

