Page({
  data: {
    loading: true,
    needProfile: false,
    name: '',
    phone: ''
  },

  async onLoad() {
    try {
      const app = getApp();
      const result = app.loginPromise ? await app.loginPromise : await app.login();
      console.log('[index] onLoad 拿到结果', JSON.stringify(result));
      const { role, profile } = result;

      if (role === 'student' && !profile.name) {
        // 学生第一次进来,没填过姓名,留在本页填资料
        this.setData({ loading: false, needProfile: true });
        return;
      }

      // 已经有身份和资料了,跳去对应角色的首页
      const target = role === 'teacher'
        ? '/pages/teacher/lessons/lessons'
        : '/pages/student/lessons/lessons';
      console.log('[index] 准备跳转', target);
      wx.switchTab({ url: target });
    } catch (err) {
      console.error('[index] onLoad 失败', err);
      this.setData({ loading: false });
      wx.showModal({
        title: '进入失败',
        content: '请截图发给开发者。错误:' + ((err && (err.errMsg || err.message)) || JSON.stringify(err)),
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },

  async submitProfile() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    const api = require('../../utils/api.js');
    await api.call('updateProfile', { name: this.data.name.trim(), phone: this.data.phone.trim() });
    getApp().globalData.profile.name = this.data.name.trim();
    wx.switchTab({ url: '/pages/student/lessons/lessons' });
  }
});
