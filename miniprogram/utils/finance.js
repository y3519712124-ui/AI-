const LOCAL_RECORDS_KEY = "finance_records_local";
const LOCAL_GOAL_KEY = "finance_goal_local";
let cloudUnavailable = false;
let hasShownFallbackNotice = false;
let probeTimer = null;
let lastProbeAt = 0;

const getLocalRecords = () => wx.getStorageSync(LOCAL_RECORDS_KEY) || [];
const setLocalRecords = (records) => wx.setStorageSync(LOCAL_RECORDS_KEY, records);
const getLocalGoal = () => wx.getStorageSync(LOCAL_GOAL_KEY) || null;
const setLocalGoal = (goal) => wx.setStorageSync(LOCAL_GOAL_KEY, goal);

const buildDashboardFromRecords = (records) => {
  const now = new Date();
  const month = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  let income = 0;
  let expense = 0;
  records.forEach((item) => {
    const d = new Date(item.date);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      if (item.type === "income") income += Number(item.amount || 0);
      if (item.type === "expense") expense += Number(item.amount || 0);
    }
  });
  return {
    month,
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    balance: (income - expense).toFixed(2),
  };
};

const localFallback = (action, payload = {}) => {
  if (action === "addRecord") {
    const records = getLocalRecords();
    const record = payload.record || {};
    records.unshift({
      _id: `local_${Date.now()}`,
      type: record.type || "expense",
      amount: Number(record.amount || 0),
      category: record.category || "其他",
      note: record.note || "",
      date: record.date || Date.now(),
    });
    setLocalRecords(records);
    return { result: { success: true, fallback: true } };
  }

  if (action === "getRecords") {
    const records = getLocalRecords();
    const list = payload.all ? records : records.slice(0, Number(payload.limit || 20));
    return { result: { success: true, fallback: true, data: { records: list } } };
  }

  if (action === "getDashboard") {
    const records = getLocalRecords();
    return {
      result: {
        success: true,
        fallback: true,
        data: buildDashboardFromRecords(records),
      },
    };
  }

  if (action === "upsertGoal") {
    const goal = payload.goal || {};
    setLocalGoal({
      targetAmount: Number(goal.targetAmount || 0),
      currentAmount: Number(goal.currentAmount || 0),
      updatedAt: Date.now(),
    });
    return { result: { success: true, fallback: true } };
  }

  if (action === "getGoal") {
    return {
      result: {
        success: true,
        fallback: true,
        data: getLocalGoal(),
      },
    };
  }

  return { result: { success: false, fallback: true, message: "unknown action" } };
};

const scheduleCloudProbe = () => {
  const app = getApp();
  if (!app?.globalData?.env || app?.globalData?.useLocalOnly) {
    return;
  }
  if (probeTimer) {
    return;
  }
  probeTimer = setInterval(async () => {
    const now = Date.now();
    if (now - lastProbeAt < 15000) {
      return;
    }
    lastProbeAt = now;
    try {
      await wx.cloud.callFunction({
        name: "quickstartFunctions",
        data: { type: "getDashboard" },
      });
      cloudUnavailable = false;
      hasShownFallbackNotice = false;
      clearInterval(probeTimer);
      probeTimer = null;
      wx.showToast({
        title: "已恢复云端模式",
        icon: "none",
      });
    } catch (e) {
      // keep probing
    }
  }, 15000);
};

const markCloudUnavailable = () => {
  cloudUnavailable = true;
  scheduleCloudProbe();
};

const callApi = async (action, payload = {}) => {
  const app = getApp();
  if (app?.globalData?.useLocalOnly) {
    return localFallback(action, payload);
  }
  if (!app?.globalData?.env) {
    wx.showModal({
      title: "云环境未配置",
      content: "请先在 miniprogram/app.js 中填写 env（云开发环境ID）",
      showCancel: false,
    });
    throw new Error("CLOUD_ENV_MISSING");
  }

  if (cloudUnavailable) {
    return localFallback(action, payload);
  }

  try {
    const cloudCall = wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: {
        type: action,
        ...payload,
      },
    });
    const timeoutGuard = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("client timeout")), 3500);
    });
    return await Promise.race([cloudCall, timeoutGuard]);
  } catch (error) {
    const errText = `${error?.errMsg || ""} ${error?.message || ""}`.toLowerCase();
    const isTimeout =
      `${error?.errMsg || ""}`.toLowerCase().includes("timeout") ||
      `${error?.message || ""}`.toLowerCase().includes("timeout");

    if (isTimeout) {
      markCloudUnavailable();
      if (!hasShownFallbackNotice) {
        hasShownFallbackNotice = true;
        wx.showModal({
          title: "云函数超时",
          content: "已自动切换本地模式，当前可继续正常使用。",
          showCancel: false,
        });
      }
      return localFallback(action, payload);
    }

    markCloudUnavailable();
    if (!hasShownFallbackNotice) {
      hasShownFallbackNotice = true;
      wx.showToast({
        title: "云端异常，已切本地",
        icon: "none",
      });
    }
    console.error("cloud call failed, fallback to local:", errText, error);
    return localFallback(action, payload);
  }
};

const fetchDashboard = () => callApi("getDashboard");
const addRecord = (record) => callApi("addRecord", { record });
const fetchRecords = (params = {}) => callApi("getRecords", params);
const upsertGoal = (goal) => callApi("upsertGoal", { goal });
const fetchGoal = () => callApi("getGoal");
const doubaoChat = (messages) => callApi("doubaoChat", { messages });

module.exports = {
  fetchDashboard,
  addRecord,
  fetchRecords,
  upsertGoal,
  fetchGoal,
  doubaoChat,
};
