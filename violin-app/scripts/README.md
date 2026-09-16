# scripts/

微信云开发的**种子 / 清理 / 调试脚本**,只在本地跑,不要部署到云函数。

## 用法

### 1. 先填配置

打开 `seed-test-data.js`,把这两行改成你的真实值:

```js
const APPSECRET = '你的小程序 AppSecret';   // mp.weixin.qq.com → 开发管理 → 开发设置
const ENV_ID = '你的云开发环境 ID';           // 微信开发者工具 → 云开发 → 设置
```

**⚠️ AppSecret 别提交到 git**(建议加到 `.gitignore` 或环境变量)。

### 2. 跑种子脚本(插入测试数据)

```bash
node scripts/seed-test-data.js
```

会自动:
- 查 teachers / students 里**第一个已登录的用户**(让老师+学生各扫一次体验码就有了)
- 创建 1 条小提琴科目(若不存在)
- 插入 2 节课:一节 10 分钟后开始(测上课提醒),一节 5 分钟后结束(测下课提醒)

### 3. 假装用户已授权订阅

```bash
node scripts/seed-subscriptions.js
```

跳过 wx.requestSubscribeMessage 弹窗,直接写 subscriptions 记录(仅测试用)。

### 4. 等 sendReminders 自动跑

定时触发器按你的 cron 配置运行。在云开发控制台 → 云函数 → sendReminders → 日志,看输出。

### 5. 测完清理

```bash
node scripts/clear-test-data.js
```

## 文件清单

```
scripts/
├── lib/
│   └── db-api.js           # HTTP 工具(getAccessToken / dbAdd / dbQuery / dbDelete)
├── seed-test-data.js       # 一键插入测试数据(主入口)
├── seed-subscriptions.js   # 假装用户已订阅(绕过弹窗)
├── clear-test-data.js      # 清掉今天的测试数据
└── README.md               # 本文件
```

## 故障排查

- **`access_token failed`** → AppSecret 错了,去 mp.weixin.qq.com 重置一下,重置后**只显示一次**
- **`env not found`** → ENV_ID 错了,去微信开发者工具 → 云开发 → 设置里复制
- **`teachers 表是空的`** → 让老师微信号先扫一次体验码登录(login 云函数会自动建记录)
- **`权限不足 / errCode: -501001`** → 检查 AppID 是不是这个环境的 owner

