# 数据库设计说明(微信云开发 - 云数据库)

设计原则:**现在只有 1 位老师 + 1 个科目(小提琴)**,但每条数据都带上
`teacherId` / `subjectId` 字段,以后加老师、加科目时**只需要插入新记录,
不需要改任何代码逻辑**。

---

## 1. subjects(科目表)

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | string | 自动生成 |
| name | string | 科目名称,如 "小提琴" |
| icon | string | emoji 或图标,如 "🎻" |
| createdAt | Date | 创建时间 |

> 第一版只插入一条:`{ name: "小提琴", icon: "🎻" }`
> 以后加钢琴/声乐,直接在数据库控制台插入新记录即可,前端下拉框会自动出现新选项。

---

## 2. teachers(老师表)

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | string | 自动生成 |
| openid | string | 老师微信 openid,用来识别登录身份 |
| name | string | 老师姓名 |
| avatarUrl | string | 头像 |
| subjectIds | array | 该老师教授的科目 _id 列表,如 `["科目id1"]`,支持一个老师教多科 |
| status | string | "active" / "disabled" |

> 第一版只插入 1 条老师记录,把老师本人的 openid 填进去(可以让老师先登录一次小程序,
> 在云开发控制台里查到他的 openid 后手动补录)。

---

## 3. students(学生表)

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | string | 自动生成 |
| openid | string | 学生微信 openid |
| name | string | 学生姓名(首次登录后自己填写) |
| phone | string | 联系电话(可选) |
| createdAt | Date | 首次登录时间 |

> 学生首次打开小程序时自动创建记录(通过 login 云函数),引导他填一次姓名。

---

## 4. lessons(课程/预约表)—— 核心表

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | string | 自动生成 |
| teacherId | string | 关联 teachers._id |
| studentId | string \| null | 关联 students._id,`null` 表示还没被预约 |
| subjectId | string | 关联 subjects._id |
| date | string | 格式 "2026-09-10" |
| startTime | string | 格式 "16:00" |
| endTime | string | 格式 "16:45" |
| status | string | "open"(可预约) / "booked"(已预约) / "cancelled"(已取消) / "completed"(已完成) |
| remindBeforeSent | bool | 上课前提醒是否已发送,防止重复发 |
| remindAfterSent | bool | 下课提醒是否已发送 |
| createdAt | Date | |
| updatedAt | Date | |

**业务流程:**
1. 老师创建一条 `status: "open"`、`studentId: null` 的记录(= 开放一个可预约时段)
2. 学生预约 → 该记录 `studentId` 写入自己的 id,`status` 改为 `"booked"`
3. 学生取消 → `studentId` 清空,`status` 改回 `"open"`(时段回到可预约池)
4. 老师调整 → 可以直接修改 date/startTime/endTime/studentId,或把 status 设为 "cancelled"
5. 定时任务扫描 `status = "booked"` 且快开始/快结束的课程,发送订阅消息提醒,
   发送后把对应的 remindBeforeSent / remindAfterSent 设为 true(避免重复推送)

**将来扩展多老师、多科目时**:前端预约页面按 `subjectId` 和 `teacherId` 筛选即可,
`lessons` 表结构完全不用改。

---

## 5. cancellations(学生取消记录表)

学生成功取消预约后，由 `cancelLesson` 云函数写入一条记录，供老师端的
`getRecentCancellations` 云函数查询最近 3 天的取消情况。课程时段本身仍会
恢复为 `lessons` 集合中的 `status: "open"`、`studentId: null`。

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | string | 自动生成 |
| teacherId | string | 关联 teachers._id,只显示给对应老师 |
| studentName | string | 取消预约的学生姓名 |
| subjectId | string | 关联 subjects._id |
| date | string | 原上课日期,格式 "2026-09-10" |
| startTime | string | 原开始时间,格式 "10:00" |
| endTime | string | 原结束时间,格式 "10:45" |
| cancelledAt | Date | 取消时间,由云函数服务端生成 |

> 客户端不能直接写入 `cancellations` 集合,所有记录均由 `cancelLesson`
> 云函数创建。查询也应通过云函数按当前老师的 `openid` 限定 `teacherId`。

---

## 6. subscriptions(订阅消息授权记录表)

微信规定:必须用户在小程序里主动点击"同意接收提醒",你才有资格给他发这条消息
(而且默认一次授权只能用一次推送,除非申请到"长期订阅"资质)。所以每次预约成功、
或老师查看"今日学生"时,前端都会弹出订阅授权弹窗,把结果记一笔。

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | string | |
| openid | string | 授权人 |
| lessonId | string | 对应哪节课 |
| templateType | string | "before" 或 "after" |
| createdAt | Date | |

> 定时任务发送提醒前,会先查这张表确认该用户对该节课已授权,没授权就跳过(避免报错)。

---

## 7. 云数据库权限建议

- `subjects` / `teachers`:所有人可读,仅管理端(云开发控制台)可写
- `students`:仅创建者本人可读写自己的记录(用云函数里 `openid` 校验,而不是开放数据库直接写权限)
- `cancellations`:仅由 `cancelLesson` 云函数写入,不要开放客户端直接写权限
- `lessons`:**不要**开放客户端直接写数据库权限,一律通过云函数写入(login/bookLesson/
  cancelLesson/adjustLesson 等),这样才能在云函数里校验"是不是本人在取消自己的课"
  这类业务规则。所有写操作都放在云函数里,数据库权限统一设置为"仅创建者可读,不可直接写"
  或"自定义安全规则"。
