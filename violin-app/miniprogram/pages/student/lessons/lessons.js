const api = require('../../../utils/api.js');
const dateUtil = require('../../../utils/date.js');

const STATUS_LABEL = { booked: '已预约', completed: '已完成', cancelled: '已取消', open: '可预约' };

Page({
  data: { range: 'week', list: [] },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: '/pages/student/lessons/lessons' });
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  onRangeChange(e) {
    this.setData({ range: e.currentTarget.dataset.range });
    this.loadData();
  },

  async loadData() {
    const res = await api.call('getMyLessons', { range: this.data.range });
    const list = res.list.map(l => ({
      ...l,
      statusLabel: STATUS_LABEL[l.status] || l.status,
      weekday: dateUtil.weekdayLabel(l.date)
    }));
    this.setData({ list });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/student/detail/detail?id=${e.currentTarget.dataset.id}` });
  }
});
