// 学生预约一个"open"状态的时段。
// 用数据库事务确保"同一时段不会被两个学生同时抢到"。
// 预约提交时以服务端时间再次校验,防止旧页面提交过期预约。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtHm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isExpired(lesson, todayStr, nowHm) {
  if (!lesson || !lesson.date || !lesson.startTime) return false;
  if (lesson.date < todayStr) return true;
  if (lesson.date > todayStr) return false;
  return lesson.startTime < nowHm;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { lessonId } = event;

  if (!lessonId) return { error: '缺少 lessonId' };

  const studentRes = await db.collection('students').where({ openid }).get();
  if (studentRes.data.length === 0) return { error: '找不到你的学生资料' };
  const student = studentRes.data[0];
  if (!student.name) return { error: '请先完善姓名信息' };

  const transaction = await db.startTransaction();
  try {
    const lesson = await transaction.collection('lessons').doc(lessonId).get();

    if (!lesson.data || lesson.data.status !== 'open') {
      await transaction.rollback();
      return { error: '该时段已被预约或不存在,请刷新后重试' };
    }

    // 以服务端时间校验,拦截过期预约;不依赖前端是否已刷新列表。
    const now = new Date();
    if (isExpired(lesson.data, fmt(now), fmtHm(now))) {
      await transaction.rollback();
      return { error: '该时段已开始/已过期,无法预约,请刷新列表' };
    }

    await transaction.collection('lessons').doc(lessonId).update({
      data: {
        studentId: student._id,
        status: 'booked',
        updatedAt: db.serverDate()
      }
    });

    await transaction.commit();
    return { success: true };
  } catch (e) {
    await transaction.rollback();
    return { error: '预约失败,请重试' };
  }
};
