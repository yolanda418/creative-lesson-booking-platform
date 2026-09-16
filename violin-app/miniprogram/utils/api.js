// 统一封装云函数调用:自动显示 loading,自动 toast 报错,减少每个页面重复写 try/catch
//
// 错误分类:
//   1. 云函数调用失败(wx.cloud.callFunction 直接 reject):通常是真网络异常或函数未部署。
//   2. 云函数返回业务错误(res.result.error):调用成功,但业务判定失败,展示后端给的文案。
//   3. 前端处理返回数据时抛异常:通常是字段缺失或类型不符,显示通用提示。
// 不同源用不同 toast 文案 + console.warn,便于排查。
//
// catch 里输出:云函数名 / 错误对象(去掉 errMsg/result 里可能含敏感信息的部分) / errCode(若有)。

function call(name, data = {}, {
  showLoading = true,
  loadingText = '加载中...',
  // 默认 true 保留原有行为。辅助请求(如 getRecentCancellations 未部署)可传 false
  // 关闭错误 toast,让调用方静默处理——仍会 reject,console.warn 保留诊断。
  showErrorToast = true
} = {}) {
  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true });
  }
  return wx.cloud.callFunction({ name, data })
    .then(res => {
      if (showLoading) wx.hideLoading();
      // 业务错误:调用成功但 res.result.error 有值
      if (res && res.result && res.result.error) {
        console.warn('[api] cloud function business error:', name, res.result.error);
        if (showErrorToast) {
          wx.showToast({ title: res.result.error, icon: 'none' });
        }
        return Promise.reject(Object.assign(new Error(res.result.error), {
          source: 'business',
          cloudName: name,
          serverError: res.result.error
        }));
      }
      return res ? res.result : {};
    })
    .catch(err => {
      if (showLoading) wx.hideLoading();
      // 这里拿到的 err 可能是上面抛的业务错误,也可能是 wx.cloud.callFunction 真的 reject
      if (err && err.source === 'business') {
        // 业务错误在 then 里已经 toast 了,这里不再重复弹
        return Promise.reject(err);
      }
      // 真网络/调用异常:打印调试信息,按需弹通用提示
      const errMsg = (err && (err.errMsg || err.message)) || '未知错误';
      const errCode = err && err.errCode;
      console.warn('[api] cloud function call failed:', name, { errMsg, errCode });
      if (showErrorToast) {
        wx.showToast({ title: '网络异常,请重试', icon: 'none' });
      }
      return Promise.reject(Object.assign(new Error(errMsg), {
        source: 'network',
        cloudName: name,
        errCode,
        errMsg
      }));
    });
}

module.exports = { call };
