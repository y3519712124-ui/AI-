const { fetchDashboard, fetchRecords, addRecord } = require("../../utils/finance");

const CATEGORY_OPTIONS = ["餐饮美食", "交通出行", "社交娱乐", "教育培训", "日用百货", "其他"];

// 百度OCR API配置
let BAIDU_CONFIG = {};
try {
  BAIDU_CONFIG = require("../../config/baidu");
} catch (error) {
  // Optional local configuration. Other features work without it.
}
const OCR_APP_ID = BAIDU_CONFIG.OCR_APP_ID || "";
const OCR_API_KEY = BAIDU_CONFIG.OCR_API_KEY || "";
const OCR_SECRET_KEY = BAIDU_CONFIG.OCR_SECRET_KEY || "";

// 百度语音API配置
const SPEECH_APP_ID = BAIDU_CONFIG.SPEECH_APP_ID || "";
const SPEECH_API_KEY = BAIDU_CONFIG.SPEECH_API_KEY || "";
const SPEECH_SECRET_KEY = BAIDU_CONFIG.SPEECH_SECRET_KEY || "";

Page({
  data: {
    dashboard: {
      balance: "0.00",
      income: "0.00",
      expense: "0.00",
      month: "本月",
    },
    quickActions: [
      { name: "拍照识单", action: "camera", iconPath: "/images/home-icons/camera.svg", bg: "#FFF1E9" },
      { name: "语音记账", action: "voice", iconPath: "/images/home-icons/mic.svg", bg: "#EEF3FF" },
      { name: "手动记账", action: "manual", iconPath: "/images/home-icons/pen.svg", bg: "#EAF9EF" },
      { name: "账单明细", action: "detail", iconPath: "/images/home-icons/bill.svg", bg: "#F4EDFF" },
    ],
    latestRecords: [],
    displayRecords: [],
    displayDate: "",
    warn: {
      title: "娱乐超支预警！",
      desc: "本月\"社交娱乐\"已支出¥850，超过预算50%。建议减少本周非必要聚餐，点击查看节流方案。",
    },
    showManualPanel: false,
    showVoicePanel: false,
    showDetailPanel: false,
    manualType: "expense",
    manualAmount: "",
    manualCategoryIndex: 0,
    manualNote: "",
    categoryOptions: CATEGORY_OPTIONS,
    voiceText: "",
    detailFilter: "all",
    detailRecords: [],
    isRecording: false,
    recorderManager: null,
  },

  onLoad() {
    // 初始化录音管理器
    this.setData({
      recorderManager: wx.getRecorderManager()
    });
    
    const recorderManager = this.data.recorderManager;
    recorderManager.onStop((res) => {
      this.setData({ isRecording: false });
      this.recognizeVoice(res.tempFilePath);
    });
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.loadData();
  },

  async loadData() {
    wx.showLoading({ title: "加载中" });
    try {
      const [dashRes, listRes] = await Promise.all([
        fetchDashboard(),
        fetchRecords({ all: true }),
      ]);
      const records = listRes.result.data.records || [];
      this.setData({
        dashboard: dashRes.result.data,
        latestRecords: records.slice(0, 5),
        detailRecords: records.slice(0, 30),
        displayRecords: this.toDisplayRecords(records.slice(0, 6)),
        displayDate: this.getDisplayDate(),
        warn: this.buildWarn(records),
      });
    } catch (error) {
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  getDisplayDate() {
    const d = new Date();
    const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    return `${d.getFullYear()}年${`${d.getMonth() + 1}`.padStart(2, "0")}月${`${d.getDate()}`.padStart(2, "0")}日 · ${week[d.getDay()]}`;
  },

  toDisplayRecords(records) {
    return records
      .filter((item) => item.type === "expense")
      .map((item) => {
        const d = new Date(item.date);
        const time = `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
        const iconMap = {
          餐饮美食: { type: "food", symbol: "•" },
          交通出行: { type: "bus", symbol: "🚌" },
          社交娱乐: { type: "fun", symbol: "◉" },
          教育培训: { type: "study", symbol: "🧾" },
          日用百货: { type: "daily", symbol: "◈" },
          其他: { type: "other", symbol: "•" },
        };
        const iconInfo = iconMap[item.category] || iconMap.其他;
        return {
          ...item,
          time,
          amountText: `-${Number(item.amount || 0).toFixed(2)}`,
          iconType: iconInfo.type,
          iconSymbol: iconInfo.symbol,
        };
      });
  },

  buildWarn(records) {
    const expenseRecords = records.filter((item) => item.type === "expense");
    if (!expenseRecords.length) {
      return {
        title: "本月消费提醒",
        desc: "暂无足够数据，记几笔后将自动生成个性化提醒。",
      };
    }
    const map = {};
    expenseRecords.forEach((item) => {
      map[item.category] = (map[item.category] || 0) + Number(item.amount || 0);
    });
    const top = Object.keys(map)
      .map((key) => ({ name: key, value: map[key] }))
      .sort((a, b) => b.value - a.value)[0];
    return {
      title: `${top.name} 支出偏高`,
      desc: `当前该分类累计 ¥${top.value.toFixed(2)}，建议下周设置该分类预算上限。`,
    };
  },

  onActionTap(e) {
    const { action } = e.currentTarget.dataset;
    if (action === "camera") {
      this.takePhoto();
      return;
    }
    if (action === "voice") {
      this.setData({ showVoicePanel: true });
      return;
    }
    if (action === "manual") {
      this.setData({ showManualPanel: true });
      return;
    }
    if (action === "detail") {
      this.setData({ showDetailPanel: true, detailFilter: "all", detailRecords: this.data.latestRecords });
    }
  },

  takePhoto() {
    wx.authorize({
      scope: 'scope.camera',
      success: () => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['camera'],
          success: (res) => {
            const tempFilePaths = res.tempFilePaths;
            this.uploadImage(tempFilePaths[0]);
          }
        });
      },
      fail: () => {
        wx.showToast({ title: "需要相机权限才能使用拍照识单功能", icon: "none" });
      }
    });
  },

  goRecord() {
    wx.navigateTo({ url: "/pages/record/index" });
  },

  async uploadImage(filePath) {
    wx.showLoading({ title: "识别中" });
    try {
      // 获取OCR token
      const token = await this.getOcrToken();
      
      // 上传图片到百度OCR
      const result = await this.callOcrApi(filePath, token);
      
      // 解析识别结果
      const parsedResult = this.parseOcrResult(result);
      
      // 填充到记账面板
      this.setData({
        showManualPanel: true,
        manualAmount: parsedResult.amount || "",
        manualCategoryIndex: this.getCategoryIndex(parsedResult.category || "餐饮美食"),
        manualNote: `拍照识别: ${parsedResult.merchant || ""}`
      });
      
      wx.showToast({ title: "识别成功", icon: "success" });
    } catch (error) {
      console.error("OCR识别失败:", error);
      wx.showToast({ title: "识别失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async getOcrToken() {
    if (!OCR_API_KEY || !OCR_SECRET_KEY) {
      throw new Error("Baidu OCR credentials are not configured");
    }
    return new Promise((resolve, reject) => {
      wx.request({
        url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${OCR_API_KEY}&client_secret=${OCR_SECRET_KEY}`,
        method: 'GET',
        success: (res) => {
          if (res.data.access_token) {
            resolve(res.data.access_token);
          } else {
            reject(new Error('获取OCR token失败'));
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  callOcrApi(filePath, token) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
        filePath: filePath,
        name: 'image',
        header: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        success: (res) => {
          const result = JSON.parse(res.data);
          if (result.words_result) {
            resolve(result);
          } else {
            reject(new Error('OCR识别失败'));
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  parseOcrResult(result) {
    const words = result.words_result.map(item => item.words).join(' ');
    
    // 提取金额
    const amountMatch = words.match(/(\d+\.\d{2}|\d+)/);
    const amount = amountMatch ? amountMatch[0] : '';
    
    // 提取商家名称（简单实现，实际项目中可能需要更复杂的逻辑）
    const merchantMatch = words.match(/(.*?)[0-9]/);
    const merchant = merchantMatch ? merchantMatch[1].trim() : '';
    
    // 简单的分类判断
    let category = '餐饮美食';
    if (words.includes('交通') || words.includes('打车') || words.includes('加油')) {
      category = '交通出行';
    } else if (words.includes('娱乐') || words.includes('电影') || words.includes('游戏')) {
      category = '社交娱乐';
    } else if (words.includes('教育') || words.includes('培训') || words.includes('书籍')) {
      category = '教育培训';
    } else if (words.includes('超市') || words.includes('百货') || words.includes('生活')) {
      category = '日用百货';
    }
    
    return {
      amount,
      merchant,
      category
    };
  },

  getCategoryIndex(category) {
    return CATEGORY_OPTIONS.indexOf(category) >= 0 ? CATEGORY_OPTIONS.indexOf(category) : 0;
  },

  startRecord() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        const recorderManager = this.data.recorderManager;
        recorderManager.start({
          duration: 60000,
          sampleRate: 44100,
          numberOfChannels: 1,
          encodeBitRate: 192000,
          format: 'mp3'
        });
        this.setData({ isRecording: true });
        wx.showToast({ title: "开始录音", icon: "none" });
      },
      fail: () => {
        wx.showToast({ title: "需要录音权限才能使用语音记账功能", icon: "none" });
      }
    });
  },

  stopRecord() {
    const recorderManager = this.data.recorderManager;
    recorderManager.stop();
  },

  async recognizeVoice(filePath) {
    wx.showLoading({ title: "识别中" });
    try {
      // 获取语音识别token
      const token = await this.getSpeechToken();
      
      // 调用语音识别API
      const result = await this.callSpeechApi(filePath, token);
      
      // 填充到文本框
      this.setData({ voiceText: result });
      
      wx.showToast({ title: "识别成功", icon: "success" });
    } catch (error) {
      console.error("语音识别失败:", error);
      wx.showToast({ title: "识别失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async getSpeechToken() {
    if (!SPEECH_API_KEY || !SPEECH_SECRET_KEY) {
      throw new Error("Baidu speech credentials are not configured");
    }
    return new Promise((resolve, reject) => {
      wx.request({
        url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${SPEECH_API_KEY}&client_secret=${SPEECH_SECRET_KEY}`,
        method: 'GET',
        success: (res) => {
          if (res.data.access_token) {
            resolve(res.data.access_token);
          } else {
            reject(new Error('获取语音识别token失败'));
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  callSpeechApi(filePath, token) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `https://vop.baidu.com/server_api?dev_pid=1537&cuid=wx_miniprogram&token=${token}`,
        filePath: filePath,
        name: 'audio',
        header: {
          'Content-Type': 'audio/mp3'
        },
        formData: {
          format: 'mp3',
          rate: 44100,
          channel: 1,
          cuid: 'wx_miniprogram',
          dev_pid: 1537
        },
        success: (res) => {
          const result = JSON.parse(res.data);
          if (result.result && result.result.length > 0) {
            resolve(result.result[0]);
          } else {
            reject(new Error('语音识别失败'));
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },

  async exportCsv() {
    wx.showLoading({ title: "导出中" });
    try {
      const res = await fetchRecords({ all: true });
      const records = res.result.data.records || [];
      if (!records.length) {
        wx.showToast({ title: "暂无数据可导出", icon: "none" });
        return;
      }
      const csv = this.buildCsv(records);
      const filePath = `${wx.env.USER_DATA_PATH}/records_export.csv`;
      const fs = wx.getFileSystemManager();
      fs.writeFileSync(filePath, csv, "utf8");
      wx.openDocument({
        filePath,
        showMenu: true,
      });
      wx.showToast({ title: "已生成CSV", icon: "success" });
    } catch (error) {
      wx.showToast({ title: "导出失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  closePanels() {
    this.setData({
      showManualPanel: false,
      showVoicePanel: false,
      showDetailPanel: false,
    });
  },

  onMaskTap() {
    this.closePanels();
  },

  switchManualType(e) {
    this.setData({ manualType: e.currentTarget.dataset.type });
  },

  onManualAmountInput(e) {
    this.setData({ manualAmount: e.detail.value });
  },

  onManualCategoryChange(e) {
    this.setData({ manualCategoryIndex: Number(e.detail.value) });
  },

  onManualNoteInput(e) {
    this.setData({ manualNote: e.detail.value });
  },

  async submitManualRecord() {
    const amount = Number(this.data.manualAmount);
    if (!amount || amount <= 0) {
      wx.showToast({ title: "请输入正确金额", icon: "none" });
      return;
    }
    wx.showLoading({ title: "保存中" });
    try {
      await addRecord({
        type: this.data.manualType,
        amount,
        category: this.data.categoryOptions[this.data.manualCategoryIndex],
        note: this.data.manualNote.trim(),
        date: Date.now(),
      });
      wx.showToast({ title: "保存成功", icon: "success" });
      this.setData({
        manualAmount: "",
        manualNote: "",
        showManualPanel: false,
      });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onVoiceTextInput(e) {
    this.setData({ voiceText: e.detail.value });
  },

  async parseVoiceAndSave() {
    const text = (this.data.voiceText || "").trim();
    if (!text) {
      wx.showToast({ title: "请输入语音内容", icon: "none" });
      return;
    }
    const amountMatch = text.match(/(\d+(\.\d+)?)/);
    if (!amountMatch) {
      wx.showToast({ title: "未识别到金额", icon: "none" });
      return;
    }
    const amount = Number(amountMatch[1]);
    const category = CATEGORY_OPTIONS.find((c) => text.includes(c)) || "其他";
    const type = /(收入|进账|收到)/.test(text) ? "income" : "expense";

    wx.showLoading({ title: "保存中" });
    try {
      await addRecord({
        type,
        amount,
        category,
        note: `语音: ${text}`,
        date: Date.now(),
      });
      wx.showToast({ title: "语音记账成功", icon: "success" });
      this.setData({ voiceText: "", showVoicePanel: false });
      this.loadData();
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  setDetailFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    const all = this.data.latestRecords || [];
    const detailRecords = filter === "all" ? all : all.filter((item) => item.type === filter);
    this.setData({ detailFilter: filter, detailRecords });
  },

  buildCsv(records) {
    const header = ["日期", "类型", "分类", "金额", "备注"];
    const rows = records.map((item) => [
      this.formatDate(item.date),
      item.type === "income" ? "收入" : "支出",
      item.category || "",
      Number(item.amount || 0).toFixed(2),
      (item.note || "").replace(/,/g, "，"),
    ]);
    return [header, ...rows].map((row) => row.join(",")).join("\n");
  },

  formatDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  },
});
