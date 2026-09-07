const { fetchRecords, doubaoChat } = require("../../utils/finance");

Page({
  data: {
    currentTime: "",
    timeRange: "month", // month或quarter
    bars: [],
    totalExpense: 0,
    trendPoints: [],
    clipPath: "polygon(0% 100%, 16.66% 60%, 33.33% 70%, 50% 30%, 66.66% 40%, 83.33% 20%, 100% 80%, 100% 100%)",
    ringLegend: [],
    ringSegments: [],
    conicGradient: "#2ECC71 0deg 360deg",
    tooltipVisible: false,
    tooltipCategory: "",
    tooltipAmount: "",
    tooltipPercentage: "",
    trendTooltipVisible: false,
    trendTooltipTop: 0,
    trendTooltipLeft: 0,
    trendTooltipDate: "",
    trendTooltipIncome: "0.00",
    trendTooltipExpense: "0.00",
    trendTooltipValue: "0.00",
    todayIncome: "0.00",
    todayExpense: "0.00",
    todayBalance: "0.00",
    showTodayIncomeCard: false,
    suggestPlan: {
      title: "暂无规划建议",
      desc: "请先记账，系统将基于真实消费数据生成建议。",
    },
  },

  toggleTodayIncomeCard() {
    this.setData({
      showTodayIncomeCard: !this.data.showTodayIncomeCard,
    });
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.updateCurrentTime();
    this.loadChart();
    this.timer = setInterval(() => this.updateCurrentTime(), 1000);
    // 添加图表更新定时器，每5秒更新一次
    this.chartTimer = setInterval(() => this.loadChart(), 5000);
  },

  onHide() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.chartTimer) {
      clearInterval(this.chartTimer);
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

  async loadChart() {
    try {
      const res = await fetchRecords({ all: true });
      const allRecords = res.result.data.records || [];
      
      // 计算今日收支
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRecords = allRecords.filter((record) => {
        const recordDate = new Date(record.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === today.getTime();
      });
      
      let todayIncome = 0;
      let todayExpense = 0;
      todayRecords.forEach((record) => {
        const amount = Number(record.amount || 0);
        if (record.type === "income") {
          todayIncome += amount;
        } else if (record.type === "expense") {
          todayExpense += amount;
        }
      });
      const todayBalance = todayIncome - todayExpense;
      
      // 支出分类数据（用于饼图和柱状图）
      const expenseRecords = allRecords.filter((i) => i.type === "expense");
      const map = {};
      expenseRecords.forEach((item) => {
        map[item.category] = (map[item.category] || 0) + Number(item.amount || 0);
      });
      const list = Object.keys(map).map((key) => ({ name: key, value: map[key] }));
      const max = Math.max(...list.map((i) => i.value), 1);
      const bars = list
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
        .map((item) => ({
          ...item,
          percent: ((item.value / max) * 100).toFixed(0),
        }));
      const totalExpense = list.reduce((sum, item) => sum + item.value, 0).toFixed(2);
      const total = list.reduce((sum, item) => sum + item.value, 0);
      const ringLegend = bars.map((item, index) => ({
        ...item,
        color: ["#2ECC71", "#FF9F1C", "#2D6CFF", "#7A3DFC", "#203040"][index % 5],
        percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0",
      }));
      // 计算饼图各部分的角度范围
      let currentAngle = 0;
      const ringSegments = ringLegend.map((item) => {
        const angle = (item.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;
        return {
          ...item,
          startAngle,
          endAngle
        };
      });
      // 生成动态的饼图颜色分布
      let conicGradient = "";
      let currentDeg = 0;
      ringLegend.forEach((item, index) => {
        const deg = (item.value / total) * 360;
        const nextDeg = currentDeg + deg;
        conicGradient += `${item.color} ${currentDeg}deg ${nextDeg}deg`;
        if (index < ringLegend.length - 1) {
          conicGradient += ", ";
        }
        currentDeg = nextDeg;
      });
      const { trendPoints, clipPath } = this.buildTrend(allRecords);
      this.setData({
        bars,
        totalExpense,
        trendPoints,
        clipPath,
        ringLegend,
        ringSegments,
        conicGradient,
        todayIncome: todayIncome.toFixed(2),
        todayExpense: todayExpense.toFixed(2),
        todayBalance: todayBalance.toFixed(2),
        suggestPlan: this.buildSuggestPlan(bars, Number(totalExpense)),
      });
    } catch (error) {
      console.error("加载图表数据失败:", error);
    }
  },



  buildSuggestPlan(bars, totalExpense) {
    if (!bars.length || totalExpense <= 0) {
      return {
        title: "暂无规划建议",
        desc: "请先记账，系统将基于真实消费数据生成建议。",
      };
    }
    const top = bars[0];
    const ratio = ((top.value / totalExpense) * 100).toFixed(1);
    return {
      title: `${top.name} 预算优化建议`,
      desc: `${top.name} 占总支出 ${ratio}%（¥${top.value.toFixed(2)}），建议优先控制该分类预算。`,
    };
  },

  async generateConfigSuggestion() {
    const { ringLegend, totalExpense } = this.data;
    if (!ringLegend.length || Number(totalExpense) <= 0) {
      wx.showToast({ title: "请先记账", icon: "none" });
      return;
    }
    const summary = ringLegend
      .map((i) => `${i.name}:${i.value.toFixed(2)}(${i.percentage}%)`)
      .join("；");
    wx.showLoading({ title: "AI生成中" });
    try {
      const resp = await doubaoChat([
        { role: "system", content: "你是大学生理财教练，请给出简洁可执行建议，50字以内。" },
        {
          role: "user",
          content: `我的本月总支出${totalExpense}元，分类占比：${summary}。请输出“一键配置建议”一句话。`,
        },
      ]);
      const text = resp?.result?.data?.content || "";
      if (text) {
        this.setData({
          suggestPlan: {
            title: "AI 一键配置建议",
            desc: text,
          },
        });
      } else {
        wx.showToast({ title: "AI返回为空", icon: "none" });
      }
    } catch (e) {
      wx.showToast({ title: "AI生成失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  showTooltip(e) {
    this.setData({
      tooltipVisible: true,
      tooltipCategory: e.currentTarget.dataset.category,
      tooltipAmount: e.currentTarget.dataset.amount,
      tooltipPercentage: e.currentTarget.dataset.percentage,
    });
  },

  hideTooltip() {
    this.setData({
      tooltipVisible: false,
    });
  },

  hideTrendTooltip() {
    this.setData({
      trendTooltipVisible: false,
    });
  },

  showTrendTooltip(e) {
    // 阻止事件冒泡，防止触发line-wrap的hideTrendTooltip
    e.stopPropagation();
    
    const date = e.currentTarget.dataset.date;
    const income = e.currentTarget.dataset.income;
    const expense = e.currentTarget.dataset.expense;
    const value = e.currentTarget.dataset.value;
    
    // 直接使用小点的位置，简单调整偏移
    this.setData({
      trendTooltipVisible: true,
      trendTooltipTop: 50, // 固定在图表上方
      trendTooltipLeft: 100, // 固定在图表左侧
      trendTooltipDate: date,
      trendTooltipIncome: income.toFixed(2),
      trendTooltipExpense: expense.toFixed(2),
      trendTooltipValue: value.toFixed(2),
    });
  },

  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    this.loadChart();
  },

  buildTrend(records) {
    const map = {};
    records.forEach((item) => {
      const d = new Date(item.date);
      let key;
      if (this.data.timeRange === 'month') {
        // 月度：使用月.日格式
        key = `${d.getMonth() + 1}.${`${d.getDate()}`.padStart(2, "0")}`;
      } else {
        // 季度：使用周数格式
        const weekNumber = Math.ceil(d.getDate() / 7);
        key = `第${weekNumber}周`;
      }
      
      // 初始化该日期的记录
      if (!map[key]) {
        map[key] = { income: 0, expense: 0 };
      }
      
      // 分别计算收入和支出
      if (item.type === "income") {
        map[key].income += Number(item.amount || 0);
      } else if (item.type === "expense") {
        map[key].expense += Number(item.amount || 0);
      }
    });
    
    let points;
    if (this.data.timeRange === 'month') {
      // 月度：取最近6天
      points = Object.keys(map)
        .sort()
        .slice(-6)
        .map((key) => ({
          key,
          income: map[key].income,
          expense: map[key].expense,
          value: map[key].income - map[key].expense // 净余额
        }));
    } else {
      // 季度：取所有周
      points = Object.keys(map)
        .sort((a, b) => {
          // 按周数排序
          const weekA = parseInt(a.replace('第', '').replace('周', ''));
          const weekB = parseInt(b.replace('第', '').replace('周', ''));
          return weekA - weekB;
        })
        .map((key) => ({
          key,
          income: map[key].income,
          expense: map[key].expense,
          value: map[key].income - map[key].expense // 净余额
        }));
    }
    
    // 计算最大值和最小值，用于归一化
    const values = points.map((p) => p.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    
    // 计算每个点的位置
    const trendPoints = points.map((p) => ({
      ...p,
      top: 180 - ((p.value - min) / range) * 160,
    }));
    
    // 生成动态的clip-path路径
    let clipPath = "";
    if (trendPoints.length > 1) {
      clipPath = "polygon(0% 100%";
      trendPoints.forEach((point, index) => {
        const percentage = (index / (trendPoints.length - 1)) * 100;
        const heightPercentage = ((180 - point.top) / 160) * 100;
        clipPath += `, ${percentage}% ${heightPercentage}%`;
      });
      clipPath += ", 100% 100%)";
    }
    
    return { trendPoints, clipPath };
  },
});
