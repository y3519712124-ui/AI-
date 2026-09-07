const { addRecord } = require("../../utils/finance");

const CATEGORY_MAP = {
  expense: ["餐饮美食", "交通出行", "社交娱乐", "教育培训", "日用百货", "其他"],
  income: ["兼职收入", "奖学金", "生活费", "奖金", "其他"],
};

Page({
  data: {
    typeOptions: [
      { label: "支出", value: "expense" },
      { label: "收入", value: "income" },
    ],
    type: "expense",
    categories: CATEGORY_MAP.expense,
    categoryIndex: 0,
    amount: "",
    note: "",
  },

  switchType(e) {
    const { type } = e.currentTarget.dataset;
    const categories = CATEGORY_MAP[type];
    this.setData({
      type,
      categories,
      categoryIndex: 0,
    });
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  async submitRecord() {
    const amount = Number(this.data.amount);
    if (!amount || amount <= 0) {
      wx.showToast({ title: "请输入正确金额", icon: "none" });
      return;
    }
    wx.showLoading({ title: "保存中" });
    try {
      await addRecord({
        type: this.data.type,
        amount,
        category: this.data.categories[this.data.categoryIndex],
        note: this.data.note.trim(),
        date: Date.now(),
      });
      wx.showToast({ title: "保存成功", icon: "success" });
      this.setData({ amount: "", note: "" });
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
