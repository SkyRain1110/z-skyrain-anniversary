/**
 * 主逻辑：封面、场景循环、对话计时、滑动、彩蛋、天数、声音开关。
 */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var cover = $("#cover");
  var stage = $("#stage");
  var scenes = $$(".scene");
  var dots = $$("#dots .dot");
  var captionEl = $("#sceneCaption");
  var captionText = $("#captionText");
  var dayNum = $("#dayNum");
  var startBtn = $("#startBtn");
  var soundBtn = $("#soundBtn");
  var boardBtn = $("#boardBtn");
  var prevBtn = $("#prevBtn");
  var nextBtn = $("#nextBtn");
  var toastEl = $("#toast");

  var current = 0;
  var running = false;
  var animating = false;
  var locked = false;
  var activeModal = null;
  var sceneDlgTimer = null;

  var DURATION = Math.max(3, Number(CFG.dialogueSeconds) || 10) * 1000;

  /* =========================================================
     天数
     ========================================================= */

  function calcDays() {
    var startParts = String(CFG.startDate || "2025-11-19").split("-").map(Number);
    var start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(1, diff);
  }

  function paintDays() {
    if (!dayNum) return;
    var days = calcDays();
    dayNum.textContent = String(days);
    var label = $(".day-label");
    var now = new Date();
    var startParts = String(CFG.startDate || "2025-11-19").split("-").map(Number);
    if (
      label &&
      now.getMonth() === startParts[1] - 1 &&
      now.getDate() === startParts[2] &&
      now.getFullYear() > startParts[0]
    ) {
      label.textContent = "一周年";
    }
  }

  function paintSignDate() {
    var signDate = $(".sign-date");
    if (!signDate) return;
    var p = String(CFG.startDate || "2025-11-19").split("-").map(Number);
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    signDate.textContent =
      p[0] + "." + pad(p[1]) + "." + pad(p[2]) +
      "\u00a0—\u00a0" +
      (p[0] + 1) + "." + pad(p[1]) + "." + pad(p[2]);
  }

  paintDays();
  paintSignDate();

  /* =========================================================
     Toast
     ========================================================= */

  var toastTimer = null;

  function toast(text, ms) {
    if (!toastEl || !text) return;
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-on");
    }, ms || 2200);
  }

  document.addEventListener("ui:toast", function (e) {
    if (e.detail && e.detail.text) toast(e.detail.text, e.detail.ms);
  });

  /* =========================================================
     对话框调度
     ========================================================= */

  var dlg = {
    scene: null,
    index: 0,
    count: 0,
    timer: null,
    startedAt: 0,
    remaining: DURATION,
    paused: false,
  };

  function groupsOf(scene) {
    return $$(".dialogue-group", scene);
  }

  function paintGroup(scene, index) {
    var groups = groupsOf(scene);
    groups.forEach(function (g, i) {
      g.classList.toggle("is-active", i === index);
    });
  }

  function clearDlgTimer() {
    if (dlg.timer) {
      clearTimeout(dlg.timer);
      dlg.timer = null;
    }
  }

  function hideDialogueGroups(scene) {
    if (!scene) return;
    $$(".dialogue-group", scene).forEach(function (group) {
      group.classList.remove("is-active");
    });
  }

  function armDlg() {
    clearDlgTimer();
    if (!running || dlg.paused || !dlg.scene) return;
    if (dlg.count < 2) return;
    dlg.startedAt = performance.now();
    dlg.timer = setTimeout(advanceDlg, Math.max(400, dlg.remaining));
  }

  function advanceDlg() {
    if (!running || dlg.paused || !dlg.scene) return;
    dlg.index = (dlg.index + 1) % dlg.count;
    paintGroup(dlg.scene, dlg.index);
    if (window.SoundKit) window.SoundKit.blip();
    dlg.remaining = DURATION;
    armDlg();
  }

  function startDlg(scene) {
    clearDlgTimer();
    dlg.scene = scene;
    dlg.index = 0;
    dlg.count = groupsOf(scene).length;
    dlg.remaining = DURATION;
    dlg.paused = false;

    if (!dlg.count) return;
    paintGroup(scene, 0);
    dlg.startedAt = performance.now();

    setTimeout(function () {
      if (running && dlg.scene === scene && !dlg.paused && window.SoundKit) {
        window.SoundKit.blip();
      }
    }, 260);

    armDlg();
    if (anyOverlayOpen()) pauseDlg();
  }

  function pauseDlg() {
    if (dlg.paused) return;
    dlg.paused = true;
    if (dlg.timer) {
      clearTimeout(dlg.timer);
      dlg.timer = null;
      dlg.remaining -= performance.now() - dlg.startedAt;
    }
  }

  function resumeDlg() {
    if (!dlg.paused) return;
    dlg.paused = false;
    if (dlg.remaining <= 0) dlg.remaining = DURATION;
    armDlg();
  }

  /* =========================================================
     场景切换
     ========================================================= */

  function anyOverlayOpen() {
    var boardOpen = !!(window.GuestBook && window.GuestBook.isOpen && window.GuestBook.isOpen());
    return boardOpen || !!activeModal;
  }

  function updateChrome(index) {
    var scene = scenes[index];
    if (!scene) return;
    dots.forEach(function (dot, i) {
      dot.classList.toggle("is-on", i === index);
    });
    scenes.forEach(function (s, i) {
      s.setAttribute("aria-hidden", i === index ? "false" : "true");
    });
    if (captionEl && captionText) {
      captionText.textContent =
        (scene.dataset.no || String(index + 1).padStart(2, "0")) +
        " · " +
        (scene.dataset.caption || "");
      if (typeof captionEl.animate === "function") {
        captionEl.animate(
          [
            { opacity: 0, transform: "translateX(-50%) translateY(-4px)" },
            { opacity: 1, transform: "translateX(-50%)" },
          ],
          { duration: 240, easing: "ease-out" }
        );
      }
    }
  }

  function switchScene(dir) {
    if (!running || animating || anyOverlayOpen()) return;
    var next = (current + dir + scenes.length) % scenes.length;
    if (next === current) return;

    animating = true;
    if (window.SoundKit) window.SoundKit.switchScene();

    var oldEl = scenes[current];
    var newEl = scenes[next];
    var forward = dir > 0;
    var enterClass = forward ? "enter-next" : "enter-prev";
    var leaveClass = forward ? "leave-next" : "leave-prev";

    clearDlgTimer();
    hideDialogueGroups(oldEl);
    oldEl.classList.add(leaveClass);
    newEl.classList.add("is-active", enterClass);
    current = next;
    updateChrome(next);

    clearTimeout(sceneDlgTimer);
    sceneDlgTimer = setTimeout(function () {
      startDlg(newEl);
    }, 300);

    setTimeout(function () {
      hideDialogueGroups(oldEl);
      oldEl.classList.remove("is-active", leaveClass);
      newEl.classList.remove(enterClass);
      animating = false;
    }, 360);
  }

  function enterWorld() {
    running = true;
    stage.classList.add("is-on");
    stage.setAttribute("aria-hidden", "false");
    scenes[0].classList.add("is-active");
    current = 0;
    updateChrome(0);
    startDlg(scenes[0]);
  }

  if (startBtn) {
    startBtn.addEventListener("click", function () {
      if (running || locked) return;
      if (window.SoundKit) {
        window.SoundKit.unlock();
        window.SoundKit.start();
      }
      cover.classList.add("is-leaving");
      enterWorld();
      setTimeout(function () {
        cover.hidden = true;
      }, 640);
      setTimeout(function () {
        toast("点两侧箭头，或左右滑动切换场景", 2600);
      }, 1000);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      switchScene(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      switchScene(1);
    });
  }

  /* =========================================================
     左右滑动
     ========================================================= */

  var swipe = null;

  stage.addEventListener(
    "pointerdown",
    function (e) {
      if (!running) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("button, a, input, textarea, .sheet, .modal")) return;
      swipe = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerup",
    function (e) {
      if (!swipe || e.pointerId !== swipe.id) return;
      var dx = e.clientX - swipe.x;
      var dy = e.clientY - swipe.y;
      var dt = performance.now() - swipe.t;
      swipe = null;
      if (
        dt < 750 &&
        Math.abs(dx) > 46 &&
        Math.abs(dx) > Math.abs(dy) * 1.25
      ) {
        switchScene(dx < 0 ? 1 : -1);
      }
    },
    { passive: true }
  );

  window.addEventListener("pointercancel", function () {
    swipe = null;
  });

  /* =========================================================
     键盘
     ========================================================= */

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (activeModal) {
        closeModal(activeModal);
      } else if (window.GuestBook && window.GuestBook.isOpen()) {
        window.GuestBook.close();
      }
      return;
    }
    if (!running) return;
    if (e.target && e.target.closest && e.target.closest("input, textarea")) return;
    if (anyOverlayOpen()) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      switchScene(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      switchScene(1);
    }
  });

  /* =========================================================
     彩蛋弹窗
     ========================================================= */

  function openModal(modal) {
    if (!modal) return;
    if (activeModal) closeModal(activeModal, true);
    activeModal = modal;
    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
    pauseDlg();
    if (window.SoundKit) window.SoundKit.egg();
  }

  function closeModal(modal, immediate) {
    if (!modal) return;
    modal.classList.remove("is-open");
    if (immediate) {
      modal.hidden = true;
    } else {
      setTimeout(function () {
        modal.hidden = true;
      }, 250);
    }
    if (activeModal === modal) activeModal = null;
    if (window.SoundKit) window.SoundKit.close();
    if (!(window.GuestBook && window.GuestBook.isOpen())) resumeDlg();
  }

  $$(".modal").forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close-modal]")) {
        e.preventDefault();
        closeModal(modal);
      }
    });
  });

  var letterProp = $("#letterProp");
  var swordProp = $("#swordProp");

  if (letterProp) {
    letterProp.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal($("#letterModal"));
    });
  }

  if (swordProp) {
    swordProp.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal($("#swordModal"));
    });
  }

  document.addEventListener("board:open", function () {
    pauseDlg();
    if (toastEl) {
      toastEl.classList.remove("is-on");
      clearTimeout(toastTimer);
    }
  });
  document.addEventListener("board:close", function () {
    if (!activeModal) resumeDlg();
  });

  /* =========================================================
     声音开关
     ========================================================= */

  function syncSound() {
    if (!window.SoundKit || !soundBtn) return;
    var muted = window.SoundKit.isMuted();
    soundBtn.classList.toggle("is-muted", muted);
    soundBtn.setAttribute("aria-pressed", String(!muted));
    soundBtn.setAttribute("aria-label", muted ? "打开声音" : "关闭声音");
  }

  syncSound();

  if (soundBtn) {
    soundBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!window.SoundKit) return;
      window.SoundKit.unlock();
      window.SoundKit.toggle();
      syncSound();    });
  }

  if (boardBtn) {
    boardBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (window.GuestBook) window.GuestBook.open();
    });
  }

  /* =========================================================
     访问口令（可选）
     ========================================================= */

  var lockScreen = $("#lockScreen");
  var lockForm = $("#lockForm");
  var lockInput = $("#lockInput");
  var lockError = $("#lockError");
  var accessCode = String(CFG.accessCode || "").trim();

  (function initLock() {
    if (!accessCode) {
      if (lockScreen) lockScreen.hidden = true;
      return;
    }
    var unlocked = false;
    try {
      unlocked = sessionStorage.getItem("zsky.unlocked") === "1";
    } catch (e) {}
    if (unlocked) {
      locked = false;
      if (lockScreen) lockScreen.hidden = true;
      return;
    }
    locked = true;
    if (lockScreen) lockScreen.hidden = false;
    if (
      lockInput &&
      window.matchMedia &&
      window.matchMedia("(min-width: 680px)").matches
    ) {
      setTimeout(function () {
        lockInput.focus();
      }, 350);
    }
  })();

  if (lockForm) {
    lockForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!accessCode) return;
      var value = lockInput ? lockInput.value.trim() : "";
      if (value === accessCode) {
        locked = false;
        try {
          sessionStorage.setItem("zsky.unlocked", "1");
        } catch (e2) {}
        if (window.SoundKit) window.SoundKit.egg();
        if (lockScreen) {
          lockScreen.classList.add("is-opening");
          setTimeout(function () {
            lockScreen.hidden = true;
          }, 500);
        }
        toast("欢迎进来 ♥", 2000);
      } else {
        if (lockError) lockError.textContent = "口令不对，再想想？";
        if (window.SoundKit) window.SoundKit.error();
        if (lockScreen) {
          lockScreen.classList.remove("is-shake");
          void lockScreen.offsetWidth;
          lockScreen.classList.add("is-shake");
        }
        if (lockInput) {
          lockInput.select();
        }
      }
    });
  }

  /* =========================================================
     页面可见性 & 预加载
     ========================================================= */

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      pauseDlg();
    } else if (!anyOverlayOpen()) {
      resumeDlg();
    }
  });

  var warmup = [
    "assets/img/scene-gate.webp",
    "assets/img/scene-date.webp",
    "assets/img/scene-river.webp",
    "assets/img/boy.webp",
    "assets/img/kuromi.webp",
    "assets/img/sword.webp",
    "assets/img/letter.webp",
  ];
  warmup.forEach(function (src) {
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      if (typeof img.decode === "function") {
        img.decode().catch(function () {});
      }
    };
    img.src = src;
  });
  $$(".scene-bg img, .char > img, .prop img, .letter-frame img, .sword-frame img").forEach(function (img) {
    if (typeof img.decode === "function") {
      img.decode().catch(function () {});
    }
  });

  // 预置初始状态
  scenes.forEach(function (s, i) {
    s.setAttribute("aria-hidden", i === 0 ? "false" : "true");
    if (i !== 0) {
      $$(".dialogue-group", s).forEach(function (g) {
        g.classList.remove("is-active");
      });
    }
  });
  updateChrome(0);
})();
