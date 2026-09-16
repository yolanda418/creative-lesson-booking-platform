const api = require('../../../utils/api.js');
const dateUtil = require('../../../utils/date.js');

Page({
  data: { list: [] },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: '/pages/student/book/book' });
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    const res = await api.call('getAvailableLessons', {});
    const list = res.list.map(l => ({ ...l, weekday: dateUtil.weekdayLabel(l.date) }));
    this.setData({ list });
  },

  book(e) {
    const lessonId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认预约',
      content: '确定预约这节课吗?',
      success: async (res) => {
        if (!res.confirm) return;
        await api.call('bookLesson', { lessonId });
        wx.showToast({ title: '预约成功' });
        this.loadData();
      }
    });
  }
});
