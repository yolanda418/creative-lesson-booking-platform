// 学生首次登录后,补填姓名/电话
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { name, phone } = event;

  if (!name) {
    return { error: '请填写姓名' };
  }

  const studentRes = await db.collection('students').where({ openid }).get();
  if (studentRes.data.length === 0) {
    return { error: '找不到学生记录' };
  }

  await db.collection('students').doc(studentRes.data[0]._id).update({
    data: { name, phone: phone || '' }
  });

  return { success: true };
};
