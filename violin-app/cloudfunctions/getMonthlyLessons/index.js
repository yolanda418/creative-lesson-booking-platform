// 老师查看某个月的"历史课程"。
// "历史课程"的定义: 这个月里、日期已经过去、状态是 booked 或 completed 的课
// (不去碰数据本身,不新增"自动完成"定时任务——查询时判断即可)。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// 算出 year-month 这个月有几天(自动处理 2 月 / 30 / 31)
function daysInMonth(year, month) {
  // new Date(year, month, 0) 表示"上个月最后一天",month 是 1-12,
  // Date 构造里 0 表示"上个月第 0 天 = 上个月最后一天"——所以传 month+1 才能拿到当月最后一天
  return new Date(year, month, 0).getDate();
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  if (teacherRes.data.length === 0) {
    return { error: '只有老师可以查看历史课程' };
  }
  const teacher = teacherRes.data[0];

  const year = parseInt(event.year, 10);
  const month = parseInt(event.month, 10); // 1-12
  if (!year || !month || month < 1 || month > 12) {
    return { error: '参数错误:year/month 必填且 month 在 1-12' };
  }

  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;
  const todayStr = fmtDate(new Date());

  const lessonsRes = await db.collection('lessons')
    .where({
      teacherId: teacher._id,
      status: _.in(['booked', 'completed']),
      date: _.gte(startDate).and(_.lte(endDate))
    })
    .orderBy('date', 'asc')
    .orderBy('startTime', 'asc')
    .get();

  // 字符串比较 YYYY-MM-DD 是按字典序就是按时间序,可以直接 .lte 过滤
  const list = lessonsRes.data.filter(l => l.date <= todayStr);

  // 补学生姓名 / 科目名称
  const subjectsRes = await db.collection('subjects').get();
  const subjectMap = {};
  subjectsRes.data.forEach(s => { subjectMap[s._id] = s; });

  let studentMap = {};
  const studentIds = [...new Set(list.map(l => l.studentId).filter(Boolean))];
  if (studentIds.length > 0) {
    const studentsRes = await db.collection('students').where({ _id: _.in(studentIds) }).get();
    studentsRes.data.forEach(s => { studentMap[s._id] = s; });
  }

  const enriched = list.map(l => ({
    ...l,
    subjectName: subjectMap[l.subjectId] ? subjectMap[l.subjectId].name : '',
    studentName: l.studentId && studentMap[l.studentId] ? studentMap[l.studentId].name : ''
  }));

  return {
    list: enriched,
    total: enriched.length,
    year,
    month
  };
};
