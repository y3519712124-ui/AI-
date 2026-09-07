const { doubaoChat } = require("../../utils/finance");

Page({
  data: {
    currentTime: "",
    assessment: null,
    points: null,
    selectedTag: "全部",
    knowledgeTags: ["全部", "理财基础", "安全必读", "消费管理", "投资入门", "信用管理"],
    showArticlePanel: false,
    currentArticle: null,
    challenges: [
      { id: "basic", name: "基础理财常识", status: "进入闯关", iconPath: "/images/learn-icons/trophy.svg", stars: 0 },
      { id: "credit", name: "信用管理实操", status: "进入闯关", iconPath: "/images/learn-icons/credit.svg", stars: 0 },
    ],
    articles: [
      {
        id: "a1",
        title: "为什么你的余额宝收益越来越低？",
        tag: "理财基础",
        desc: "看懂货币基金收益变化，从风险、利率和市场流动性三个角度理解。",
        time: "5分钟前",
        content:
          "货币基金收益下降通常与市场利率走低有关。你可以重点关注7日年化收益率和万份收益，不要只看历史最高值。对学生党来说，货币基金更适合作为短期备用金，不建议把长期目标资金全部放在这里。",
      },
      {
        id: "a2",
        title: "警惕！针对大学生的\"高收益\"理财骗局",
        tag: "安全必读",
        desc: "遇到\"保本高收益、拉人返利、先交押金\"要立刻提高警惕。",
        time: "昨天",
        content:
          "凡是承诺“高收益+零风险”的项目都要警惕。常见套路包括熟人拉群、虚假收益截图、先交培训费或保证金。建议你坚持三步核验：查资质、查合同、查资金去向。任何需要你先转账到个人账户的“理财机会”都建议拒绝。",
      },
      {
        id: "a3",
        title: "复利的力量：每天攒一杯奶茶钱，10年后有多少？",
        tag: "趣味经济学",
        desc: "学会定投与复利计算，建立长期储蓄和投资的耐心。",
        time: "2天前",
        content:
          "如果每天存20元，一年就是7300元。再配合长期复利，时间会成为你的资产放大器。关键不在一次性存很多，而在持续、稳定、可执行。你可以先设一个“自动转入”计划，让储蓄变成默认动作。",
      },
      {
        id: "a4",
        title: "大学生月度预算怎么做才不会崩？",
        tag: "消费管理",
        desc: "用50/30/20的思路拆分每月生活费，减少月底“爆仓”。",
        time: "3天前",
        content:
          "建议把每月预算分成三类：必要支出、弹性支出、储蓄目标。优先保证必要支出，再给弹性支出设置上限。每周复盘一次比月底补救更有效。",
      },
      {
        id: "a5",
        title: "基金定投入门：先搞清这3个问题",
        tag: "投资入门",
        desc: "定投频率、持有周期、止盈策略是新手最容易忽略的点。",
        time: "4天前",
        content:
          "定投更适合长期资金，不建议拿短期要用的钱参与。每月固定日期、固定金额，先养成纪律；止盈目标可以按收益率区间提前设定。",
      },
      {
        id: "a6",
        title: "信用卡使用规则：避免逾期的4个提醒",
        tag: "信用管理",
        desc: "按时还款、控制额度、账单日规划，这些细节会影响信用记录。",
        time: "5天前",
        content:
          "逾期不仅有罚息，还会影响征信。建议开启自动还款提醒，消费后及时记录，保持账单透明。额度使用率过高也会增加风险，尽量保持在合理区间。",
      },
    ],
    filteredArticles: [],
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.updateCurrentTime();
    this.timer = setInterval(() => this.updateCurrentTime(), 1000);
    this.applyFilter();
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

  reassess() {
    this.runAiReassess();
  },

  async runAiReassess() {
    wx.showLoading({ title: "测评中" });
    try {
      const resp = await doubaoChat([
        { role: "system", content: "你是大学生财商测评助手。输出JSON: {score:number,level:string,advice:string}" },
        {
          role: "user",
          content: "请基于“理性消费、应急储蓄、风险意识、理财纪律”生成一次测评结果。",
        },
      ]);
      const content = resp?.result?.data?.content || "";
      const matched = content.match(/\{[\s\S]*\}/);
      let parsed = null;
      if (matched) {
        parsed = JSON.parse(matched[0]);
      }
      this.setData({
        assessment: {
          sampleText: "已完成本次AI测评",
          score: parsed?.score ?? "--",
          level: parsed?.level ?? "财商成长中",
          rankText: parsed?.advice ?? "保持记账和复盘，持续优化支出结构。",
        },
      });
      wx.showToast({ title: "测评完成", icon: "success" });
    } catch (e) {
      wx.showToast({ title: "测评失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onChallengeTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id === "basic") {
      this.askBasicQuiz();
      return;
    }
    this.askCreditQuiz();
  },

  askBasicQuiz() {
    wx.showModal({
      title: "基础理财常识",
      content: "问题：应急金建议至少覆盖几个月必要开销？\nA.1个月  B.3-6个月",
      confirmText: "选B",
      cancelText: "选A",
      success: (res) => {
        const correct = res.confirm;
        this.finishChallenge("basic", correct);
      },
    });
  },

  askCreditQuiz() {
    wx.showModal({
      title: "信用管理实操",
      content: "问题：信用卡账单最低还款是否等于按时全额还款？\nA.是  B.否",
      confirmText: "选B",
      cancelText: "选A",
      success: (res) => {
        const correct = res.confirm;
        this.finishChallenge("credit", correct);
      },
    });
  },

  finishChallenge(id, correct) {
    const challenges = this.data.challenges.map((c) => {
      if (c.id !== id) return c;
      if (!correct) return c;
      const stars = Math.min((c.stars || 0) + 1, 5);
      return {
        ...c,
        stars,
        status: stars >= 3 ? "已通关" : "继续闯关",
      };
    });
    const points = (this.data.points || 0) + (correct ? 50 : 0);
    this.setData({ challenges, points });
    wx.showToast({ title: correct ? "答对了 +50分" : "答错了，再试一次", icon: "none" });
  },

  applyFilter() {
    const { selectedTag, articles } = this.data;
    const filteredArticles =
      selectedTag === "全部" ? articles : articles.filter((item) => item.tag === selectedTag);
    this.setData({ filteredArticles });
  },

  onSelectTag(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ selectedTag: tag });
    this.applyFilter();
  },

  openArticle(e) {
    const id = e.currentTarget.dataset.id;
    const currentArticle = this.data.articles.find((a) => a.id === id) || null;
    if (!currentArticle) return;
    this.setData({ currentArticle, showArticlePanel: true });
  },

  closeArticlePanel() {
    this.setData({ showArticlePanel: false, currentArticle: null });
  },
});
