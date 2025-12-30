const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");

const DEFAULT_OPTIONS = [
  { id: "jjajangmyeon", label: "짜장면" },
  { id: "jjamppong", label: "짬뽕" }
];

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 12;
const rateLimitMap = new Map();

const data = loadData();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/result", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "result.html"));
});

app.get("/api/results", (req, res) => {
  const voterId = getOrSetVoterId(req, res);
  res.json(buildResults(data, voterId));
});

app.post("/api/vote", (req, res) => {
  const voterId = getOrSetVoterId(req, res);
  const option = typeof req.body?.option === "string" ? req.body.option : "";

  if (!option) {
    res.status(400).json({ error: "option이 필요합니다." });
    return;
  }

  if (!data.options.some((item) => item.id === option)) {
    res.status(400).json({ error: "알 수 없는 항목입니다." });
    return;
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ error: "너무 자주 요청했습니다. 잠시 후 다시 시도해주세요." });
    return;
  }

  const previous = data.votes[voterId];
  if (!previous || previous.option !== option) {
    data.votes[voterId] = {
      option,
      updatedAt: new Date().toISOString()
    };
    data.updatedAt = new Date().toISOString();
    persistData(data);
  }

  res.json(buildResults(data, voterId));
});

app.listen(PORT, () => {
  console.log(`Poll server running on http://localhost:${PORT}`);
});

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    const fresh = {
      options: DEFAULT_OPTIONS,
      votes: {},
      updatedAt: null
    };
    persistData(fresh);
    return fresh;
  }

  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeData(parsed);
  } catch (error) {
    console.error("Failed to read data.json, recreating.", error);
    const fresh = {
      options: DEFAULT_OPTIONS,
      votes: {},
      updatedAt: null
    };
    persistData(fresh);
    return fresh;
  }
}

function normalizeData(input) {
  const normalized = {
    options: Array.isArray(input.options) && input.options.length ? input.options : DEFAULT_OPTIONS,
    votes: typeof input.votes === "object" && input.votes !== null ? input.votes : {},
    updatedAt: input.updatedAt || null
  };

  return normalized;
}

function persistData(nextData) {
  const payload = JSON.stringify(nextData, null, 2);
  const tempPath = `${DATA_PATH}.tmp`;
  fs.writeFileSync(tempPath, payload, "utf8");
  fs.renameSync(tempPath, DATA_PATH);
}

function parseCookies(header) {
  const cookies = {};
  if (!header) {
    return cookies;
  }

  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) {
      return;
    }
    cookies[key] = decodeURIComponent(rest.join("="));
  });

  return cookies;
}

function getOrSetVoterId(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  let voterId = cookies.voterId;
  if (!voterId) {
    voterId = crypto.randomUUID();
    const cookieParts = [
      `voterId=${encodeURIComponent(voterId)}`,
      "Path=/",
      "Max-Age=31536000",
      "SameSite=Lax",
      "HttpOnly"
    ];
    if (process.env.NODE_ENV === "production") {
      cookieParts.push("Secure");
    }
    res.setHeader("Set-Cookie", cookieParts.join("; "));
  }
  return voterId;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  if (!ip) {
    return true;
  }

  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

function buildResults(state, voterId) {
  const counts = {};
  state.options.forEach((item) => {
    counts[item.id] = 0;
  });

  Object.values(state.votes).forEach((vote) => {
    if (counts[vote.option] !== undefined) {
      counts[vote.option] += 1;
    }
  });

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const options = state.options.map((item) => {
    const count = counts[item.id] || 0;
    const percent = total ? Math.round((count / total) * 100) : 0;
    return {
      id: item.id,
      label: item.label,
      count,
      percent
    };
  });

  return {
    total,
    options,
    userVote: state.votes[voterId]?.option || null,
    updatedAt: state.updatedAt
  };
}
