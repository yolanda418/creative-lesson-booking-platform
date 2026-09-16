const api = require('../../../utils/api.js');
const dateUtil = require('../../../utils/date.js');

// ⚠️⚠️⚠️ 三个地方的模板 ID 必须保持完全一致(同时改这三处)⚠️⚠️⚠️
//   1. cloudfunctions/sendReminders/index.js  第 20-21 行
//   2. miniprogram/pages/student/detail/detail.js  (本文件)
//   3. miniprogram/pages/teacher/students/students.js
// 任何一个不一致,只会有部分用户能收到提醒,且排查非常麻烦。
// 模板 ID(必须与 cloudfunctions/sendReminders/index.js 完全一致!)
// 上课提醒: "上课提醒" 公共模板
const TEMPLATE_ID_BEFORE = 'E9SghGZb5cEFkZbSsNkQkWREwMWVCjVPSFkCJqg98k0';
// 下课提醒: "学习结束提醒" 公共模板
const TEMPLATE_ID_AFTER = 'gAtAC-N7W0UidMJcqWfOXQaLmvq8yv2uQ0vBhH-pcaY';

const STATUS_LABEL = { booked: '已预约', completed: '已完成', cancelled: '已取消', open: '可预约' };

Page({
  data: { lesson: null, lessonId: '' },

  onLoad(query) {
    this.setData({ lessonId: query.id });
    this.loadDetail();
  },

  async loadDetail() {
    // 复用 getMyLessons(range=all) 找到这条记录,避免再单独写一个云函数
    const res = await api.call('getMyLessons', { range: 'all' }, { showLoading: false });
    const found = res.list.find(l => l._id === this.data.lessonId);
    if (!found) {
      wx.showToast({ title: '课程不存在', icon: 'none' });
      return;
    }
    this.setData({
      lesson: {
        ...found,
        statusLabel: STATUS_LABEL[found.status] || found.status,
        weekday: dateUtil.weekdayLabel(found.date)
      }
    });
  },

  // 请求订阅授权,用户点"允许"之后记录到数据库,供定时任务发送提醒时查询
  subscribeReminders() {
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID_BEFORE, TEMPLATE_ID_AFTER],
      success: (res) => {
        const tasks = [];
        if (res[TEMPLATE_ID_BEFORE] === 'accept') {
          tasks.push(api.call('subscribeReminder', { lessonId: this.data.lessonId, templateType: 'before' }, { showLoading: false }));
        }
        if (res[TEMPLATE_ID_AFTER] === 'accept') {
          tasks.push(api.call('subscribeReminder', { lessonId: this.data.lessonId, templateType: 'after' }, { showLoading: false }));
        }
        Promise.all(tasks).then(() => {
          wx.showToast({ title: '提醒已开启', icon: 'success' });
        });
      },
      fail: () => {
        wx.showToast({ title: '需要授权才能收到提醒', icon: 'none' });
      }
    });
  },

  cancelLesson() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这节课吗?',
      success: async (res) => {
        if (!res.confirm) return;
        await api.call('cancelLesson', { lessonId: this.data.lessonId });
        wx.showToast({ title: '已取消' });
        setTimeout(() => wx.navigateBack(), 800);
      }
    });
  }
});
