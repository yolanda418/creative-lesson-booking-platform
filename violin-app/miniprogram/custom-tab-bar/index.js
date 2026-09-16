// 根据全局角色(老师/学生)动态决定 tabBar 显示哪几项。
// 这就是"角色不同、菜单不同"的关键: 官方 tabBar 本身不支持这个,所以用自定义 tabBar 实现。
const STUDENT_TABS = [
  { pagePath: '/pages/student/lessons/lessons', text: '我的课程', icon: '📅' },
  { pagePath: '/pages/student/book/book', text: '预约课程', icon: '📝' }
];
const TEACHER_TABS = [
  { pagePath: '/pages/teacher/lessons/lessons', text: '我的课程', icon: '📅' },
  { pagePath: '/pages/teacher/students/students', text: '今日学生', icon: '👩‍🎓' }
];

Component({
  data: {
    selected: '',
    list: STUDENT_TABS
  },
  lifetimes: {
    attached() {
      const app = getApp();
      const applyRole = (role) => {
        this.setData({ list: role === 'teacher' ? TEACHER_TABS : STUDENT_TABS });
      };
      if (app.globalData.role) {
        applyRole(app.globalData.role);
      } else if (app.loginPromise) {
        app.loginPromise.then(res => applyRole(res.role));
      }
    }
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      this.setData({ selected: path });
      wx.switchTab({ url: path });
    }
  }
});
