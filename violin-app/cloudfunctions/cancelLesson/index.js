// 学生取消自己预约的课(校验必须是本人的课,且距离上课还有一定缓冲时间)
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 扩展点: 以后如果要限制"上课前2小时内不能取消",可以在这里加时间比较逻辑
const MIN_HOURS_BEFORE_CANCEL = 2;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { lessonId } = event;

  const studentRes = await db.collection('students').where({ openid }).get();
  if (studentRes.data.length === 0) return { error: '找不到你的学生资料' };
  const student = studentRes.data[0];

  const lessonRes = await db.collection('lessons').doc(lessonId).get();
  const lesson = lessonRes.data;

  if (!lesson || lesson.status !== 'booked') {
    return { error: '这节课不能取消' };
  }
  if (lesson.studentId !== student._id) {
    return { error: '只能取消自己预约的课' };
  }

  const lessonStart = new Date(`${lesson.date} ${lesson.startTime}`.replace(/-/g, '/'));
  const hoursLeft = (lessonStart.getTime() - Date.now()) / 3600000;
  if (hoursLeft < MIN_HOURS_BEFORE_CANCEL) {
    return { error: `距离上课不足${MIN_HOURS_BEFORE_CANCEL}小时,不能取消,请联系老师` };
  }

  const transaction = await db.startTransaction();
  try {
    await transaction.collection('lessons').doc(lessonId).update({
      data: {
        studentId: null,
        status: 'open',
        updatedAt: db.serverDate()
      }
    });

    await transaction.collection('cancellations').add({
      data: {
        teacherId: lesson.teacherId,
        studentName: student.name || '(未填写姓名)',
        subjectId: lesson.subjectId,
        date: lesson.date,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        cancelledAt: db.serverDate()
      }
    });

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    return { error: '取消失败,请重试' };
  }

  return { success: true };
};
