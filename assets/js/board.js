/**
 * 留言板：优先使用 Cloudflare Pages Functions + D1；
 * 在本地静态预览（或云端暂不可用）时自动退回 localStorage。
 */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var API = CFG.apiBase || "/api/messages";
  var LS_KEY = "zsky.messages.v2";
  var NAME_KEY = "zsky.name";
  var LIMIT = 100;
  var CONTENT_MAX = Number(CFG.messageLimit) || 120;
  var NAME_MAX = 12;

  var els = {
    sheet: document.getElementById("boardSheet"),
    list: document.getElementById("msgList"),
    count: document.getElementById("msgCount"),
    form: document.getElementById("msgForm"),
    name: document.getElementById("msgName"),
    content: document.getElementById("msgContent"),
    charCount: document.getElementById("charCount"),
    send: document.getElementById("sendBtn"),
    mode: document.getElementById("boardMode"),
    modeText: document.getElementById("boardModeText"),
    note: document.getElementById("boardNote"),
    error: document.getElementById("formError"),
    status: document.getElementById("boardStatus"),
  };

  if (!els.sheet) return;

  var mode = "idle"; // idle | loading | cloud | local
  var messages = [];
  var opened = false;
  var loaded = false;
  var loading = false;
  var submitting = false;
  var statusTimer = null;

  var isLocalPreview =
    ["localhost", "127.0.0.1", "::1", ""].indexOf(location.hostname) !== -1 ||
    location.protocol === "file:";

  function countChars(str) {
    return Array.from(String(str || "")).length;
  }

  function snd(name) {
    if (window.SoundKit && typeof window.SoundKit[name] === "function") {
      window.SoundKit[name]();
    }
  }

  function setStatus(text, warn) {
    if (!els.status) return;
    els.status.textContent = text || "";
    els.status.classList.toggle("is-warn", !!warn);
    clearTimeout(statusTimer);
    if (text) {
      statusTimer = setTimeout(function () {
        els.status.textContent = "";
      }, 3400);
    }
  }

  /* ---------------- 本地存储 ---------------- */

  function readLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocal(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, LIMIT)));
    } catch (e) {}
  }

  function saveLocal(name, content) {
    var list = readLocal();
    var msg = {
      id: "local-" + Date.now(),
      name: name,
      content: content,
      created_at: new Date().toISOString(),
    };
    list.unshift(msg);
    writeLocal(list);
    return msg;
  }

  /* ---------------- 云端接口 ---------------- */

  function fetchWithTimeout(url, options, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, ms || 7000);
    options = options || {};
    options.signal = ctrl.signal;
    return fetch(url, options).finally(function () {
      clearTimeout(timer);
    });
  }

  function parseJsonResponse(res) {
    var type = res.headers.get("content-type") || "";
    if (type.indexOf("application/json") === -1) {
      throw new Error("NOT_JSON");
    }
    return res.json().then(function (data) {
      if (!res.ok) throw new Error((data && data.error) || "HTTP_" + res.status);
      return data;
    });
  }

  async function fetchCloud() {
    var res = await fetchWithTimeout(API, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    var data = await parseJsonResponse(res);
    if (!data || !Array.isArray(data.messages)) throw new Error("BAD_PAYLOAD");
    return data.messages;
  }

  async function postCloud(name, content) {
    var res = await fetchWithTimeout(API, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ name: name, content: content }),
    });
    var data = await parseJsonResponse(res);
    if (!data || !data.message) throw new Error("BAD_PAYLOAD");
    return data.message;
  }

  /* ---------------- 渲染 ---------------- */

  function normalize(list) {
    return (Array.isArray(list) ? list : [])
      .filter(function (m) {
        return m && typeof m.content === "string" && m.content.trim();
      })
      .map(function (m, i) {
        return {
          id: m.id != null ? m.id : "m" + i,
          name: String(m.name || "匿名朋友").slice(0, 24),
          content: String(m.content).slice(0, 300),
          created_at: m.created_at || m.createdAt || "",
        };
      })
      .slice(0, LIMIT);
  }

  function parseDate(value) {
    if (!value) return null;
    var s = String(value);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      s = s.replace(" ", "T") + "Z";
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatTime(value) {
    var d = parseDate(value);
    if (!d) return "";
    var now = new Date();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var date =
      d.getFullYear() === now.getFullYear()
        ? month + "月" + day + "日"
        : d.getFullYear() + "年" + month + "月" + day + "日";
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return date + " " + hh + ":" + mm;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderMessages() {
    els.list.textContent = "";

    if (loading && !messages.length) {
      var loadingLi = el("li", "msg-empty", "正在读取留言…");
      els.list.appendChild(loadingLi);
      els.count.textContent = "—";
      return;
    }

    els.count.textContent = messages.length ? messages.length + " 条" : "还没有";

    if (!messages.length) {
      var empty = el("li", "msg-empty");
      var img = document.createElement("img");
      img.src = "assets/ui/envelope.png";
      img.alt = "";
      img.width = 38;
      empty.appendChild(img);
      empty.appendChild(document.createTextNode("还没有留言，来做第一个吧。"));
      els.list.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    messages.forEach(function (m) {
      var li = el("li", "msg");
      var top = el("div", "msg-top");
      var nameWrap = el("span", "msg-name", m.name);
      var time = el("time", "msg-time", formatTime(m.created_at));
      if (m.created_at) time.setAttribute("datetime", m.created_at);
      top.appendChild(nameWrap);
      top.appendChild(time);
      li.appendChild(top);
      li.appendChild(el("p", "msg-text", m.content));
      frag.appendChild(li);
    });
    els.list.appendChild(frag);
  }

  function setMode(kind) {
    mode = kind;
    els.mode.className = "board-mode is-" + kind;
    if (kind === "loading") {
      els.modeText.textContent = "正在连接云端…";
      els.note.textContent = "留言会保存在云端，所有拿到链接的朋友都能看到。";
    } else if (kind === "cloud") {
      els.modeText.textContent = "云端同步 · 所有人都能看到";
      els.note.textContent = "留言会保存在云端，所有拿到链接的朋友都能看到。请温柔一点 ♥";
    } else {
      els.modeText.textContent = isLocalPreview
        ? "本地预览 · 留言只保存在这台设备"
        : "云端暂不可用 · 留言只保存在这台设备";
      els.note.textContent = isLocalPreview
        ? "当前是本地预览：部署到 Cloudflare 并绑定 D1 后，留言会自动变成所有人可见的云端留言。"
        : "云端连接失败了，留言暂时只保存在你的浏览器里。";
    }
  }

  /* ---------------- 加载 / 提交 ---------------- */

  async function load() {
    if (loading) return;
    loading = true;
    setMode("loading");
    renderMessages();
    try {
      var list = await fetchCloud();
      messages = normalize(list);
      loaded = true;
      loading = false;
      setMode("cloud");
      renderMessages();
    } catch (err) {
      loading = false;
      loaded = true;
      messages = normalize(readLocal());
      setMode("local");
      renderMessages();
    }
  }

  function showFormError(text) {
    els.error.textContent = text || "";
  }

  function updateCount() {
    var n = countChars(els.content.value);
    els.charCount.textContent = n + " / " + CONTENT_MAX;
    els.charCount.classList.toggle("is-warn", n > CONTENT_MAX * 0.9);
  }

  function setBusy(busy) {
    submitting = busy;
    els.send.disabled = busy;
    els.send.textContent = busy ? "寄出中…" : "寄 出";
  }

  function validate(name, content) {
    if (!name) {
      els.name.focus();
      return "先留下你的名字吧。";
    }
    if (countChars(name) > NAME_MAX) {
      els.name.focus();
      return "名字最多 " + NAME_MAX + " 个字。";
    }
    if (!content) {
      els.content.focus();
      return "留言还是空的哦。";
    }
    if (countChars(content) > CONTENT_MAX) {
      els.content.focus();
      return "留言最多 " + CONTENT_MAX + " 个字。";
    }
    return "";
  }

  function prependMessage(m) {
    messages.unshift(m);
    messages = normalize(messages);
    renderMessages();
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    var name = els.name.value.trim().replace(/\s+/g, " ");
    var content = els.content.value.trim();
    var err = validate(name, content);
    if (err) {
      showFormError(err);
      snd("error");
      return;
    }
    showFormError("");

    setBusy(true);

    if (mode === "cloud") {
      try {
        var saved = await postCloud(name, content);
        prependMessage(normalize([saved])[0]);
        els.content.value = "";
        updateCount();
        try {
          localStorage.setItem(NAME_KEY, name);
        } catch (e2) {}
        snd("message");
        setStatus("留言已寄出 ♥ 谢谢你的祝福");
        setBusy(false);
        return;
      } catch (e3) {
        // 云端失败：退回本地，至少不让这段心意丢掉
        setMode("local");
      }
    }

    var local = saveLocal(name, content);
    prependMessage(normalize([local])[0]);
    els.content.value = "";
    updateCount();
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (e4) {}
    snd("message");
    setStatus(
      mode === "cloud" ? "留言已寄出 ♥" : "已保存在本机 · 部署后即可云端同步",
      mode !== "cloud"
    );
    setBusy(false);
  }

  /* ---------------- 打开 / 关闭 ---------------- */

  function open() {
    if (opened) return;
    opened = true;
    els.sheet.hidden = false;
    els.name.value = (function () {
      try {
        return localStorage.getItem(NAME_KEY) || "";
      } catch (e) {
        return "";
      }
    })();
    updateCount();
    showFormError("");
    setStatus("");

    requestAnimationFrame(function () {
      els.sheet.classList.add("is-open");
    });

    document.dispatchEvent(new CustomEvent("board:open"));
    snd("open");

    if (!loaded) {
      load();
    }

    if (window.matchMedia && window.matchMedia("(min-width: 680px)").matches) {
      setTimeout(function () {
        els.name.focus();
      }, 340);
    }
  }

  function close() {
    if (!opened) return;
    opened = false;
    els.sheet.classList.remove("is-open");
    snd("close");
    document.dispatchEvent(new CustomEvent("board:close"));
    setTimeout(function () {
      if (!opened) els.sheet.hidden = true;
    }, 340);
  }

  /* ---------------- 事件 ---------------- */

  els.form.addEventListener("submit", onSubmit);

  els.content.addEventListener("input", function () {
    updateCount();
    if (els.error.textContent) showFormError("");
  });

  els.name.addEventListener("input", function () {
    if (els.error.textContent) showFormError("");
  });

  els.sheet.addEventListener("click", function (e) {
    if (e.target.closest("[data-close-board]")) {
      e.preventDefault();
      close();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && opened) close();
  });

  window.GuestBook = {
    open: open,
    close: close,
    isOpen: function () {
      return opened;
    },
    load: load,
  };
})();
