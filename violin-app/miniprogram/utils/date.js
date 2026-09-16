// 统一的日期工具,所有日期用字符串 "YYYY-MM-DD" 存储/比较,避免时区问题

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 今天的日期字符串
function today() {
  return formatDate(new Date());
}

// 返回本周(周一到周日)的 [开始日期, 结束日期] 字符串
function thisWeekRange() {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay(); // 把周日当作第7天
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [formatDate(monday), formatDate(sunday)];
}

// 中文星期
function weekdayLabel(dateStr) {
  const d = new Date(dateStr.replace(/-/g, '/'));
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
}

// 把时间规范化成 "HH:MM" 字符串(24 小时制,补零)。
// 用途:
//   1. <picker mode="time"> 返回的 value 在某些机型是 "9:00" 而不是 "09:00",
//      不规范的话数据库里会出现 "9:00"/"09:00" 两种写法,
//      字符串排序时 "10:00" 会排在 "9:00" 前面(因为 ASCII '1' < '9'),
//      导致老师列表里 10 点的课显示在 9 点前面。
//   2. 前端展示时 "09:00" 也比 "9:00" 更整齐。
// 用法: formatHM("9:0")  => "09:00"; formatHM(9, 0) => "09:00"; formatHM("9:00") => "09:00"
function formatHM(h, m) {
  if (arguments.length === 1) {
    // 形如 "9:00" 或 "09:00" 或 "9:0"
    const s = String(h);
    const parts = s.split(':');
    return `${pad(parseInt(parts[0], 10))}:${pad(parseInt(parts[1] || '0', 10))}`;
  }
  return `${pad(parseInt(h, 10))}:${pad(parseInt(m, 10))}`;
}

module.exports = {
  formatDate,
  today,
  thisWeekRange,
  weekdayLabel,
  formatHM
};
