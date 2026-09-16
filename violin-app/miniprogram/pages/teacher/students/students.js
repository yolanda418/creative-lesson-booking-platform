const api = require('../../../utils/api.js');

// ⚠️⚠️⚠️ 三个地方的模板 ID 必须保持完全一致(同时改这三处)⚠️⚠️⚠️
//   1. cloudfunctions/sendReminders/index.js  第 20-21 行
//   2. miniprogram/pages/student/detail/detail.js
//   3. miniprogram/pages/teacher/students/students.js  (本文件)
// 任何一个不一致,只会有部分用户能收到提醒,且排查非常麻烦。
// 模板 ID(必须与 cloudfunctions/sendReminders/index.js 完全一致!)
// 上课提醒: "上课提醒" 公共模板
const TEMPLATE_ID_BEFORE = 'E9SghGZb5cEFkZbSsNkQkWREwMWVCjVPSFkCJqg98k0';
// 下课提醒: "学习结束提醒" 公共模板
const TEMPLATE_ID_AFTER = 'gAtAC-N7W0UidMJcqWfOXQaLmvq8yv2uQ0vBhH-pcaY';

Page({
  data: { list: [], date: '' },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: '/pages/teacher/students/students' });
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    const res = await api.call('getTodayStudents', {});
    this.setData({ list: res.list, date: res.date });
  },

  goAdjust(e) {
    const lessonId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/teacher/adjust/adjust?id=${lessonId}` });
  },

  subscribeReminders(e) {
    const lessonId = e.currentTarget.dataset.id;
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID_BEFORE, TEMPLATE_ID_AFTER],
      success: (res) => {
        const tasks = [];
        if (res[TEMPLATE_ID_BEFORE] === 'accept') {
          tasks.push(api.call('subscribeReminder', { lessonId, templateType: 'before' }, { showLoading: false }));
        }
        if (res[TEMPLATE_ID_AFTER] === 'accept') {
          tasks.push(api.call('subscribeReminder', { lessonId, templateType: 'after' }, { showLoading: false }));
        }
        Promise.all(tasks).then(() => wx.showToast({ title: '提醒已开启', icon: 'success' }));
      },
      fail: () => wx.showToast({ title: '需要授权才能收到提醒', icon: 'none' })
    });
  }
});
