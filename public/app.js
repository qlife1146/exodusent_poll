const optionsEl = document.getElementById("options");
const formEl = document.getElementById("vote-form");
const statusEl = document.getElementById("status");

let latest = null;
let pending = false;

async function fetchResults() {
  const response = await fetch("/api/results");
  if (!response.ok) {
    throw new Error("결과를 불러오지 못했습니다.");
  }
  return response.json();
}

function renderOptions(data) {
  optionsEl.replaceChildren();

  data.options.forEach((item) => {
    const wrapper = document.createElement("label");
    wrapper.className = "option-card";
    wrapper.dataset.selected = item.id === data.userVote ? "true" : "false";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "option";
    input.value = item.id;
    if (item.id === data.userVote) {
      input.checked = true;
    }

    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = item.label;

    const meta = document.createElement("span");
    meta.className = "option-meta";
    meta.textContent = item.id === data.userVote ? "선택됨" : "";

    wrapper.append(input, label, meta);
    optionsEl.append(wrapper);
  });
}

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

async function refresh() {
  try {
    latest = await fetchResults();
    renderOptions(latest);
  } catch (error) {
    setStatus(error.message || "문제가 발생했습니다.", "error");
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending) {
    return;
  }

  const selected = formEl.querySelector("input[name='option']:checked");
  if (!selected) {
    setStatus("항목을 선택해주세요.", "warn");
    return;
  }

  pending = true;
  formEl.querySelector("button").disabled = true;
  setStatus("투표를 전송하는 중입니다...", "info");

  try {
    const response = await fetch("/api/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ option: selected.value })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "투표에 실패했습니다.");
    }

    latest = payload;
    renderOptions(latest);
    setStatus("투표가 반영되었습니다. 선택을 바꿀 수도 있습니다!", "success");
    window.location.href = "/result";
  } catch (error) {
    setStatus(error.message || "투표 중 문제가 발생했습니다.", "error");
  } finally {
    pending = false;
    formEl.querySelector("button").disabled = false;
  }
});

refresh();
