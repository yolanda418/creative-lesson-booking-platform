// 老师调整课程: 改时间/改学生/取消。只有老师本人能调用,且只能调自己的课。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { lessonId, date, startTime, endTime, studentId, status } = event;

  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  if (teacherRes.data.length === 0) return { error: '只有老师可以调整课程' };
  const teacher = teacherRes.data[0];

  const lessonRes = await db.collection('lessons').doc(lessonId).get();
  if (!lessonRes.data || lessonRes.data.teacherId !== teacher._id) {
    return { error: '找不到这节课,或不属于你' };
  }

  const updateData = { updatedAt: db.serverDate() };
  if (date) updateData.date = date;
  if (startTime) updateData.startTime = startTime;
  if (endTime) updateData.endTime = endTime;
  if (status) updateData.status = status;
  if (typeof studentId !== 'undefined') {
    updateData.studentId = studentId || null;
    // 调整成有学生的话,状态自动设为 booked;调整成没学生就回到 open
    updateData.status = studentId ? 'booked' : 'open';
  }
  // 时间/学生有变化时,提醒发送状态重置,保证还能再收到一次提醒
  updateData.remindBeforeSent = false;
  updateData.remindAfterSent = false;

  await db.collection('lessons').doc(lessonId).update({ data: updateData });

  return { success: true };
};
