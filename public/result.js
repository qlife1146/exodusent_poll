const resultsEl = document.getElementById("results");
const totalEl = document.getElementById("total-count");
const updatedEl = document.getElementById("updated-at");

async function fetchResults() {
  const response = await fetch("/api/results");
  if (!response.ok) {
    throw new Error("결과를 불러오지 못했습니다.");
  }
  return response.json();
}

function formatUpdatedAt(value) {
  if (!value) {
    return "업데이트 대기 중";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "업데이트 대기 중";
  }
  return `마지막 업데이트 ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderResults(data) {
  resultsEl.replaceChildren();
  totalEl.textContent = `${data.total}표`;
  updatedEl.textContent = formatUpdatedAt(data.updatedAt);

  data.options.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "result-item";
    row.dataset.selected = item.id === data.userVote ? "true" : "false";
    row.style.animationDelay = `${index * 70}ms`;

    const head = document.createElement("div");
    head.className = "result-row";

    const label = document.createElement("span");
    label.textContent = item.label;

    const stat = document.createElement("span");
    stat.textContent = `${item.count}표 · ${item.percent}%`;

    head.append(label, stat);

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${item.percent}%`;

    bar.append(fill);
    row.append(head, bar);
    resultsEl.append(row);
  });
}

async function refresh() {
  try {
    const data = await fetchResults();
    renderResults(data);
  } catch (error) {
    resultsEl.textContent = "결과를 불러오지 못했습니다.";
  }
}

refresh();
setInterval(refresh, 8000);
