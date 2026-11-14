/*
 * Thrones mobile cloud engine (v2).
 *
 * The UI is the original Thrones interface and is never modified. It calls /api/* exactly as
 * before; this file answers those calls and forwards the work to a cloud AI provider.
 * No local model exists in this build.
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (window.__thronesShim) return;
  window.__thronesShim = true;

  var LS = window.localStorage;
  var K_CFG = "thrones.cfg";
  var K_SET = "thrones.settings";
  var K_CONV = "thrones.conversations";
  var K_MSG = "thrones.messages";
  var K_PROJ = "thrones.projects";
  var K_MEM = "thrones.memory";

  function read(k, d) {
    try {
      var v = LS.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  }
  function write(k, v) {
    try {
      LS.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
  function uid(p) {
    return (p || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function now() {
    return Math.floor(Date.now() / 1000);
  }

  /* ------------------------------------------------------------------ providers */

  var PROVIDERS = {
    openrouter: {
      label: "OpenRouter",
      kind: "openai",
      auth: "bearer",
      base: "https://openrouter.ai/api/v1",
      keyPage: "openrouter.ai/keys",
      models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat", "qwen/qwen-2.5-72b-instruct"]
    },
    gemini: {
      label: "Google Gemini",
      kind: "gemini",
      auth: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      keyPage: "aistudio.google.com/apikey",
      models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"]
    },
    nvidia: {
      label: "NVIDIA NIM",
      kind: "openai",
      auth: "bearer",
      base: "https://integrate.api.nvidia.com/v1",
      keyPage: "build.nvidia.com",
      models: ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct", "deepseek-ai/deepseek-r1", "qwen/qwen2.5-coder-32b-instruct"]
    },
    ollama: {
      label: "Ollama",
      kind: "openai",
      auth: "bearer",
      base: "https://ollama.com/v1",
      keyPage: "ollama.com/settings/keys",
      models: ["gpt-oss:120b", "qwen3:32b", "llama3.3:70b", "deepseek-r1:70b"]
    },
    openai: {
      label: "OpenAI",
      kind: "openai",
      auth: "bearer",
      base: "https://api.openai.com/v1",
      keyPage: "platform.openai.com/api-keys",
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"]
    },
    anthropic: {
      label: "Anthropic Claude",
      kind: "anthropic",
      auth: "anthropic",
      base: "https://api.anthropic.com/v1",
      keyPage: "console.anthropic.com/settings/keys",
      models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-sonnet-4-5"]
    },
    groq: {
      label: "Groq",
      kind: "openai",
      auth: "bearer",
      base: "https://api.groq.com/openai/v1",
      keyPage: "console.groq.com/keys",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen-2.5-32b"]
    },
    mistral: {
      label: "Mistral",
      kind: "openai",
      auth: "bearer",
      base: "https://api.mistral.ai/v1",
      keyPage: "console.mistral.ai/api-keys",
      models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"]
    },
    deepseek: {
      label: "DeepSeek",
      kind: "openai",
      auth: "bearer",
      base: "https://api.deepseek.com/v1",
      keyPage: "platform.deepseek.com/api_keys",
      models: ["deepseek-chat", "deepseek-reasoner"]
    },
    xai: {
      label: "xAI Grok",
      kind: "openai",
      auth: "bearer",
      base: "https://api.x.ai/v1",
      keyPage: "console.x.ai",
      models: ["grok-2-latest", "grok-beta"]
    },
    together: {
      label: "Together AI",
      kind: "openai",
      auth: "bearer",
      base: "https://api.together.xyz/v1",
      keyPage: "api.together.ai/settings/api-keys",
      models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"]
    },
    fireworks: {
      label: "Fireworks AI",
      kind: "openai",
      auth: "bearer",
      base: "https://api.fireworks.ai/inference/v1",
      keyPage: "fireworks.ai/account/api-keys",
      models: ["accounts/fireworks/models/llama-v3p3-70b-instruct"]
    },
    sarvam: {
      label: "Sarvam AI",
      kind: "openai",
      auth: "sarvam",
      base: "https://api.sarvam.ai/v1",
      keyPage: "dashboard.sarvam.ai",
      models: ["sarvam-m"]
    },
    cohere: {
      label: "Cohere",
      kind: "openai",
      auth: "bearer",
      base: "https://api.cohere.ai/compatibility/v1",
      keyPage: "dashboard.cohere.com/api-keys",
      models: ["command-r-plus-08-2024", "command-r-08-2024"]
    },
    perplexity: {
      label: "Perplexity",
      kind: "openai",
      auth: "bearer",
      base: "https://api.perplexity.ai",
      keyPage: "perplexity.ai/settings/api",
      models: ["sonar", "sonar-pro", "sonar-reasoning"]
    },
    lmstudio: {
      label: "LM Studio (your own server)",
      kind: "openai",
      auth: "none",
      base: "http://192.168.1.10:1234/v1",
      keyPage: "lmstudio.ai",
      models: ["local-model"]
    },
    custom: {
      label: "Any other OpenAI-compatible API",
      kind: "openai",
      auth: "bearer",
      base: "",
      keyPage: "",
      models: ["default"]
    }
  };
  window.THRONES_PROVIDERS = PROVIDERS;

  function cfg() {
    var c = read(K_CFG, {});
    if (!c.providers) c.providers = {};
    return c;
  }
  function entry(id) {
    return cfg().providers[id] || {};
  }
  function activeProviders() {
    var out = [];
    var c = cfg();
    Object.keys(PROVIDERS).forEach(function (id) {
      var e = c.providers[id];
      if (e && e.enabled && (e.key || PROVIDERS[id].auth === "none")) out.push(id);
    });
    return out;
  }

  /* ------------------------------------------------------------------ settings */

  var DEFAULTS = {
    theme: "system", density: "comfortable", font_scale: 100, profile: "balanced",
    model_id: "", context_length: 32768, gpu_layers: 0, idle_unload_minutes: 0,
    temperature: null, top_p: null, top_k: null, max_tokens: 2048,
    style: "balanced", custom_instructions: "", show_reasoning: true,
    think_max_tool_calls: 0, think_time_budget_s: 120, think_token_budget: 8192,
    think_verify: false, think_reasoning_budget: 4096, offline_mode: false,
    web_research_enabled: false, search_provider: "duckduckgo", searxng_url: "",
    brave_api_key: "", research_max_sources: 4, research_max_rounds: 1,
    research_time_budget_s: 120, python_tool_enabled: false, memory_enabled: true
  };

  function settings() {
    var s = read(K_SET, {});
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = k in s ? s[k] : DEFAULTS[k];
    });
    return out;
  }
  function saveSettings(patch) {
    var s = settings();
    Object.keys(patch || {}).forEach(function (k) {
      if (k in DEFAULTS) s[k] = patch[k];
    });
    write(K_SET, s);
    return s;
  }

  /* ------------------------------------------------------------------ models */

  function modelCatalog() {
    var out = [];
    activeProviders().forEach(function (pid) {
      var p = PROVIDERS[pid];
      var e = entry(pid);
      var names = e.models && e.models.length ? e.models : p.models || [];
      names.forEach(function (m) {
        out.push({
          id: pid + ":" + m, name: m, family: p.label, publisher: p.label,
          base_repo: "", gguf_repo: "", file: "", size_bytes: 0,
          license: "provider terms", parameters: "", quantization: "cloud", tier: "high",
          native_context: 128000, notes: "Runs on " + p.label + " over the internet.",
          installed: true, loaded: false,
          compatibility: { level: "ok", message: "Cloud model - works on this phone." },
          download: null
        });
      });
    });
    return out;
  }

  function defaultModelId() {
    var ids = modelCatalog().map(function (m) {
      return m.id;
    });
    var s = settings();
    if (s.model_id && ids.indexOf(s.model_id) >= 0) return s.model_id;
    return ids[0] || "";
  }

  function splitModel(id) {
    var i = (id || "").indexOf(":");
    if (i < 0) return { provider: "", model: id || "" };
    return { provider: id.slice(0, i), model: id.slice(i + 1) };
  }

  /* ------------------------------------------------------------------ native bridge */

  var seq = 0;
  var subs = {};

  window.__tn = function (reqId, kind, payload) {
    var s = subs[reqId];
    if (!s) return;
    if (kind === "line") {
      s.lines.push(payload);
      if (s.onLine) s.onLine(payload);
    } else if (kind === "status") {
      s.status = parseInt(payload, 10) || 0;
    } else if (kind === "done") {
      delete subs[reqId];
      if (s.onDone) s.onDone(s.lines.join("\n"), s.status);
    } else if (kind === "error") {
      delete subs[reqId];
      if (s.onError) s.onError(payload);
    }
  };

  function nativePost(url, headers, body, handlers) {
    var reqId = "r" + ++seq;
    handlers.lines = [];
    handlers.status = 0;
    subs[reqId] = handlers;
    if (!window.ThronesNative || !window.ThronesNative.post) {
      delete subs[reqId];
      setTimeout(function () {
        handlers.onError("Network bridge unavailable - this build must run inside the Thrones app.");
      }, 0);
      return { cancel: function () {} };
    }
    try {
      window.ThronesNative.post(reqId, url, JSON.stringify(headers || {}), body || "");
    } catch (e) {
      delete subs[reqId];
      setTimeout(function () {
        handlers.onError(String((e && e.message) || e));
      }, 0);
    }
    return {
      cancel: function () {
        try {
          window.ThronesNative.cancel(reqId);
        } catch (e) {}
        delete subs[reqId];
      }
    };
  }

  /* ------------------------------------------------------------------ requests */

  function authHeaders(pid) {
    var e = entry(pid);
    var p = PROVIDERS[pid];
    var h = {};
    var key = e.key || "";
    if (p.auth === "anthropic") {
      if (key) h["x-api-key"] = key;
      h["anthropic-version"] = "2023-06-01";
    } else if (p.auth === "gemini") {
      if (key) h["x-goog-api-key"] = key;
    } else if (p.auth === "sarvam") {
      if (key) h["api-subscription-key"] = key;
    } else if (p.auth === "bearer") {
      if (key) h["Authorization"] = "Bearer " + key;
      if (pid === "openrouter") {
        h["HTTP-Referer"] = "https://thrones.app";
        h["X-Title"] = "Thrones Mobile";
      }
    }
    return h;
  }

  function baseUrl(pid) {
    var e = entry(pid);
    var base = (e.base || PROVIDERS[pid].base || "").replace(/\/+$/, "");
    if (pid === "perplexity" && !e.base) return "https://api.perplexity.ai";
    return base;
  }

  function buildMessages(systemPrompt, history, userText) {
    var msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    history.forEach(function (m) {
      if (!m.content) return;
      msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
    });
    msgs.push({ role: "user", content: userText });
    return msgs;
  }

  function tokenLimitBody(model, maxTokens) {
    // Reasoning models from OpenAI reject max_tokens.
    if (/^(o1|o3|o4|gpt-5)/i.test(model)) return { max_completion_tokens: maxTokens };
    return { max_tokens: maxTokens };
  }

  function providerError(status, bodyText) {
    var msg = "";
    try {
      var j = JSON.parse(bodyText);
      var e = j.error || j;
      msg = e.message || e.detail || e.msg || (typeof e === "string" ? e : "");
      if (!msg && Array.isArray(j.errors) && j.errors.length) msg = j.errors[0].message || j.errors[0];
      if (!msg && j.message) msg = j.message;
    } catch (e2) {
      msg = String(bodyText || "").slice(0, 300);
    }
    if (!msg) msg = "Provider returned HTTP " + status;
    return "HTTP " + status + ": " + msg;
  }

  /**
   * Streams a completion. onDelta/onReasoning fire per chunk; onDone/onError close it out.
   * Every failure path reports a readable message instead of an empty answer.
   */
  function streamProvider(modelId, messages, opts, onDelta, onReasoning, onDone, onError) {
    var parts = splitModel(modelId);
    var pid = parts.provider;
    var model = parts.model;
    var p = PROVIDERS[pid];

    if (!p) {
      setTimeout(function () {
        onError("No provider is connected yet. Press back to add an API key.");
      }, 0);
      return { cancel: function () {} };
    }
    var e = entry(pid);
    if (p.auth !== "none" && !e.key) {
      setTimeout(function () {
        onError(p.label + " has no API key yet. Press back and paste your key.");
      }, 0);
      return { cancel: function () {} };
    }
    if (!baseUrl(pid)) {
      setTimeout(function () {
        onError(p.label + " has no server address set. Press back and add it.");
      }, 0);
      return { cancel: function () {} };
    }

    var temperature = opts.temperature;
    var maxTokens = opts.maxTokens || 2048;
    var sawToken = false;
    var status = 0;
    var raw = [];

    function handleDelta(t) {
      if (!t) return;
      sawToken = true;
      onDelta(t);
    }

    function lineParser(line) {
      if (!line) return;
      raw.push(line);
      if (line.indexOf("data:") !== 0) return;
      var chunk = line.slice(5).trim();
      if (!chunk || chunk === "[DONE]") return;
      var j;
      try {
        j = JSON.parse(chunk);
      } catch (err) {
        return;
      }
      if (j.error) {
        onError(providerError(status || 200, chunk));
        return;
      }
      if (p.kind === "gemini") {
        var cand = j.candidates && j.candidates[0];
        var txt = cand && cand.content && cand.content.parts
          ? cand.content.parts.map(function (x) { return x.text || ""; }).join("")
          : "";
        handleDelta(txt);
        return;
      }
      if (p.kind === "anthropic") {
        if (j.type === "content_block_delta" && j.delta) {
          if (j.delta.text) handleDelta(j.delta.text);
          else if (j.delta.thinking) onReasoning(j.delta.thinking);
        }
        return;
      }
      var ch = j.choices && j.choices[0];
      if (!ch) return;
      var d = ch.delta || ch.message || {};
      if (d.reasoning_content) onReasoning(d.reasoning_content);
      if (d.content) handleDelta(typeof d.content === "string" ? d.content : "");
    }

    function finish(text, st) {
      status = st || status;
      var lines = String(text == null ? "" : text);
      if (status >= 400) {
        onError(providerError(status, lines));
        return;
      }
      if (!sawToken) {
        // Some providers answer with one plain JSON object instead of a stream.
        var joined = lines.trim();
        if (joined) {
          try {
            var j = JSON.parse(joined);
            if (p.kind === "gemini") {
              var c = j.candidates && j.candidates[0];
              var t = c && c.content && c.content.parts ? c.content.parts.map(function (x) { return x.text || ""; }).join("") : "";
              handleDelta(t);
            } else if (p.kind === "anthropic") {
              var blocks = (j.content || []).map(function (b) { return b.text || ""; }).join("");
              handleDelta(blocks);
            } else {
              var ch = j.choices && j.choices[0];
              if (ch) handleDelta((ch.message && ch.message.content) || (ch.delta && ch.delta.content) || "");
            }
          } catch (err) {
            if (!sawToken && joined.indexOf("data:") < 0) {
              onError("The provider sent a reply this app could not read.");
              return;
            }
          }
        }
      }
      onDone();
    }

    var handlers = {
      onLine: lineParser,
      onStatus: function (s) { status = s; },
      onDone: finish,
      onError: function (msg) { onError(msg); }
    };

    if (p.kind === "gemini") {
      var gBody = {
        contents: messages.filter(function (m) { return m.role !== "system"; })
          .map(function (m) {
            return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
          }),
        generationConfig: { maxOutputTokens: maxTokens }
      };
      if (temperature !== null && temperature !== undefined) gBody.generationConfig.temperature = temperature;
      var sys = messages.filter(function (m) { return m.role === "system"; });
      if (sys.length) gBody.systemInstruction = { parts: [{ text: sys[0].content }] };
      return nativePost(
        baseUrl(pid) + "/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse",
        authHeaders(pid), JSON.stringify(gBody), handlers
      );
    }

    if (p.kind === "anthropic") {
      var aBody = {
        model: model, max_tokens: maxTokens, stream: true,
        messages: messages.filter(function (m) { return m.role !== "system"; })
          .map(function (m) { return { role: m.role === "assistant" ? "assistant" : "user", content: m.content }; })
      };
      var aSys = messages.filter(function (m) { return m.role === "system"; });
      if (aSys.length) aBody.system = aSys[0].content;
      if (temperature !== null && temperature !== undefined) aBody.temperature = temperature;
      return nativePost(baseUrl(pid) + "/messages", authHeaders(pid), JSON.stringify(aBody), handlers);
    }

    var body = { model: model, stream: true, messages: messages };
    var lim = tokenLimitBody(model, maxTokens);
    Object.keys(lim).forEach(function (k) { body[k] = lim[k]; });
    if (temperature !== null && temperature !== undefined) body.temperature = temperature;
    if (opts.topP !== null && opts.topP !== undefined) body.top_p = opts.topP;

    return nativePost(baseUrl(pid) + "/chat/completions", authHeaders(pid), JSON.stringify(body), handlers);
  }

  /* ------------------------------------------------------------------ store */

  function conversations() { return read(K_CONV, []); }
  function messages() { return read(K_MSG, {}); }
  function projects() { return read(K_PROJ, []); }
  function memories() { return read(K_MEM, []); }

  function conversationById(id) {
    var all = conversations();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function touchConversation(id, patch) {
    var all = conversations();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        Object.keys(patch || {}).forEach(function (k) { all[i][k] = patch[k]; });
        all[i].updated_at = now();
      }
    }
    write(K_CONV, all);
    return conversationById(id);
  }

  /* ------------------------------------------------------------------ helpers */

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  function errResponse(detail, status) {
    return jsonResponse({ detail: detail }, status || 400);
  }

  function systemPrompt(s, mem) {
    var bits = [
      "You are Thrones, a careful assistant. Answer in the language and script the user writes in. " +
        "Show every number you compute. Never invent sources."
    ];
    if (s.style === "direct") bits.push("Be brief and direct.");
    if (s.style === "creative") bits.push("Be expressive where it helps.");
    if (s.style === "technical") bits.push("Be precise and technical, with steps.");
    if (s.custom_instructions) bits.push("User instructions: " + s.custom_instructions);
    if (s.memory_enabled && mem.length) {
      bits.push("Known facts about the user:\n" + mem.map(function (m) { return "- " + m.content; }).join("\n"));
    }
    return bits.join("\n\n");
  }

  /* ------------------------------------------------------------------ api */

  function statusPayload() {
    var s = settings();
    var mid = defaultModelId();
    var parts = splitModel(mid);
    var label = PROVIDERS[parts.provider] ? PROVIDERS[parts.provider].label : "Cloud";
    var cores = (window.navigator && navigator.hardwareConcurrency) || 4;
    var ram = (window.navigator && navigator.deviceMemory) || 4;
    return {
      app: "Thrones",
      version: "1.1.0-mobile",
      engine: {
        loaded: !!mid, loading: "", provider: "cloud", model_id: mid,
        model_name: parts.model, quantization: "cloud", context_length: s.context_length,
        gpu_layers: 0, load_seconds: 0, model_vram_mb: null, warnings: [],
        fallback: false, busy: false
      },
      hardware: {
        os: "Android", cpu: cores + " cores", cpu_cores: cores, cpu_threads: cores,
        ram_total_gb: ram, ram_available_gb: ram, gpus: [], has_gpu: false
      },
      recommended_profile: "balanced",
      resolved: {
        model_id: mid,
        model_name: mid ? parts.model + " via " + label : "No provider connected",
        context_length: s.context_length, gpu_layers: 0, profile: "balanced"
      },
      runtime_installed: true,
      paths: { data: "app storage", models: "none (cloud)", database: "app storage", uploads: "app storage" },
      profiles: {
        lite: { label: "Lite", description: "Small fast cloud models.", model_id: mid, context_length: 8192 },
        balanced: { label: "Balanced", description: "Cloud models with 32k context.", model_id: mid, context_length: 32768 },
        high: { label: "High", description: "The largest model you have a key for.", model_id: mid, context_length: 131072 }
      }
    };
  }

  function chatStreamResponse(body, signal) {
    var s = settings();
    var modelId = body.model_id || defaultModelId();
    var runId = uid("run_");
    var store = messages();
    var convId = body.conversation_id;
    var conv = convId ? conversationById(convId) : null;

    if (!conv) {
      conv = {
        id: uid("c_"), title: (body.content || "New chat").slice(0, 60),
        kind: body.mode === "research" ? "research" : "chat",
        project_id: body.project_id || null, created_at: now(), updated_at: now()
      };
      var list = conversations();
      list.unshift(conv);
      write(K_CONV, list);
      convId = conv.id;
      store[convId] = [];
      write(K_MSG, store);
    }

    var history = (store[convId] || []).slice(-20);
    if (body.regenerate && history.length) history = history.slice(0, -1);

    var userMsg = {
      id: uid("m_"), conversation_id: convId, role: "user", content: body.content,
      reasoning: "", mode: body.mode, steps: [], sources: [], metrics: {}, attachments: [],
      status: "complete", created_at: now()
    };
    var asstId = uid("m_");
    var asstMsg = {
      id: asstId, conversation_id: convId, role: "assistant", content: "", reasoning: "",
      mode: body.mode, steps: [], sources: [],
      metrics: { model_id: modelId, model_name: splitModel(modelId).model, quantization: "cloud", model_calls: 1 },
      attachments: [], status: "streaming", created_at: now()
    };

    var mem = s.memory_enabled
      ? memories().filter(function (m) { return m.enabled; })
      : [];
    var msgs = buildMessages(systemPrompt(s, mem), history, body.content);

    var stepId = uid("s_");
    var started = Date.now();
    var firstToken = null;
    var chars = 0;
    var handle = null;

    var stream = new ReadableStream({
      start: function (controller) {
        var enc = new TextEncoder();
        var closed = false;
        function send(obj) {
          if (closed) return;
          try { controller.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n")); } catch (e) {}
        }
        function finish(status, error) {
          if (closed) return;
          asstMsg.status = status;
          if (error) asstMsg.error = error;
          asstMsg.metrics.total_s = (Date.now() - started) / 1000;
          asstMsg.metrics.first_token_s = firstToken === null ? null : firstToken / 1000;
          asstMsg.metrics.completion_tokens = Math.max(1, Math.round(chars / 4));
          var st = messages();
          st[convId] = (st[convId] || []).concat([userMsg, asstMsg]);
          write(K_MSG, st);
          touchConversation(convId, {});
          send({ type: "done", status: status, message: asstMsg });
          closed = true;
          try { controller.close(); } catch (e) {}
        }

        send({ type: "run", run_id: runId });
        send({ type: "start", conversation_id: convId, user_message: userMsg, assistant_message_id: asstId, mode: body.mode });
        send({
          type: "step",
          step: {
            id: stepId, kind: "model",
            title: body.mode === "research" ? "Asking the cloud model" : "Asking the cloud model",
            detail: splitModel(modelId).model || "no provider",
            state: "running", t: started
          }
        });
        send({ type: "title", conversation_id: convId, title: conv.title });

        handle = streamProvider(
          modelId, msgs,
          { temperature: s.temperature, maxTokens: s.max_tokens, topP: s.top_p },
          function (text) {
            if (firstToken === null) firstToken = Date.now() - started;
            chars += text.length;
            asstMsg.content += text;
            send({ type: "token", text: text });
          },
          function (text) {
            if (!s.show_reasoning) return;
            asstMsg.reasoning += text;
            send({ type: "reasoning", text: text });
          },
          function () {
            send({
              type: "step",
              step: {
                id: stepId, kind: "model", title: "Answered", detail: splitModel(modelId).model,
                state: "done", t: started, t_end: Date.now()
              }
            });
            finish("complete");
          },
          function (err) {
            var msg = String(err || "The provider did not answer.");
            send({ type: "notice", message: msg });
            send({
              type: "step",
              step: {
                id: stepId, kind: "model", title: "Provider error", detail: msg,
                state: "error", t: started, t_end: Date.now()
              }
            });
            finish("error", msg);
          }
        );

        if (signal) {
          signal.addEventListener("abort", function () {
            if (handle) handle.cancel();
            finish("stopped");
          });
        }
      },
      cancel: function () {
        if (handle) handle.cancel();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });
  }

  /* ------------------------------------------------------------------ router */

  function route(path, method, init) {
    var body = {};
    if (init && init.body && typeof init.body === "string") {
      try { body = JSON.parse(init.body); } catch (e) {}
    }

    if (path === "/api/status") return jsonResponse(statusPayload());
    if (path === "/api/connectivity")
      return jsonResponse({ online: navigator.onLine !== false, reason: "" });

    if (path === "/api/settings") {
      if (method === "PATCH") return jsonResponse(saveSettings(body));
      return jsonResponse(settings());
    }
    if (path === "/api/settings/reset") {
      write(K_SET, {});
      return jsonResponse(settings());
    }

    if (path === "/api/models") {
      var mid = defaultModelId();
      return jsonResponse({
        models: modelCatalog().map(function (m) {
          m.loaded = m.id === mid;
          return m;
        })
      });
    }
    if (/^\/api\/models\/.+\/download$/.test(path))
      return jsonResponse({ state: "done", received: 0, total: 0, speed_bps: 0, error: "" });
    if (/^\/api\/models\/.+\/cancel$/.test(path)) return jsonResponse({ ok: true });
    if (/^\/api\/models\/.+$/.test(path) && method === "DELETE") return jsonResponse({ ok: true });

    if (path === "/api/engine/load" || path === "/api/engine/unload") {
      if (body.model_id) saveSettings({ model_id: body.model_id });
      return jsonResponse(statusPayload().engine);
    }

    if (path === "/api/conversations" || path.indexOf("/api/conversations?") === 0) {
      var q = "";
      var qi = path.indexOf("?search=");
      if (qi >= 0) q = decodeURIComponent(path.slice(qi + 8)).toLowerCase();
      var list = conversations().filter(function (c) {
        return !q || (c.title || "").toLowerCase().indexOf(q) >= 0;
      });
      return jsonResponse({ conversations: list, projects: projects() });
    }
    if (path === "/api/data/conversations" && method === "DELETE") {
      write(K_CONV, []);
      write(K_MSG, {});
      return jsonResponse({ ok: true });
    }

    var mConv = path.match(/^\/api\/conversations\/([^/?]+)(\/export)?$/);
    if (mConv) {
      var cid = mConv[1];
      if (mConv[2]) {
        var cv = conversationById(cid);
        var ms = (messages()[cid] || []).map(function (m) {
          return (m.role === "user" ? "**You:** " : "**Thrones:** ") + m.content;
        });
        return new Response("# " + (cv ? cv.title : "Chat") + "\n\n" + ms.join("\n\n"), {
          status: 200, headers: { "Content-Type": "text/markdown; charset=utf-8" }
        });
      }
      if (method === "DELETE") {
        write(K_CONV, conversations().filter(function (c) { return c.id !== cid; }));
        var st = messages();
        delete st[cid];
        write(K_MSG, st);
        return jsonResponse({ ok: true });
      }
      if (method === "PATCH") {
        var patch = {};
        if (typeof body.title === "string") patch.title = body.title;
        if (typeof body.project_id === "string") patch.project_id = body.project_id;
        if (body.clear_project) patch.project_id = null;
        return jsonResponse({ conversation: touchConversation(cid, patch) });
      }
      return jsonResponse({
        conversation: conversationById(cid),
        messages: messages()[cid] || [],
        documents: []
      });
    }

    if (path === "/api/projects" && method === "POST") {
      var p = { id: uid("p_"), name: body.name || "Project", created_at: now() };
      var pl = projects();
      pl.push(p);
      write(K_PROJ, pl);
      return jsonResponse(p);
    }
    var mProj = path.match(/^\/api\/projects\/([^/]+)$/);
    if (mProj) {
      var pid2 = mProj[1];
      if (method === "DELETE") {
        write(K_PROJ, projects().filter(function (x) { return x.id !== pid2; }));
        return jsonResponse({ ok: true });
      }
      write(K_PROJ, projects().map(function (x) {
        if (x.id === pid2 && body.name) x.name = body.name;
        return x;
      }));
      return jsonResponse({ ok: true });
    }

    if (path === "/api/memory") {
      if (method === "POST") {
        var mm = { id: uid("mm_"), content: body.content || "", enabled: 1, source: "user", created_at: now() };
        var ml = memories();
        ml.push(mm);
        write(K_MEM, ml);
        return jsonResponse(mm);
      }
      if (method === "DELETE") {
        write(K_MEM, []);
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ memories: memories(), enabled: settings().memory_enabled });
    }
    var mMem = path.match(/^\/api\/memory\/([^/]+)$/);
    if (mMem) {
      var mid2 = mMem[1];
      if (method === "DELETE") {
        write(K_MEM, memories().filter(function (x) { return x.id !== mid2; }));
        return jsonResponse({ ok: true });
      }
      write(K_MEM, memories().map(function (x) {
        if (x.id === mid2) {
          if (typeof body.content === "string") x.content = body.content;
          if (typeof body.enabled === "boolean") x.enabled = body.enabled ? 1 : 0;
        }
        return x;
      }));
      return jsonResponse({ ok: true });
    }

    if (path === "/api/documents") {
      if (method === "POST") return errResponse("Document Q&A is not in this mobile build yet.", 400);
      return jsonResponse({ documents: [] });
    }
    if (/^\/api\/documents\/.+$/.test(path)) return jsonResponse({ ok: true });

    if (path === "/api/chat") return chatStreamResponse(body, init.signal);
    if (/^\/api\/chat\/[^/]+\/stop$/.test(path)) return jsonResponse({ stopped: true });

    if (path === "/api/export") {
      return new Response(
        JSON.stringify({ conversations: conversations(), messages: messages(), memory: memories() }, null, 2),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return errResponse("Unknown endpoint: " + path, 404);
  }

  window.__thronesEngine = {
    route: route,
    statusPayload: statusPayload,
    modelCatalog: modelCatalog,
    streamProvider: streamProvider,
    splitModel: splitModel,
    providerError: providerError
  };

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path.indexOf("/api/") === 0) {
      var method = (init && init.method) || "GET";
      try {
        return Promise.resolve(route(path, method, init || {}));
      } catch (e) {
        return Promise.resolve(errResponse(String((e && e.message) || e), 500));
      }
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"));
  };
})();
