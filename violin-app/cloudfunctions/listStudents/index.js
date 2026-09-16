// 老师调整课程时,选择"换一个学生"用的下拉列表数据源
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  if (teacherRes.data.length === 0) return { error: '只有老师可以查看' };

  const res = await db.collection('students')
    .where({ name: db.command.neq('') })
    .get();

  return { list: res.data };
};
