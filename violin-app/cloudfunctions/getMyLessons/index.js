// 学生/老师查看"我的课程",按 range = 'today' | 'week' | 'all' 筛选
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtHm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function getRangeDates(range) {
  const now = new Date();
  if (range === 'today') {
    const t = fmt(now);
    return [t, t];
  }
  if (range === 'week') {
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return [fmt(monday), fmt(sunday)];
  }
  return null; // 'all' 不限制日期
}

// 判断一个 status='open' 的时段是否"已过期"(开始时间已经过去)。
// 注意:不能只看 date < today,会漏掉"今天但已过开始时间"的时段。
// 数据库里 date/startTime 都是字符串,统一用服务端本地时间比较,
// 避免云函数时区与小程序时区不一致导致的边界错位。
// 返回 true 即视为"已过期未预约"。
function isExpiredOpen(lesson, todayStr, nowHm) {
  if (!lesson || lesson.status !== 'open') return false;
  if (!lesson.date || !lesson.startTime) return false;
  if (lesson.date < todayStr) return true;
  if (lesson.date > todayStr) return false;
  // 日期相等时再看开始时间(less than 等于用 <= 严格小于)
  return lesson.startTime < nowHm;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { range = 'week' } = event; // 'today' | 'week' | 'all'

  // 判断身份
  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  const isTeacher = teacherRes.data.length > 0;

  let query = {};
  if (isTeacher) {
    query.teacherId = teacherRes.data[0]._id;
  } else {
    const studentRes = await db.collection('students').where({ openid }).get();
    if (studentRes.data.length === 0) return { list: [] };
    query.studentId = studentRes.data[0]._id;
  }
  // 老师查看自己创建的所有有效时段；学生仍只看自己的已预约/已完成课程
  query.status = _.in(isTeacher
    ? ['open', 'booked', 'completed']
    : ['booked', 'completed']);

  const dates = getRangeDates(range);
  if (dates) {
    query.date = _.gte(dates[0]).and(_.lte(dates[1]));
  }

  const res = await db.collection('lessons')
    .where(query)
    .orderBy('date', 'asc')
    .orderBy('startTime', 'asc')
    .get();

  // 把学生姓名/科目名称一起补充上,前端不用再单独查
  const subjectsRes = await db.collection('subjects').get();
  const subjectMap = {};
  subjectsRes.data.forEach(s => { subjectMap[s._id] = s; });

  let studentMap = {};
  if (isTeacher) {
    const studentIds = [...new Set(res.data.map(l => l.studentId).filter(Boolean))];
    if (studentIds.length > 0) {
      const studentsRes = await db.collection('students').where({
        _id: _.in(studentIds)
      }).get();
      studentsRes.data.forEach(s => { studentMap[s._id] = s; });
    }
  }

  // 服务端当前时间(用于过期判断),整次请求只用一次快照,避免循环里时间漂移
  const now = new Date();
  const todayStr = fmt(now);
  const nowHm = fmtHm(now);

  const list = res.data.map(l => {
    const enriched = {
      ...l,
      subjectName: subjectMap[l.subjectId] ? subjectMap[l.subjectId].name : '',
      studentName: isTeacher && l.studentId && studentMap[l.studentId] ? studentMap[l.studentId].name : undefined
    };
    // 只对老师 + status=open 的时段计算"已过期未预约"标记;
    // 不写回数据库,只回给前端展示用。
    // 已预约/已完成继续走原有统计/排序,不被误标为过期空位。
    if (isTeacher) {
      enriched.isExpiredOpen = isExpiredOpen(l, todayStr, nowHm);
    }
    return enriched;
  });

  return { list, isTeacher };
};
