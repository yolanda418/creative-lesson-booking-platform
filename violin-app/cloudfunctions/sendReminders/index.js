// 定时触发器(建议每5分钟跑一次,在云开发控制台"云函数-触发器"里配置 cron)
// 扫描"快要上课"和"快要下课"的课程,给老师+学生发订阅消息。
//
// ⚠️ 使用前必须做的事情(微信平台限制,代码无法绕开):
// 1. 去 mp.weixin.qq.com -> 订阅消息 -> 公共模板库,选2个模板:
//    - "上课提醒"模板 (需要包含: 课程名称、上课时间、上课地点/备注 这类字段)
//    - "下课提醒"模板
//    拿到各自的 templateId,填到下面 TEMPLATE_ID_BEFORE / TEMPLATE_ID_AFTER
// 2. 每个用户必须自己在小程序里点过一次"允许接收提醒"(见前端 wx.requestSubscribeMessage
//    的调用,通常放在"预约成功"和"查看今日学生"的按钮点击里),否则发送会失败。
//    普通授权只能用一次;如果想要老师/学生每天都能收到提醒而不用每次都点,
//    需要去申请"长期订阅"资质(仅限特定类目,教育类目可以尝试申请)。
//
// ⚠️⚠️⚠️ 三个地方的模板 ID 必须保持完全一致(同时改这三处)⚠️⚠️⚠️
//   1. cloudfunctions/sendReminders/index.js  (本文件)
//   2. miniprogram/pages/student/detail/detail.js
//   3. miniprogram/pages/teacher/students/students.js
// 任何一个不一致,只会有部分用户能收到提醒,且排查非常麻烦。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 模板 ID(三个文件必须保持完全一致!)
// 上课提醒: "上课提醒" 公共模板 (教育信息展示)
const TEMPLATE_ID_BEFORE = 'E9SghGZb5cEFkZbSsNkQkWREwMWVCjVPSFkCJqg98k0';
// 下课提醒: "学习结束提醒" 公共模板 (预约/报名)
const TEMPLATE_ID_AFTER = 'gAtAC-N7W0UidMJcqWfOXQaLmvq8yv2uQ0vBhH-pcaY';

// 扩展点: 以后想调整提醒提前量,改这两个数字就行,不用改逻辑
const REMIND_BEFORE_MINUTES = 15; // 上课前几分钟提醒
const REMIND_AFTER_WINDOW_MINUTES = 5; // 下课后几分钟内算"该发下课提醒了"

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function toDateObj(dateStr, timeStr) {
  return new Date(`${dateStr} ${timeStr}`.replace(/-/g, '/'));
}

async function getSubscribedOpenids(lessonId, templateType) {
  const res = await db.collection('subscriptions')
    .where({ lessonId, templateType })
    .get();
  return res.data.map(s => s.openid);
}

async function sendOne(openid, templateId, data) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId,
      data,
      miniprogramState: 'formal' // 开发调试期间可改成 'trial'
    });
    return true;
  } catch (e) {
    console.error('发送订阅消息失败', openid, e.errMsg || e);
    return false;
  }
}

exports.main = async () => {
  const now = new Date();

  // ---------- 1. 上课前提醒 ----------
  const remindWindowEnd = new Date(now.getTime() + REMIND_BEFORE_MINUTES * 60000);
  const upcomingRes = await db.collection('lessons')
    .where({
      status: 'booked',
      remindBeforeSent: false,
      date: fmtDate(now) // 简化处理: 只在当天范围内找(跨天课程提前量很小,不会跨天)
    })
    .get();

  for (const lesson of upcomingRes.data) {
    const start = toDateObj(lesson.date, lesson.startTime);
    if (start > now && start <= remindWindowEnd) {
      const subjectRes = await db.collection('subjects').doc(lesson.subjectId).get();
      const subjectName = subjectRes.data ? subjectRes.data.name : '课程';

      const [teacherRes, studentRes] = await Promise.all([
        db.collection('teachers').doc(lesson.teacherId).get(),
        lesson.studentId ? db.collection('students').doc(lesson.studentId).get() : Promise.resolve(null)
      ]);

      // 字段顺序对齐模板:"上课提醒" 模板 = time3(上课时间) + thing5(课程名称)
      const msgData = {
        time3: { value: lesson.startTime },  // 上课时间 (time 类型,HH:MM,不带日期)
        thing5: { value: subjectName }        // 课程名称 (thing 类型,≤20 字符)
      };

      const targets = [];
      if (teacherRes && teacherRes.data) targets.push(teacherRes.data.openid);
      if (studentRes && studentRes.data) targets.push(studentRes.data.openid);

      for (const openid of targets) {
        const subscribed = await getSubscribedOpenids(lesson._id, 'before');
        if (subscribed.includes(openid)) {
          await sendOne(openid, TEMPLATE_ID_BEFORE, msgData);
        }
      }

      await db.collection('lessons').doc(lesson._id).update({
        data: { remindBeforeSent: true }
      });
    }
  }

  // ---------- 2. 下课提醒 ----------
  const endingRes = await db.collection('lessons')
    .where({
      status: 'booked',
      remindAfterSent: false,
      date: fmtDate(now)
    })
    .get();

  for (const lesson of endingRes.data) {
    const end = toDateObj(lesson.date, lesson.endTime);
    const windowEnd = new Date(end.getTime() + REMIND_AFTER_WINDOW_MINUTES * 60000);
    if (now >= end && now <= windowEnd) {
      const subjectRes = await db.collection('subjects').doc(lesson.subjectId).get();
      const subjectName = subjectRes.data ? subjectRes.data.name : '课程';

      const [teacherRes, studentRes] = await Promise.all([
        db.collection('teachers').doc(lesson.teacherId).get(),
        lesson.studentId ? db.collection('students').doc(lesson.studentId).get() : Promise.resolve(null)
      ]);

      // 字段顺序对齐模板:"学习结束提醒" 模板 = thing5(课程名称) + time1(结束时间)
      const msgData = {
        thing5: { value: subjectName },      // 课程名称 (thing 类型,≤20 字符)
        time1: { value: lesson.endTime }      // 结束时间 (time 类型,HH:MM,不带日期)
      };

      const targets = [];
      if (teacherRes && teacherRes.data) targets.push(teacherRes.data.openid);
      if (studentRes && studentRes.data) targets.push(studentRes.data.openid);

      for (const openid of targets) {
        const subscribed = await getSubscribedOpenids(lesson._id, 'after');
        if (subscribed.includes(openid)) {
          await sendOne(openid, TEMPLATE_ID_AFTER, msgData);
        }
      }

      await db.collection('lessons').doc(lesson._id).update({
        data: { remindAfterSent: true }
      });
    }
  }

  return { success: true, checkedAt: now.toISOString() };
};
