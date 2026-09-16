const api = require('../../../utils/api.js');
const dateUtil = require('../../../utils/date.js');

Page({
  data: {
    month: '',         // picker 用的值,格式 YYYY-MM
    monthDisplay: '',  // 展示用,比如 "2026年9月"
    list: [],
    total: 0
  },

  onLoad() {
    const now = new Date();
    const month = `${now.getFullYear()}-${dateUtil.formatDate(now).split('-')[1]}`;
    this.setData({
      month,
      monthDisplay: this.formatDisplay(month)
    });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  formatDisplay(month) {
    // "2026-09" -> "2026年9月"
    const [y, m] = month.split('-');
    return `${y}年${parseInt(m, 10)}月`;
  },

  onMonthChange(e) {
    const month = e.detail.value; // picker fields="month" 返回 "YYYY-MM"
    this.setData({ month, monthDisplay: this.formatDisplay(month) });
    this.loadData();
  },

  async loadData() {
    const [year, month] = this.data.month.split('-').map(s => parseInt(s, 10));
    const res = await api.call('getMonthlyLessons', { year, month });
    const list = (res.list || []).map(l => ({
      ...l,
      weekday: dateUtil.weekdayLabel(l.date)
    }));
    this.setData({ list, total: res.total || list.length });
  },

  async exportMonthly() {
    try {
      const [year, month] = this.data.month.split('-').map(s => parseInt(s, 10));
      wx.showLoading({ title: '生成中...', mask: true });
      const res = await wx.cloud.callFunction({
        name: 'exportMonthlyLessons',
        data: { year, month }
      });
      wx.hideLoading();
      if (!res.result || res.result.error) {
        wx.showToast({ title: (res.result && res.result.error) || '导出失败', icon: 'none' });
        return;
      }
      const fileID = res.result.fileID;
      // 下载到本地临时路径
      const dl = await wx.cloud.downloadFile({ fileID });
      // 用系统"打开文档"能力,老师可以预览也可以转发保存。
      // 后端返回的是真 XLSX(由 exceljs 生成,OOXML 标准),
      // Excel/WPS/微信 openDocument 都能正常识别。
      // 若设备未装办公 App,会触发 fail,引导老师安装 WPS/Excel。
      await wx.openDocument({
        filePath: dl.tempFilePath,
        showMenu: true,
        fail: (err) => {
          console.warn('[exportMonthly] openDocument fail', err);
          wx.showModal({
            title: '已生成课表',
            content: '设备暂未安装可打开 Excel 文件的 App(WPS/微软 Excel 等),课表已下载到本地。请安装后再打开预览。',
            showCancel: false,
            confirmText: '我知道了'
          });
        }
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '导出失败,请重试', icon: 'none' });
    }
  }
});
