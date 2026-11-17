/**
 * 8-bit 小音效 —— 全部用 WebAudio 现场合成，不需要任何音频文件。
 * 星露谷式的方波 / 三角波短音，克制的音量。
 */
(function () {
  "use strict";

  var MUTE_KEY = "zsky.muted";
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (e) {
    muted = false;
  }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    if (!noiseBuf) {
      var len = Math.floor(ctx.sampleRate * 0.4);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  function tone(freq, dur, opts) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t0 + dur);
    }
    var vol = opts.vol == null ? 0.18 : opts.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, opts) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    var filter = c.createBiquadFilter();
    filter.type = opts.filter || "bandpass";
    filter.frequency.setValueAtTime(opts.freq || 1400, t0);
    filter.Q.value = 0.8;
    var gain = c.createGain();
    var vol = opts.vol == null ? 0.16 : opts.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  var api = {
    /** 用户第一次点击时调用，解锁 AudioContext（iOS 需要） */
    unlock: function () {
      ensure();
    },

    start: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (f, i) {
        tone(f, 0.1, { type: "square", vol: 0.12, delay: i * 0.085 });
      });
      tone(261.63, 0.42, { type: "triangle", vol: 0.08 });
      tone(1567.98, 0.12, { type: "triangle", vol: 0.05, delay: 0.36 });
      noise(0.2, { freq: 2600, vol: 0.06, delay: 0.3 });
    },

    switchScene: function () {
      noise(0.12, { freq: 1800, vol: 0.1 });
      tone(494, 0.06, { type: "square", vol: 0.07, to: 392 });
      tone(659, 0.05, { type: "triangle", vol: 0.05, delay: 0.07, to: 523 });
    },

    blip: function () {
      tone(988, 0.035, { vol: 0.075 });
      tone(1319, 0.045, { vol: 0.055, delay: 0.04 });
    },

    open: function () {
      tone(523.25, 0.055, { vol: 0.08 });
      tone(783.99, 0.075, { type: "triangle", vol: 0.06, delay: 0.055 });
    },

    close: function () {
      tone(440, 0.04, { vol: 0.06 });
      tone(349.23, 0.065, { type: "triangle", vol: 0.055, delay: 0.04 });
    },

    tap: function () {
      noise(0.035, { freq: 900, vol: 0.07 });
    },

    egg: function () {
      [1046.5, 1318.5, 1567.98, 2093].forEach(function (f, i) {
        tone(f, 0.07, { type: "triangle", vol: 0.06, delay: i * 0.06 });
      });
    },

    message: function () {
      [659.25, 880, 1108.73].forEach(function (f, i) {
        tone(f, 0.09, { type: "triangle", vol: 0.07, delay: i * 0.08 });
      });
    },

    error: function () {
      tone(155, 0.16, { type: "sawtooth", vol: 0.09, to: 98 });
    },

    toggle: function () {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch (e) {}
      if (!muted) {
        ensure();
        api.tap();
      }
      return muted;
    },

    isMuted: function () {
      return muted;
    },
  };

  window.SoundKit = api;
})();
