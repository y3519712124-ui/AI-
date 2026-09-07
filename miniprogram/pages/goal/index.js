const { fetchGoal, upsertGoal, fetchDashboard } = require("../../utils/finance");

Page({
  data: {
    currentTime: "",
    progress: 0,
    progressText: "0%",
    growth: "0.0%",
    goals: [],
    showAddPanel: false,
    newGoal: {
      name: "",
      target: "",
      current: ""
    }
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.updateCurrentTime();
    this.loadGoal();
    this.timer = setInterval(() => this.updateCurrentTime(), 1000);
  },

  onHide() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },

  updateCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.setData({
      currentTime: `${hours}:${minutes}`
    });
  },

  async loadGoal() {
    wx.showLoading({ title: "加载中" });
    try {
      const [goalRes, dashRes] = await Promise.all([fetchGoal(), fetchDashboard()]);
      const goal = goalRes.result.data || null;
      const income = Number(dashRes.result.data?.income || 0);
      const expense = Number(dashRes.result.data?.expense || 0);
      const netGrowth = income > 0 ? Math.max(((income - expense) / income) * 100, 0) : 0;

      if (!goal || !Number(goal.targetAmount)) {
        this.setData({
          progress: 0,
          progressText: "0%",
          growth: netGrowth.toFixed(1),
          goals: [],
        });
        return;
      }

      const target = Number(goal.targetAmount || 0);
      const current = Number(goal.currentAmount || 0);
      const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      this.setData({
        progress: Number(percent.toFixed(0)),
        progressText: `${percent.toFixed(0)}%`,
        growth: netGrowth.toFixed(1),
        goals: [
          {
            name: "当前储蓄目标",
            target,
            current,
            percent: Number(percent.toFixed(0)),
            color: "#2D6CFF",
            iconPath: "/images/goal-icons/laptop.svg",
          },
        ],
      });
    } catch (error) {
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  addGoal() {
    // 显示添加目标面板
    this.setData({
      showAddPanel: true,
      newGoal: {
        name: "",
        target: "",
        current: ""
      }
    });
  },

  closeAddPanel() {
    this.setData({ showAddPanel: false });
  },

  onGoalNameInput(e) {
    this.setData({
      "newGoal.name": e.detail.value
    });
  },

  onGoalTargetInput(e) {
    this.setData({
      "newGoal.target": e.detail.value
    });
  },

  onGoalCurrentInput(e) {
    this.setData({
      "newGoal.current": e.detail.value
    });
  },

  async saveGoal() {
    const { name, target, current } = this.data.newGoal;
    
    // 验证输入
    if (!name.trim()) {
      wx.showToast({ title: "请输入目标名称", icon: "none" });
      return;
    }
    
    if (!target || Number(target) <= 0) {
      wx.showToast({ title: "请输入有效的目标金额", icon: "none" });
      return;
    }
    
    const currentAmount = Number(current) || 0;
    if (currentAmount < 0) {
      wx.showToast({ title: "当前已存金额不能为负数", icon: "none" });
      return;
    }
    
    wx.showLoading({ title: "保存中" });
    try {
      await upsertGoal({
        targetAmount: Number(target),
        currentAmount: currentAmount
      });
      
      wx.showToast({ title: "保存成功", icon: "success" });
      this.setData({ showAddPanel: false });
      this.loadGoal();
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
