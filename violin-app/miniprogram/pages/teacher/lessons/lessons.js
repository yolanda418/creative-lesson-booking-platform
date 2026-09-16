const api = require('../../../utils/api.js');
const dateUtil = require('../../../utils/date.js');

const STATUS_LABEL = { booked: '已预约', completed: '已完成', cancelled: '已取消', open: '可预约' };

Page({
  data: {
    range: 'week',
    list: [],
    recentCancellations: [],
    showCreate: false,
    form: { date: '', startTime: '', endTime: '' },
    defaultSubjectId: '' // 第一版只有1个科目,自动使用该科目,不需要学生/老师手动选
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: '/pages/teacher/lessons/lessons' });
    }
    const subjects = getApp().globalData.subjects || [];
    if (subjects.length > 0) {
      this.setData({ defaultSubjectId: subjects[0]._id });
    }
    this.loadData();
    this.loadRecentCancellations();
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadData(),
      this.loadRecentCancellations()
    ]).then(() => wx.stopPullDownRefresh());
  },

  onRangeChange(e) {
    this.setData({ range: e.currentTarget.dataset.range });
    this.loadData();
  },

  async loadData() {
    try {
      const res = await api.call('getMyLessons', { range: this.data.range });
      // 进入这里说明云函数调用成功(res.error 已被 api.js 拦截为 reject)
      // 若 res.list 不是数组,通常是字段缺失或后端结构改了,前端解析会失败,
      // 用 try/catch 包住 map,不让前端异常被吞成"网络异常"。
      const list = (res.list || []).map(l => {
        // 判断展示文案:
        //  - 已过期未预约(open 且开始时间已过): 灰色"已过期未预约",不计入正常空位统计
        //  - 未过期 open: "(等待预约)"
        //  - 其他状态: 真实学生姓名 / 空
        let displayStudentName;
        let displayStatusLabel;
        if (l.status === 'open' && l.isExpiredOpen) {
          displayStudentName = '(已过期未预约)';
          displayStatusLabel = '已过期';
        } else {
          displayStudentName = l.status === 'open' ? '(等待预约)' : (l.studentName || '(空)');
          displayStatusLabel = STATUS_LABEL[l.status] || l.status;
        }
        return {
          ...l,
          statusLabel: displayStatusLabel,
          weekday: dateUtil.weekdayLabel(l.date),
          studentName: displayStudentName
        };
      });
      this.setData({ list });
    } catch (err) {
      // api.js 已经按 source = 'business' / 'network' 区分过,
      // 这里再补一层:如果前端 map / setData 抛异常(err.source 不存在),
      // 显示更准确的"数据处理失败"。
      if (!err || err.source !== 'business' && err.source !== 'network') {
        console.warn('[lessons] 前端处理课程数据失败', err);
        wx.showToast({ title: '数据处理失败,请重试', icon: 'none' });
      }
      // 业务错误 / 网络异常:api.js 已经 toast 过,这里不重复弹
      // 但如果 err.source 是 'business',也把当前列表保留为空,避免半渲染
      this.setData({ list: [] });
    }
  },

  async loadRecentCancellations() {
    try {
      // getRecentCancellations 在 your-cloud-env-id 上暂未部署,直接走 FUNCTION_NOT_FOUND。
      // 关闭错误 toast 避免污染课程列表体验,仍让 reject 走到下方 catch 清空数据并结束加载态。
      const res = await api.call('getRecentCancellations', {}, {
        showLoading: false,
        showErrorToast: false
      });
      const recentCancellations = (res.list || []).map(item => {
        const dateParts = (item.date || '').split('-');
        const displayDate = dateParts.length === 3
          ? `${parseInt(dateParts[1], 10)}/${parseInt(dateParts[2], 10)}`
          : (item.date || '');
        return {
          ...item,
          displayDate,
          displayTime: item.startTime,
          cancellationText: `学生${item.studentName || '未填写姓名'}取消了 ${displayDate} ${item.startTime || ''} 的课`
        };
      });
      this.setData({ recentCancellations });
    } catch (err) {
      // 这里通常是 getRecentCancellations 未部署或非老师身份;
      // 已传 showErrorToast:false,api.js 不再弹 toast,这里只记录并清空数据,
      // 不阻塞课程列表渲染,也不包装成"成功"。
      console.warn('[lessons] loadRecentCancellations failed, source=', err && err.source, err);
      this.setData({ recentCancellations: [] });
    }
  },

  goAdjust(e) {
    wx.navigateTo({ url: `/pages/teacher/adjust/adjust?id=${e.currentTarget.dataset.id}` });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/teacher/history/history' });
  },

  showCreateModal() { this.setData({ showCreate: true }); },
  hideCreateModal() { this.setData({ showCreate: false }); },
  stop() {}, // 阻止点击弹窗内部时冒泡关闭弹窗

  onDateChange(e) { this.setData({ 'form.date': e.detail.value }); },
  // picker mode="time" 在不同机型返回值格式不固定("9:00" / "09:00" / "9:0"),
  // 统一规范化成 "HH:MM",避免数据库里出现多种写法导致字符串排序错乱
  onStartChange(e) { this.setData({ 'form.startTime': dateUtil.formatHM(e.detail.value) }); },
  onEndChange(e) { this.setData({ 'form.endTime': dateUtil.formatHM(e.detail.value) }); },

  async createSlot() {
    const { date, startTime, endTime } = this.data.form;
    if (!date || !startTime || !endTime) {
      wx.showToast({ title: '请填写完整时间', icon: 'none' });
      return;
    }
    if (!this.data.defaultSubjectId) {
      wx.showToast({ title: '请先在数据库里配置科目', icon: 'none' });
      return;
    }
    await api.call('createLessonSlot', {
      date, startTime, endTime, subjectId: this.data.defaultSubjectId
    });
    wx.showToast({ title: '创建成功' });
    this.setData({ showCreate: false, form: { date: '', startTime: '', endTime: '' } });
    this.loadData();
  }
});
