// 学生查看"可预约"的课程时段列表(默认查未来7天内)。
// 已在服务端过滤掉"开始时间已过"的过期空位,避免学生看到 / 预约到无效时段。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtHm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isExpired(lesson, todayStr, nowHm) {
  if (!lesson || !lesson.date || !lesson.startTime) return false;
  if (lesson.date < todayStr) return true;
  if (lesson.date > todayStr) return false;
  return lesson.startTime < nowHm;
}

exports.main = async (event) => {
  const { startDate, endDate } = event; // "YYYY-MM-DD"

  const query = { status: 'open' };
  if (startDate && endDate) {
    query.date = _.gte(startDate).and(_.lte(endDate));
  }

  const res = await db.collection('lessons')
    .where(query)
    .orderBy('date', 'asc')
    .orderBy('startTime', 'asc')
    .get();

  // 服务端时间快照一次,避免循环里时间漂移
  const now = new Date();
  const todayStr = fmt(now);
  const nowHm = fmtHm(now);
  // 过滤掉已过期的空位
  const list = res.data.filter(l => !isExpired(l, todayStr, nowHm));

  return { list };
};
