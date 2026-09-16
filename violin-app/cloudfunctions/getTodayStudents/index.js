// 老师查看"当天学生"列表(按时间顺序,附带学生联系方式方便老师联系)
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function pad(n) { return n < 10 ? '0' + n : '' + n; }

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  if (teacherRes.data.length === 0) return { error: '只有老师可以查看这个页面' };
  const teacher = teacherRes.data[0];

  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const lessonsRes = await db.collection('lessons')
    .where({ teacherId: teacher._id, date: today, status: 'booked' })
    .orderBy('startTime', 'asc')
    .get();

  const studentIds = [...new Set(lessonsRes.data.map(l => l.studentId).filter(Boolean))];
  let studentMap = {};
  if (studentIds.length > 0) {
    const studentsRes = await db.collection('students').where({ _id: _.in(studentIds) }).get();
    studentsRes.data.forEach(s => { studentMap[s._id] = s; });
  }

  const subjectsRes = await db.collection('subjects').get();
  const subjectMap = {};
  subjectsRes.data.forEach(s => { subjectMap[s._id] = s; });

  const list = lessonsRes.data.map(l => ({
    ...l,
    subjectName: subjectMap[l.subjectId] ? subjectMap[l.subjectId].name : '',
    student: studentMap[l.studentId] || null
  }));

  return { list, date: today };
};
