const api = require('../../../utils/api.js');
const dateUtil = require('../../../utils/date.js');

Page({
  data: {
    lessonId: '',
    lesson: null,
    form: { date: '', startTime: '', endTime: '' },
    studentOptions: [{ _id: '', name: '(不设置,变回可预约)' }],
    selectedStudentId: '',
    selectedStudentName: ''
  },

  onLoad(query) {
    this.setData({ lessonId: query.id });
    this.loadData();
  },

  async loadData() {
    const [lessonsRes, studentsRes] = await Promise.all([
      api.call('getMyLessons', { range: 'all' }, { showLoading: false }),
      api.call('listStudents', {}, { showLoading: false })
    ]);
    const lesson = lessonsRes.list.find(l => l._id === this.data.lessonId);
    if (!lesson) {
      wx.showToast({ title: '课程不存在', icon: 'none' });
      return;
    }
    const options = [{ _id: '', name: '(不设置,变回可预约)' }, ...studentsRes.list];
    const current = options.find(s => s._id === lesson.studentId);

    this.setData({
      lesson,
      form: { date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime },
      studentOptions: options,
      selectedStudentId: lesson.studentId || '',
      selectedStudentName: current ? current.name : ''
    });
  },

  onDateChange(e) { this.setData({ 'form.date': e.detail.value }); },
  // 跟 teacher/lessons 一致,picker 返回值统一规范化成 "HH:MM"
  onStartChange(e) { this.setData({ 'form.startTime': dateUtil.formatHM(e.detail.value) }); },
  onEndChange(e) { this.setData({ 'form.endTime': dateUtil.formatHM(e.detail.value) }); },

  onStudentChange(e) {
    const idx = e.detail.value;
    const s = this.data.studentOptions[idx];
    this.setData({ selectedStudentId: s._id, selectedStudentName: s.name });
  },

  async save() {
    const { date, startTime, endTime } = this.data.form;
    await api.call('adjustLesson', {
      lessonId: this.data.lessonId,
      date, startTime, endTime,
      studentId: this.data.selectedStudentId
    });
    wx.showToast({ title: '已保存' });
    setTimeout(() => wx.navigateBack(), 800);
  },

  cancelWhole() {
    wx.showModal({
      title: '确认取消',
      content: '取消后这节课会被标记为已取消,确定吗?',
      success: async (res) => {
        if (!res.confirm) return;
        await api.call('adjustLesson', { lessonId: this.data.lessonId, status: 'cancelled' });
        wx.showToast({ title: '已取消' });
        setTimeout(() => wx.navigateBack(), 800);
      }
    });
  }
});
