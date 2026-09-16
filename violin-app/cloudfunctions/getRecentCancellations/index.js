// 老师查看最近 3 天内的学生取消记录。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const teacherRes = await db.collection('teachers')
    .where({ openid, status: 'active' })
    .get();
  if (teacherRes.data.length === 0) {
    return { error: '只有老师可以查看最近取消' };
  }
  const teacher = teacherRes.data[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const res = await db.collection('cancellations')
    .where({
      teacherId: teacher._id,
      cancelledAt: _.gte(threeDaysAgo)
    })
    .orderBy('cancelledAt', 'desc')
    .get();

  return { list: res.data };
};
