/* ============================================================
   RevPARMAX — AI Copilot panel
   Chat (live model when available, canned analyst fallback),
   pop-out floating + drag, file attach, voice input.
   ============================================================ */
(function () {
  'use strict';

  var panel = document.querySelector('[data-ai-panel]');
  if (!panel) return;

  var home    = document.querySelector('[data-ai-home]');
  var body    = panel.querySelector('[data-ai-body]');
  var text    = panel.querySelector('[data-ai-text]');
  var sendBtn = panel.querySelector('[data-ai-send]');
  var micBtn  = panel.querySelector('[data-ai-mic]');
  var attach  = panel.querySelector('[data-ai-attach]');
  var fileIn  = panel.querySelector('[data-ai-fileinput]');
  var filesEl = panel.querySelector('[data-ai-files]');
  var sugg    = panel.querySelector('[data-ai-sugg]');
  var inputWrap = panel.querySelector('[data-ai-inputwrap]');
  var head    = panel.querySelector('[data-ai-drag]');
  var popBtn  = panel.querySelector('[data-ai-pop]');
  var closeBtn= panel.querySelector('[data-ai-close]');
  var launch  = document.querySelector('[data-ai-launch]');
  var fab     = document.querySelector('[data-ai-fab]');

  var BOT_AV = '<svg viewBox="0 0 48 48" fill="none"><path d="M12 33 L24 17 L36 33" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="17" r="3.6" fill="#fff"/></svg>';
  var pendingFiles = [];

  /* ---- conversation state (priming persona kept out of the visible thread) ---- */
  var PERSONA = "You are RevPARMAX Copilot, a revenue-management assistant for a multi-property hotel group (12 properties, portfolio + per-property scope). Speak like a sharp revenue analyst: concise, specific, confident. Use the metrics of the domain — RevPAR, ADR, occupancy, pace, compression, pickup, channel mix. Reference that portfolio RevPAR is $142.80 (+8.2%), ADR $198.40, occupancy 71.9%, and that the Tech Summit Jun 4-8 is driving high compression. Keep answers under ~80 words unless asked to draft something. Never invent that you can take real actions; you suggest moves the operator can apply.";
  var apiHistory = [
    { role: 'user', content: PERSONA },
    { role: 'assistant', content: "Understood — I'm ready to help with the portfolio." },
    { role: 'assistant', content: "Morning, Sarah. Portfolio RevPAR is $142.80, up 8.2% on the prior 30 days. Compression around the Tech Summit (Jun 4-8) is running high — want me to draft rate moves for the peak nights?" }
  ];

  /* ---- canned fallback when window.claude is unavailable ---- */
  function cannedReply(q) {
    var s = q.toLowerCase();
    if (s.indexOf('revpar') > -1 && (s.indexOf('why') > -1 || s.indexOf('up') > -1))
      return "RevPAR is up 8.2% almost entirely on rate: ADR rose 2.1% while occupancy climbed 4.4%, so you're selling more rooms without discounting. The West region and the Tech Summit compression (Jun 4-8) are the biggest contributors.";
    if (s.indexOf('rate plan') > -1 || (s.indexOf('draft') > -1 && s.indexOf('jun') > -1))
      return "Draft for Jun 4-8 (high compression):\n• Jun 4 — ADR $268, +8% vs current\n• Jun 5 — ADR $278, +12% (peak)\n• Jun 6 — ADR $274, +11%\n• Jun 7 — ADR $258, +6%\nGuardrails: keep min-LOS 2 on the 5th-6th. Modeled uplift ≈ $2,771/night at 91% confidence.";
    if (s.indexOf('opportunit') > -1)
      return "Top 3 right now:\n1. Marlowe Harbor — reprice Tech Summit nights, +$4.2K\n2. The Calloway — close out OTA on the 5th, push direct\n3. Cedar Court — pace is +28% vs LY, raise floor $12.";
    if (s.indexOf('compression') > -1)
      return "Compression score is 87/100 (High) and accelerating — up 10 points in 30 days. Inventory scarcity (95) and comp sellouts (92) are the tightest signals. Translation: you have pricing power; lead with rate, not availability.";
    return "Here's what I'm seeing across the portfolio: RevPAR $142.80 (+8.2%), occupancy 71.9%, and high compression around Jun 4-8. Tell me a property or date range and I'll get specific — or ask me to draft rate moves.";
  }

  function addMsg(role, htmlContent, fileNames) {
    var el = document.createElement('div');
    el.className = 'ai-msg ' + (role === 'user' ? 'user' : 'bot');
    var av = role === 'user' ? 'SJ' : BOT_AV;
    var fileHtml = '';
    if (fileNames && fileNames.length) {
      fileHtml = '<div class="b-file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:13px;height:13px;"><path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' + fileNames.join(', ') + '</div>';
    }
    el.innerHTML = '<span class="mav">' + av + '</span><div class="ai-bub">' + htmlContent + fileHtml + '</div>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'ai-msg bot';
    el.setAttribute('data-typing', '');
    el.innerHTML = '<span class="mav">' + BOT_AV + '</span><div class="ai-bub" style="padding:0;"><div class="ai-typing"><i></i><i></i><i></i></div></div>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function toHtml(s) {
    var h = escapeHtml(s);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');   // **bold**
    h = h.replace(/(^|\n)\s*[-•]\s+/g, '$1• ');                 // normalise bullets
    h = h.replace(/\n/g, '<br>');
    return h;
  }

  async function send() {
    var q = (text.value || '').trim();
    var names = pendingFiles.slice();
    if (!q && !names.length) return;

    addMsg('user', toHtml(q || '(see attached)'), names);
    text.value = ''; autosize(); pendingFiles = []; renderFiles(); sendBtn.disabled = true;
    if (sugg) sugg.style.display = 'none';

    var promptText = q;
    if (names.length) promptText += '\n\n[Attached files: ' + names.join(', ') + ']';
    apiHistory.push({ role: 'user', content: promptText });

    var typing = showTyping();
    var reply;
    try {
      if (window.claude && typeof window.claude.complete === 'function') {
        reply = await window.claude.complete({ messages: apiHistory });
      } else {
        await new Promise(function (r) { setTimeout(r, 700 + Math.random() * 600); });
        reply = cannedReply(q);
      }
    } catch (e) {
      reply = cannedReply(q);
    }
    typing.remove();
    apiHistory.push({ role: 'assistant', content: reply });
    addMsg('bot', toHtml(reply));
    sendBtn.disabled = false;
  }

  /* ---- input behaviour ---- */
  function autosize() { text.style.height = 'auto'; text.style.height = Math.min(96, text.scrollHeight) + 'px'; }
  text.addEventListener('input', autosize);
  text.addEventListener('focus', function () { inputWrap.classList.add('focus'); });
  text.addEventListener('blur', function () { inputWrap.classList.remove('focus'); });
  text.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);

  /* ---- suggestion chips ---- */
  if (sugg) sugg.addEventListener('click', function (e) {
    var c = e.target.closest('.ai-chip');
    if (!c) return;
    text.value = c.textContent; autosize(); text.focus(); send();
  });

  /* ---- file attach ---- */
  attach.addEventListener('click', function () { fileIn.click(); });
  fileIn.addEventListener('change', function () {
    for (var i = 0; i < fileIn.files.length; i++) pendingFiles.push(fileIn.files[i].name);
    fileIn.value = ''; renderFiles();
  });
  function renderFiles() {
    filesEl.innerHTML = '';
    pendingFiles.forEach(function (name, idx) {
      var el = document.createElement('span');
      el.className = 'ai-file';
      el.innerHTML = '<svg class="fi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke-linejoin="round"/><path d="M14 3v5h5" stroke-linejoin="round"/></svg>' + escapeHtml(name) + '<button class="rm" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg></button>';
      el.querySelector('.rm').addEventListener('click', function () { pendingFiles.splice(idx, 1); renderFiles(); });
      filesEl.appendChild(el);
    });
  }

  /* ---- voice input (Web Speech API, with graceful sim) ---- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recog = null, recording = false, simTimer = null;
  micBtn.addEventListener('click', function () {
    if (recording) { stopVoice(); return; }
    recording = true; micBtn.classList.add('rec');
    text.setAttribute('placeholder', 'Listening…');
    if (SR) {
      recog = new SR(); recog.lang = 'en-US'; recog.interimResults = true;
      recog.onresult = function (ev) {
        var t = '';
        for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        text.value = t; autosize();
      };
      recog.onend = function () { stopVoice(); };
      try { recog.start(); } catch (e) { simVoice(); }
    } else {
      simVoice();
    }
  });
  function simVoice() {
    simTimer = setTimeout(function () {
      text.value = "What's driving the RevPAR lift this week?"; autosize(); stopVoice();
    }, 1900);
  }
  function stopVoice() {
    recording = false; micBtn.classList.remove('rec');
    text.setAttribute('placeholder', 'Ask about rates, pace, compression…');
    if (recog) { try { recog.stop(); } catch (e) {} recog = null; }
    if (simTimer) { clearTimeout(simTimer); simTimer = null; }
    text.focus();
  }

  /* ---- pop-out float + dock ---- */
  var floating = false;
  function setFloat(on) {
    floating = on;
    if (on) {
      document.body.appendChild(panel);
      panel.classList.add('floating');
      panel.style.right = '24px'; panel.style.bottom = '24px';
      panel.style.left = ''; panel.style.top = '';
      closeBtn.style.display = '';
    } else {
      home.appendChild(panel);
      panel.classList.remove('floating');
      panel.style.left = panel.style.top = panel.style.right = panel.style.bottom = '';
      closeBtn.style.display = 'none';
    }
    if (fab) fab.classList.toggle('hidden', on);
  }
  popBtn.addEventListener('click', function () { setFloat(!floating); });
  closeBtn.addEventListener('click', function () { setFloat(false); });
  if (launch) launch.addEventListener('click', function () {
    if (!floating) setFloat(true);
    text.focus();
  });
  if (fab) fab.addEventListener('click', function () { setFloat(true); text.focus(); });

  /* ---- global ⌘J / Ctrl+J toggle ---- */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      setFloat(!floating);
      if (floating) text.focus();
    }
  });

  /* ---- drag when floating ---- */
  var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  head.addEventListener('pointerdown', function (e) {
    if (!floating || e.target.closest('.hbtn')) return;
    dragging = true;
    var r = panel.getBoundingClientRect();
    panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px';
    panel.style.right = ''; panel.style.bottom = '';
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
    nx = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, nx));
    ny = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, ny));
    panel.style.left = nx + 'px'; panel.style.top = ny + 'px';
  });
  head.addEventListener('pointerup', function () { dragging = false; });
})();
