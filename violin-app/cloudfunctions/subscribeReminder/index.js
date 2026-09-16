// 前端调用 wx.requestSubscribeMessage 拿到用户"同意"结果后,调这个云函数记一笔。
// 定时提醒任务发送前会查这张表,确认对方对这节课已授权。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { lessonId, templateType } = event; // templateType: 'before' | 'after'

  if (!lessonId || !templateType) return { error: '参数缺失' };

  await db.collection('subscriptions').add({
    data: {
      openid,
      lessonId,
      templateType,
      createdAt: db.serverDate()
    }
  });

  return { success: true };
};
