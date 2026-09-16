// 老师导出某个月的课表为真实 XLSX 文件,上传到云存储后返回 fileID。
// 用 exceljs 生成 OOXML 标准的 .xlsx(不在"扩展名撒谎"的灰色地带),
// Excel/WPS/微信 openDocument 都能正常识别。
//
// 依赖变更: 增加 exceljs(在 package.json 声明,云函数部署时云端安装依赖即可)。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const ExcelJS = require('exceljs');

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// 计算"YYYY-MM-DD 是星期几",返回中文(周一/周二/...)
function weekdayCn(dateStr) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const d = new Date(dateStr.replace(/-/g, '/'));
  return names[d.getDay()];
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const teacherRes = await db.collection('teachers').where({ openid, status: 'active' }).get();
  if (teacherRes.data.length === 0) {
    return { error: '只有老师可以导出课表' };
  }
  const teacher = teacherRes.data[0];

  const year = parseInt(event.year, 10);
  const month = parseInt(event.month, 10);
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

  // 只导出"已过去的历史课程"
  const lessons = lessonsRes.data.filter(l => l.date <= todayStr);

  // 补名称
  const subjectsRes = await db.collection('subjects').get();
  const subjectMap = {};
  subjectsRes.data.forEach(s => { subjectMap[s._id] = s; });

  let studentMap = {};
  const studentIds = [...new Set(lessons.map(l => l.studentId).filter(Boolean))];
  if (studentIds.length > 0) {
    const studentsRes = await db.collection('students').where({ _id: _.in(studentIds) }).get();
    studentsRes.data.forEach(s => { studentMap[s._id] = s; });
  }

  // 用 exceljs 生成真 XLSX(OOXML 标准,Excel/WPS 都能识别)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '琴小助';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`${year}年${month}月课表`, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  sheet.columns = [
    { header: '日期',     key: 'date',     width: 14 },
    { header: '星期',     key: 'weekday',  width: 10 },
    { header: '开始时间', key: 'start',    width: 12 },
    { header: '结束时间', key: 'end',      width: 12 },
    { header: '科目',     key: 'subject',  width: 14 },
    { header: '学生姓名', key: 'student',  width: 18 }
  ];
  // 表头加粗
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  lessons.forEach(l => {
    sheet.addRow({
      date:    l.date,
      weekday: weekdayCn(l.date),
      start:   l.startTime,
      end:     l.endTime,
      subject: subjectMap[l.subjectId] ? subjectMap[l.subjectId].name : '',
      student: l.studentId && studentMap[l.studentId] ? studentMap[l.studentId].name : ''
    });
  });

  // 写 buffer
  const buffer = await workbook.xlsx.writeBuffer();
  // exceljs 在 Node 环境下返回 ArrayBuffer,统一转成 Buffer 再上传
  const fileBuffer = Buffer.from(buffer);

  const cloudPath = `exports/${openid}-${year}${pad(month)}.xlsx`;
  // 同月重复导出覆盖旧文件,不攒垃圾
  const uploadRes = await cloud.uploadFile({
    cloudPath,
    fileContent: fileBuffer
  });

  return {
    fileID: uploadRes.fileID,
    total: lessons.length,
    year,
    month
  };
};
