App({
  globalData: {
    // 登录后会写入: 'teacher' 或 'student'
    role: null,
    // 学生/老师自己的数据库记录
    profile: null,
    subjects: []
  },

  onLaunch() {
    console.log('[app] onLaunch 开始');
    if (!wx.cloud) {
      console.error('[app] 请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    console.log('[app] wx.cloud 存在,开始 init,env=your-cloud-env-id');
    wx.cloud.init({
      // 云环境 ID(已在微信开发者工具开通,免费版个人配额够用)
      env: 'your-cloud-env-id',
      traceUser: true
    });
    console.log('[app] init 完成,准备调用 login');

    this.loginPromise = this.login();
  },

  // 全局只登录一次,其他页面 onShow 时 await getApp().loginPromise 即可拿到角色
  async login() {
    try {
      console.log('[login] 开始 wx.cloud.callFunction');
      const res = await wx.cloud.callFunction({ name: 'login' });
      console.log('[login] callFunction 返回,result=', JSON.stringify(res.result));
      const { role, profile, subjects } = res.result;
      this.globalData.role = role;
      this.globalData.profile = profile;
      this.globalData.subjects = subjects;
      console.log('[login] 成功', { role, openid: profile && profile.openid, name: profile && profile.name });
      return res.result;
    } catch (err) {
      console.error('[login] 调用失败', err);
      wx.showModal({
        title: '登录失败',
        content: '错误信息:' + (err && (err.errMsg || err.message)) || JSON.stringify(err),
        showCancel: false
      });
      throw err;
    }
  }
});
