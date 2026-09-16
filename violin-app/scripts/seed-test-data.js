#!/usr/bin/env node
/**
 * 一键插入测试数据:1 科目 / 复用已有老师 / 复用已有学生 /
 * 2 节课(一节马上开始的,测"上课提醒";一节马上结束的,测"下课提醒")。
 *
 * 使用前:
 *   1. 让"老师"和"学生"两个微信号都用体验版扫码登录过(触发 login 云函数,
 *      自动在 students / teachers 集合里建记录)
 *   2. 打开本文件,把 APPSECRET 和 ENV_ID 填好
 *
 * 跑法: node scripts/seed-test-data.js
 * 清掉测试数据: node scripts/clear-test-data.js
 */

const { getAccessToken, dbAdd, dbQuery } = require('./lib/db-api.js');

const APPID = 'wx_your_appid_here';
const APPSECRET = 'YOUR_APPSECRET_HERE';
const ENV_ID = 'YOUR_CLOUD_ENV_ID';

(async () => {
  console.log('seeding test data...\n');
  const token = await getAccessToken();

  const teachers = await dbQuery(token, 'teachers');
  if (!teachers.length) {
    console.error('\nteachers 表是空的。请先让老师微信号扫码登录一次小程序。');
    process.exit(1);
  }
  const teacher = teachers[0];
  console.log('[OK] teacher: ' + (teacher.name || '(unnamed)') + ' openid=' + teacher.openid.slice(0, 8) + '...');

  const students = await dbQuery(token, 'students');
  if (!students.length) {
    console.error('\nstudents 表是空的。请先让学生微信号扫码登录一次小程序。');
    process.exit(1);
  }
  const student = students[0];
  console.log('[OK] student: ' + (student.name || '(no name)') + ' openid=' + student.openid.slice(0, 8) + '...');

  let subjects = await dbQuery(token, 'subjects');
  let subject;
  if (!subjects.length) {
    console.log('  subjects 表是空的,创建"小提琴"...');
    await dbAdd(token, 'subjects', { name: '小提琴', icon: '🎻', createdAt: new Date() });
    subjects = await dbQuery(token, 'subjects');
    subject = subjects[0];
    console.log('  [OK] subject created');
  } else {
    subject = subjects[0];
    console.log('[OK] subject: ' + subject.name);
  }

  const now = new Date();
  const today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  function plus(mins) {
    const t = new Date(now.getTime() + mins * 60000);
    return String(t.getHours()).padStart(2, '0') + ':' +
      String(t.getMinutes()).padStart(2, '0');
  }

  // Lesson A: 10 分钟后开始(测试"上课提醒")
  const startA = plus(10);
  const endA = plus(55);

  // Lesson B: 5 分钟后结束(测试"下课提醒")
  const startB = plus(-50);
  const endB = plus(5);

  console.log('\ntoday: ' + today);
  console.log('  Lesson A: ' + startA + ' - ' + endA + '  (start in 10 min)');
  console.log('  Lesson B: ' + startB + ' - ' + endB + '  (end in 5 min)');

  console.log('\ninserting Lesson A...');
  await dbAdd(token, 'lessons', {
    teacherId: teacher._id,
    studentId: student._id,
    subjectId: subject._id,
    date: today,
    startTime: startA,
    endTime: endA,
    status: 'booked',
    remindBeforeSent: false,
    remindAfterSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('  [OK]');

  console.log('\ninserting Lesson B...');
  await dbAdd(token, 'lessons', {
    teacherId: teacher._id,
    studentId: student._id,
    subjectId: subject._id,
    date: today,
    startTime: startB,
    endTime: endB,
    status: 'booked',
    remindBeforeSent: true,
    remindAfterSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('  [OK]');

  console.log('\nDone! Next:');
  console.log('  1. open lesson detail in mini app, tap "subscribe reminder"');
  console.log('  2. OR run: node scripts/seed-subscriptions.js to fake the subscription');
  console.log('  3. wait until the time window, sendReminders will run');
  console.log('  4. cleanup: node scripts/clear-test-data.js\n');
})().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});

