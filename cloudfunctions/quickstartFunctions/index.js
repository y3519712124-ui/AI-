const cloud = require("wx-server-sdk");
const https = require("https");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const RECORD_COLLECTION = "finance_records";
const GOAL_COLLECTION = "finance_goals";

const ensureCollection = async (name) => {
  try {
    await db.createCollection(name);
  } catch (e) {
    // ignore if collection already exists
  }
};

const addRecord = async (event) => {
  await ensureCollection(RECORD_COLLECTION);
  const record = event.record || {};
  const { OPENID } = cloud.getWXContext();
  await db.collection(RECORD_COLLECTION).add({
    data: {
      openid: OPENID,
      type: record.type === "income" ? "income" : "expense",
      amount: Number(record.amount || 0),
      category: record.category || "其他",
      note: record.note || "",
      date: record.date || Date.now(),
      createdAt: Date.now(),
    },
  });
  return { success: true };
};

const getRecords = async (event) => {
  await ensureCollection(RECORD_COLLECTION);
  const { OPENID } = cloud.getWXContext();
  const query = db.collection(RECORD_COLLECTION).where({ openid: OPENID }).orderBy("date", "desc");
  const all = !!event.all;
  const limit = Number(event.limit || 20);
  const result = all ? await query.limit(1000).get() : await query.limit(limit).get();
  return {
    success: true,
    data: {
      records: result.data,
    },
  };
};

const getDashboard = async () => {
  const res = await getRecords({ all: true });
  const now = new Date();
  const month = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  let income = 0;
  let expense = 0;
  (res.data.records || []).forEach((item) => {
    const d = new Date(item.date);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      if (item.type === "income") income += Number(item.amount || 0);
      if (item.type === "expense") expense += Number(item.amount || 0);
    }
  });
  return {
    success: true,
    data: {
      month,
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      balance: (income - expense).toFixed(2),
    },
  };
};

const upsertGoal = async (event) => {
  await ensureCollection(GOAL_COLLECTION);
  const { OPENID } = cloud.getWXContext();
  const goal = event.goal || {};
  const exists = await db.collection(GOAL_COLLECTION).where({ openid: OPENID }).limit(1).get();
  if (exists.data.length) {
    await db.collection(GOAL_COLLECTION).doc(exists.data[0]._id).update({
      data: {
        targetAmount: Number(goal.targetAmount || 0),
        currentAmount: Number(goal.currentAmount || 0),
        updatedAt: Date.now(),
      },
    });
  } else {
    await db.collection(GOAL_COLLECTION).add({
      data: {
        openid: OPENID,
        targetAmount: Number(goal.targetAmount || 0),
        currentAmount: Number(goal.currentAmount || 0),
        updatedAt: Date.now(),
      },
    });
  }
  return { success: true };
};

const getGoal = async () => {
  await ensureCollection(GOAL_COLLECTION);
  const { OPENID } = cloud.getWXContext();
  const result = await db.collection(GOAL_COLLECTION).where({ openid: OPENID }).limit(1).get();
  return {
    success: true,
    data: result.data[0] || null,
  };
};

const doubaoChat = async (event) => {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    return { success: false, message: "DOUBAO_API_KEY not configured" };
  }

  const payload = JSON.stringify({
    model: "doubao-seed-character-251128",
    messages: event.messages || [
      { role: "system", content: "你是人工智能助手。" },
      { role: "user", content: "你好" },
    ],
  });

  const requestOptions = {
    hostname: "ark.cn-beijing.volces.com",
    path: "/api/v3/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data || "{}");
          const content = parsed?.choices?.[0]?.message?.content || "";
          resolve({
            success: true,
            data: { content, raw: parsed },
          });
        } catch (e) {
          resolve({
            success: false,
            message: "parse doubao response failed",
            raw: data,
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        success: false,
        message: err.message || "doubao request failed",
      });
    });

    req.write(payload);
    req.end();
  });
};

exports.main = async (event, context) => {
  switch (event.type) {
    case "addRecord":
      return await addRecord(event);
    case "getRecords":
      return await getRecords(event);
    case "getDashboard":
      return await getDashboard();
    case "upsertGoal":
      return await upsertGoal(event);
    case "getGoal":
      return await getGoal();
    case "doubaoChat":
      return await doubaoChat(event);
    default:
      return { success: false, message: "unknown event type" };
  }
};
