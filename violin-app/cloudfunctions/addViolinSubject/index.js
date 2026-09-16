// 一次性辅助云函数:给 subjects 集合添加一条"小提琴"记录
// 控制台手动添加有 UI bug,导致 _id 变成空字符串,所以用云函数 API 直接添加

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    // 先查一下,避免重复添加
    const existRes = await db.collection('subjects').where({
      name: '小提琴'
    }).get();

    if (existRes.data.length > 0) {
      // 已经存在,先把 _id 为空的那条删掉
      for (const item of existRes.data) {
        if (!item._id || item._id === '') {
          await db.collection('subjects').doc(item._id).remove().catch(() => {});
        }
      }
      // 如果存在有 _id 的,直接返回它
      const valid = existRes.data.filter(item => item._id && item._id !== '');
      if (valid.length > 0) {
        return { ok: true, message: '小提琴 科目已存在,无需重复添加', existing: valid };
      }
    }

    // 添加新记录
    const addRes = await db.collection('subjects').add({
      data: {
        name: '小提琴'
      }
    });

    return {
      ok: true,
      message: '小提琴 科目添加成功',
      _id: addRes._id
    };
  } catch (err) {
    return { ok: false, error: err.message || JSON.stringify(err) };
  }
};
