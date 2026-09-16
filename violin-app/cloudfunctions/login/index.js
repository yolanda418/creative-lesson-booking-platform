// 每次小程序启动调用一次。
// 逻辑: 用 openid 查 teachers 表 -> 是老师; 查不到再查/建 students 表 -> 是学生。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 1. 是不是老师
  const teacherRes = await db.collection('teachers')
    .where({ openid, status: 'active' })
    .get();

  const subjectsRes = await db.collection('subjects').get();

  if (teacherRes.data.length > 0) {
    return {
      role: 'teacher',
      profile: teacherRes.data[0],
      subjects: subjectsRes.data
    };
  }

  // 2. 不是老师,查学生记录,没有就自动创建一条空记录(引导他后续补填姓名)
  const studentRes = await db.collection('students').where({ openid }).get();

  if (studentRes.data.length > 0) {
    return {
      role: 'student',
      profile: studentRes.data[0],
      subjects: subjectsRes.data
    };
  }

  const addRes = await db.collection('students').add({
    data: {
      openid,
      name: '',
      phone: '',
      createdAt: db.serverDate()
    }
  });

  return {
    role: 'student',
    profile: { _id: addRes._id, openid, name: '', phone: '' },
    subjects: subjectsRes.data
  };
};
