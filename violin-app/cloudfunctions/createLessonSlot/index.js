// 老师创建一个"可预约时段"。只有老师本人能调用。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { date, startTime, endTime, subjectId } = event;

  if (!date || !startTime || !endTime || !subjectId) {
    return { error: '缺少必填参数' };
  }

  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  if (teacherRes.data.length === 0) {
    return { error: '只有老师可以创建课程时段' };
  }
  const teacher = teacherRes.data[0];

  const addRes = await db.collection('lessons').add({
    data: {
      teacherId: teacher._id,
      studentId: null,
      subjectId,
      date,
      startTime,
      endTime,
      status: 'open',
      remindBeforeSent: false,
      remindAfterSent: false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  return { success: true, lessonId: addRes._id };
};
