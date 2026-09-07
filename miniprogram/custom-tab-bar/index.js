Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/home/index",
        text: "首页",
        icon: "/images/tab-icons/home.svg",
        selectedIcon: "/images/tab-icons/home-active.svg",
      },
      {
        pagePath: "/pages/analysis/index",
        text: "分析",
        icon: "/images/tab-icons/analysis.svg",
        selectedIcon: "/images/tab-icons/analysis-active.svg",
      },
      {
        pagePath: "/pages/goal/index",
        text: "目标",
        icon: "/images/tab-icons/goal.svg",
        selectedIcon: "/images/tab-icons/goal-active.svg",
      },
      {
        pagePath: "/pages/learn/index",
        text: "学习",
        icon: "/images/tab-icons/learn.svg",
        selectedIcon: "/images/tab-icons/learn-active.svg",
      },
    ],
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const path = this.data.list[index].pagePath;
      wx.switchTab({ url: path });
    },
  },
});
