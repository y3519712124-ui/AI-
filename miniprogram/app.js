// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // 请改成你的微信云开发环境 ID，例如 cloud1-xxxxxx
      env: "cloud1-3gxwxqpuf3fa14cd",
      // true: 仅本地模式；false: 云端优先(失败自动降级本地并探活恢复)
      useLocalOnly: false,
    };
    if (this.globalData.useLocalOnly) {
      return;
    }
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
