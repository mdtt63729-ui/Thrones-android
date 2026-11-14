/*
 * Thrones mobile cloud engine.
 *
 * The UI is the original Thrones interface, untouched. It talks to /api/* exactly as before;
 * this file answers those calls inside the app and forwards the work to a cloud AI provider.
 * There is no local model anywhere in this build.
 */
(function () {
  "use strict";
  if (window.__thronesShim) return;
  window.__thronesShim = true;

  var LS = window.localStorage;
  var K_CFG = "thrones.cfg";
  var K_SET = "thrones.settings";
  var K_CONV = "thrones.conversations";
  var K_MSG = "thrones.messages";
  var K_PROJ = "thrones.projects";
  var K_MEM = "thrones.memory";

  if (LS.getItem("thrones.setup_done") !== "1") {
    location.replace("setup.html");
    return;
  }

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
      base: "https://openrouter.ai/api/v1",
      keyPage: "openrouter.ai/keys",
      models: [
        "openai/gpt-4o-mini",
        "openai/gpt-4.1",
        "anthropic/claude-3.7-sonnet",
        "google/gemini-2.0-flash-001",
        "meta-llama/llama-3.3-70b-instruct",
        "deepseek/deepseek-chat",
        "qwen/qwen-2.5-72b-instruct"
      ]
    },
    gemini: {
      label: "Google Gemini",
      kind: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      keyPage: "aistudio.google.com/apikey",
      models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"]
    },
    nvidia: {
      label: "NVIDIA NIM",
      kind: "openai",
      base: "https://integrate.api.nvidia.com/v1",
      keyPage: "build.nvidia.com",
      models: [
        "meta/llama-3.3-70b-instruct",
        "nvidia/llama-3.1-nemotron-70b-instruct",
        "deepseek-ai/deepseek-r1",
        "qwen/qwen2.5-coder-32b-instruct"
      ]
    },
    ollama: {
      label: "Ollama (cloud or your own server)",
      kind: "openai",
      base: "https://ollama.com/v1",
      keyPage: "ollama.com/settings/keys",
      models: ["gpt-oss:120b", "qwen3:32b", "llama3.3:70b", "deepseek-r1:70b"]
    },
    openai: {
      label: "OpenAI",
      kind: "openai",
      base: "https://api.openai.com/v1",
      keyPage: "platform.openai.com/api-keys",
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "o4-mini"]
    },
    anthropic: {
      label: "Anthropic Claude",
      kind: "anthropic",
      base: "https://api.anthropic.com/v1",
      keyPage: "console.anthropic.com/settings/keys",
      models: ["claude-3-5-haiku-latest", "claude-3-7-sonnet-latest", "claude-sonnet-4-5"]
    },
    groq: {
      label: "Groq",
      kind: "openai",
      base: "https://api.groq.com/openai/v1",
      keyPage: "console.groq.com/keys",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen-2.5-32b"]
    },
    mistral: {
      label: "Mistral",
      kind: "openai",
      base: "https://api.mistral.ai/v1",
      keyPage: "console.mistral.ai/api-keys",
      models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"]
    },
    deepseek: {
      label: "DeepSeek",
      kind: "openai",
      base: "https://api.deepseek.com/v1",
      keyPage: "platform.deepseek.com/api_keys",
      models: ["deepseek-chat", "deepseek-reasoner"]
    },
    xai: {
      label: "xAI Grok",
      kind: "openai",
      base: "https://api.x.ai/v1",
      keyPage: "console.x.ai",
      models: ["grok-2-latest", "grok-beta"]
    },
    together: {
      label: "Together AI",
      kind: "openai",
      base: "https://api.together.xyz/v1",
      keyPage: "api.together.ai/settings/api-keys",
      models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"]
    },
    fireworks: {
      label: "Fireworks AI",
      kind: "openai",
      base: "https://api.fireworks.ai/inference/v1",
      keyPage: "fireworks.ai/account/api-keys",
      models: ["accounts/fireworks/models/llama-v3p3-70b-instruct"]
    },
    sarvam: {
      label: "Sarvam AI",
      kind: "openai",
      base: "https://api.sarvam.ai/v1",
      keyPage: "dashboard.sarvam.ai",
      models: ["sarvam-m"]
    },
    cohere: {
      label: "Cohere",
      kind: "openai",
      base: "https://api.cohere.ai/compatibility/v1",
      keyPage: "dashboard.cohere.com/api-keys",
      models: ["command-r-plus", "command-r"]
    },
    perplexity: {
      label: "Perplexity",
      kind: "openai",
      base: "https://api.perplexity.ai",
      keyPage: "perplexity.ai/settings/api",
      models: ["sonar", "sonar-pro", "sonar-reasoning"]
    },
    lmstudio: {
      label: "LM Studio (your own server)",
      kind: "openai",
      base: "http://192.168.1.10:1234/v1",
      keyPage: "lmstudio.ai",
      models: ["local-model"]
    },
    custom: {
      label: "Any other OpenAI-compatible API",
      kind: "openai",
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
  function providerEntry(id) {
    return cfg().providers[id] || {};
  }
  function activeProviders() {
    var out = [];
    var c = cfg();
    Object.keys(PROVIDERS).forEach(function (id) {
      var e = c.providers[id];
      if (e && e.enabled) out.push(id);
    });
    return out;
  }

  /* ------------------------------------------------------------------ settings */

  var DEFAULTS = {
    theme: "system",
    density: "comfortable",
    font_scale: 100,
    profile: "balanced",
    model_id: "",
    context_length: 32768,
    gpu_layers: 0,
    idle_unload_minutes: 0,
    temperature: null,
    top_p: null,
    top_k: null,
    max_tokens: 2048,
    style: "balanced",
    custom_instructions: "",
    show_reasoning: true,
    think_max_tool_calls: 0,
    think_time_budget_s: 120,
    think_token_budget: 8192,
    think_verify: false,
    think_reasoning_budget: 4096,
    offline_mode: false,
    web_research_enabled: false,
    search_provider: "duckduckgo",
    searxng_url: "",
    brave_api_key: "",
    research_max_sources: 4,
    research_max_rounds: 1,
    research_time_budget_s: 120,
    python_tool_enabled: false,
    memory_enabled: true
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

  /* ------------------------------------------------------------------ model list */

  function modelCatalog() {
    var out = [];
    activeProviders().forEach(function (pid) {
      var p = PROVIDERS[pid];
      var e = providerEntry(pid);
      var names = (e.models && e.models.length ? e.models : p.models) || [];
      names.forEach(function (m) {
        out.push({
          id: pid + ":" + m,
          name: m,
          family: p.label,
          publisher: p.label,
          base_repo: "",
          gguf_repo: "",
          file: "",
          size_bytes: 0,
          license: "provider terms",
          parameters: "",
          quantization: "cloud",
          tier: "high",
          native_context: 128000,
          notes: "Runs on " + p.label + " over the internet. Nothing is downloaded to this phone.",
          installed: true,
          loaded: false,
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
    if (i < 0) return { provider: "", model: id };
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
      if (s.onDone) s.onDone(s.lines.join("\n"));
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
        handlers.onError("This build must run inside the Thrones app.");
      }, 0);
      return { cancel: function () {} };
    }
    try {
      window.ThronesNative.post(reqId, url, JSON.stringify(headers || {}), body || "");
    } catch (e) {
      delete subs[reqId];
      setTimeout(function () {
        handlers.onError(String(e && e.message ? e.message : e));
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

  /* ------------------------------------------------------------------ provider calls */

  function authHeaders(pid) {
    var e = providerEntry(pid);
    var p = PROVIDERS[pid];
    var h = {};
    if (p.kind === "anthropic") {
      if (e.key) h["x-api-key"] = e.key;
      h["anthropic-version"] = "2023-06-01";
    } else if (p.kind === "gemini") {
      if (e.key) h["x-goog-api-key"] = e.key;
    } else {
      if (e.key) h["Authorization"] = "Bearer " + e.key;
      if (pid === "openrouter") {
        h["HTTP-Referer"] = "https://thrones.app";
        h["X-Title"] = "Thrones Mobile";
      }
    }
    return h;
  }

  function baseUrl(pid) {
    var e = providerEntry(pid);
    var base = (e.base || PROVIDERS[pid].base || "").replace(/\/+$/, "");
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

  /**
   * Streams a chat completion. onDelta(text) and onReasoning(text) fire as chunks arrive.
   * Returns a handle with cancel().
   */
  function streamProvider(modelId, messages, opts, onDelta, onReasoning, onDone, onError) {
    var parts = splitModel(modelId);
    var pid = parts.provider;
    var model = parts.model;
    var p = PROVIDERS[pid];
    if (!p) {
      setTimeout(function () {
        onError("No provider selected. Open the key screen from the app settings.");
      }, 0);
      return { cancel: function () {} };
    }
    var entry = providerEntry(pid);
    if (p.kind !== "gemini" && !entry.key && pid !== "lmstudio" && pid !== "custom") {
      setTimeout(function () {
        onError(p.label + " needs an API key. Open the key screen and add it.");
      }, 0);
      return { cancel: function () {} };
    }

    var temperature = opts.temperature;
    var maxTokens = opts.maxTokens || 2048;

    if (p.kind === "gemini") {
      var gUrl = baseUrl(pid) + "/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse";
      var gBody = {
        contents: messages
          .filter(function (m) {
            return m.role !== "system";
          })
          .map(function (m) {
            return {
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }]
            };
          }),
        generationConfig: { maxOutputTokens: maxTokens }
      };
      if (temperature !== null && temperature !== undefined) {
        gBody.generationConfig.temperature = temperature;
      }
      var sys = messages.filter(function (m) {
        return m.role === "system";
      });
      if (sys.length) gBody.systemInstruction = { parts: [{ text: sys[0].content }] };
      return nativePost(gUrl, authHeaders(pid), JSON.stringify(gBody), {
        onLine: function (line) {
          if (line.indexOf("data:") !== 0) return;
          var raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") return;
          try {
            var j = JSON.parse(raw);
            var cand = j.candidates && j.candidates[0];
            var txt = cand && cand.content && cand.content.parts ? cand.content.parts.map(function (x) {
              return x.text || "";
            }).join("") : "";
            if (txt) onDelta(txt);
          } catch (e) {}
        },
        onDone: onDone,
        onError: onError
      });
    }

    if (p.kind === "anthropic") {
      var aBody = {
        model: model,
        max_tokens: maxTokens,
        stream: true,
        messages: messages
          .filter(function (m) {
            return m.role !== "system";
          })
          .map(function (m) {
            return { role: m.role === "assistant" ? "assistant" : "user", content: m.content };
          })
      };
      var aSys = messages.filter(function (m) {
        return m.role === "system";
      });
      if (aSys.length) aBody.system = aSys[0].content;
      if (temperature !== null && temperature !== undefined) aBody.temperature = temperature;
      return nativePost(baseUrl(pid) + "/messages", authHeaders(pid), JSON.stringify(aBody), {
        onLine: function (line) {
          if (line.indexOf("data:") !== 0) return;
          try {
            var j = JSON.parse(line.slice(5).trim());
            if (j.type === "content_block_delta" && j.delta) {
              if (j.delta.text) onDelta(j.delta.text);
              else if (j.delta.thinking) onReasoning(j.delta.thinking);
            }
          } catch (e) {}
        },
        onDone: onDone,
        onError: onError
      });
    }

    // OpenAI-compatible: OpenAI, OpenRouter, NVIDIA, Ollama, Groq, Mistral, DeepSeek, xAI,
    // Together, Fireworks, Sarvam, Cohere, Perplexity, LM Studio and any custom endpoint.
    var body = {
      model: model,
      stream: true,
      max_tokens: maxTokens,
      messages: messages
    };
    if (temperature !== null && temperature !== undefined) body.temperature = temperature;
    if (opts.topP !== null && opts.topP !== undefined) body.top_p = opts.topP;

    return nativePost(baseUrl(pid) + "/chat/completions", authHeaders(pid), JSON.stringify(body), {
      onLine: function (line) {
        if (line.indexOf("data:") !== 0) return;
        var raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        try {
          var j = JSON.parse(raw);
          if (j.error) {
            onError(j.error.message || "Provider error");
            return;
          }
          var ch = j.choices && j.choices[0];
          if (!ch) return;
          var d = ch.delta || ch.message || {};
          if (d.reasoning_content) onReasoning(d.reasoning_content);
          if (d.content) onDelta(d.content);
        } catch (e) {}
      },
      onDone: onDone,
      onError: onError
    });
  }

  /* ------------------------------------------------------------------ store */

  function conversations() {
    return read(K_CONV, []);
  }
  function messages() {
    return read(K_MSG, {});
  }
  function projects() {
    return read(K_PROJ, []);
  }
  function memories() {
    return read(K_MEM, []);
  }

  function conversationById(id) {
    var all = conversations();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function touchConversation(id, patch) {
    var all = conversations();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        Object.keys(patch || {}).forEach(function (k) {
          all[i][k] = patch[k];
        });
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
    var bits = [];
    bits.push(
      "You are Thrones, a careful assistant. Answer in the language and script the user writes in. " +
        "Show every number you compute. Never invent sources."
    );
    if (s.style === "direct") bits.push("Be brief and direct.");
    if (s.style === "creative") bits.push("Be expressive where it helps.");
    if (s.style === "technical") bits.push("Be precise and technical, with steps.");
    if (s.custom_instructions) bits.push("User instructions: " + s.custom_instructions);
    if (s.memory_enabled && mem.length) {
      bits.push("Known facts about the user:\n" + mem.map(function (m) {
        return "- " + m.content;
      }).join("\n"));
    }
    return bits.join("\n\n");
  }

  /* ------------------------------------------------------------------ /api handlers */

  function statusPayload() {
    var s = settings();
    var mid = defaultModelId();
    var parts = splitModel(mid);
    var label = PROVIDERS[parts.provider] ? PROVIDERS[parts.provider].label : "Cloud";
    var cores = navigator.hardwareConcurrency || 4;
    var ram = navigator.deviceMemory || 4;
    return {
      app: "Thrones",
      version: "1.0.0-mobile",
      engine: {
        loaded: true,
        loading: "",
        provider: "cloud",
        model_id: mid,
        model_name: parts.model,
        quantization: "cloud",
        context_length: s.context_length,
        gpu_layers: 0,
        load_seconds: 0,
        model_vram_mb: null,
        warnings: [],
        fallback: false,
        busy: false
      },
      hardware: {
        os: "Android",
        cpu: cores + " cores",
        cpu_cores: cores,
        cpu_threads: cores,
        ram_total_gb: ram,
        ram_available_gb: ram,
        gpus: [],
        has_gpu: false
      },
      recommended_profile: "balanced",
      resolved: {
        model_id: mid,
        model_name: parts.model + " via " + label,
        context_length: s.context_length,
        gpu_layers: 0,
        profile: "balanced"
      },
      runtime_installed: true,
      paths: {
        data: "app storage",
        models: "none (cloud)",
        database: "app storage",
        uploads: "app storage"
      },
      profiles: {
        lite: {
          label: "Lite",
          description: "Small fast cloud models.",
          model_id: mid,
          context_length: 8192
        },
        balanced: {
          label: "Balanced",
          description: "Cloud models with 32k context.",
          model_id: mid,
          context_length: 32768
        },
        high: {
          label: "High",
          description: "The largest cloud model you have a key for.",
          model_id: mid,
          context_length: 131072
        }
      }
    };
  }

  function chatStreamResponse(body, signal) {
    var s = settings();
    var modelId = body.model_id || defaultModelId();
    var runId = uid("run_");
    var allMsgs = messages();
    var convId = body.conversation_id;
    var conv = convId ? conversationById(convId) : null;
    if (!conv) {
      conv = {
        id: uid("c_"),
        title: (body.content || "New chat").slice(0, 60),
        kind: body.mode === "research" ? "research" : "chat",
        project_id: body.project_id || null,
        created_at: now(),
        updated_at: now()
      };
      var list = conversations();
      list.unshift(conv);
      write(K_CONV, list);
      convId = conv.id;
      allMsgs[convId] = [];
      write(K_MSG, allMsgs);
    }

    var history = (allMsgs[convId] || []).slice(-20);
    if (body.regenerate && history.length) history = history.slice(0, -1);

    var userMsg = {
      id: uid("m_"),
      conversation_id: convId,
      role: "user",
      content: body.content,
      reasoning: "",
      mode: body.mode,
      steps: [],
      sources: [],
      metrics: {},
      attachments: [],
      status: "complete",
      created_at: now()
    };
    var asstId = uid("m_");
    var asstMsg = {
      id: asstId,
      conversation_id: convId,
      role: "assistant",
      content: "",
      reasoning: "",
      mode: body.mode,
      steps: [],
      sources: [],
      metrics: { model_id: modelId, model_name: splitModel(modelId).model, quantization: "cloud" },
      attachments: [],
      status: "streaming",
      created_at: now()
    };

    var mem = s.memory_enabled
      ? memories().filter(function (m) {
          return m.enabled;
        })
      : [];
    var prompt = systemPrompt(s, mem);
    var msgs = buildMessages(prompt, history, body.content);

    var stepId = uid("s_");
    var started = Date.now();
    var firstToken = null;
    var completionChars = 0;
    var handle = null;

    var stream = new ReadableStream({
      start: function (controller) {
        var enc = new TextEncoder();
        var closed = false;
        function send(obj) {
          if (closed) return;
          try {
            controller.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
          } catch (e) {}
        }
        function finish(status, error) {
          if (closed) return;
          closed = true;
          asstMsg.status = status;
          asstMsg.error = error;
          asstMsg.metrics.total_s = (Date.now() - started) / 1000;
          asstMsg.metrics.first_token_s = firstToken === null ? null : firstToken / 1000;
          asstMsg.metrics.completion_tokens = Math.max(1, Math.round(completionChars / 4));
          asstMsg.metrics.model_calls = 1;
          var store = messages();
          store[convId] = (store[convId] || []).concat([userMsg, asstMsg]);
          write(K_MSG, store);
          touchConversation(convId, {});
          send({ type: "done", status: status, message: asstMsg });
          try {
            controller.close();
          } catch (e) {}
        }

        send({ type: "run", run_id: runId });
        send({
          type: "start",
          conversation_id: convId,
          user_message: userMsg,
          assistant_message_id: asstId,
          mode: body.mode
        });
        send({
          type: "step",
          step: {
            id: stepId,
            kind: "model",
            title: body.mode === "research" ? "Asking the cloud model with web research" : "Asking the cloud model",
            detail: splitModel(modelId).model,
            state: "running",
            t: started
          }
        });
        send({ type: "title", conversation_id: convId, title: conv.title });

        handle = streamProvider(
          modelId,
          msgs,
          { temperature: s.temperature, maxTokens: s.max_tokens, topP: s.top_p },
          function (text) {
            if (firstToken === null) firstToken = Date.now() - started;
            completionChars += text.length;
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
                id: stepId,
                kind: "model",
                title: "Answered by the cloud model",
                detail: splitModel(modelId).model,
                state: "done",
                t: started,
                t_end: Date.now()
              }
            });
            finish("complete");
          },
          function (err) {
            send({
              type: "step",
              step: {
                id: stepId,
                kind: "model",
                title: "Cloud model failed",
                detail: String(err),
                state: "error",
                t: started,
                t_end: Date.now()
              }
            });
            finish("error", String(err));
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
      try {
        body = JSON.parse(init.body);
      } catch (e) {}
    }

    // ---- status / connectivity
    if (path === "/api/status") return jsonResponse(statusPayload());
    if (path === "/api/connectivity")
      return jsonResponse({
        online: navigator.onLine,
        reason: navigator.onLine ? "" : "This phone is offline."
      });

    // ---- settings
    if (path === "/api/settings") {
      if (method === "PATCH") return jsonResponse(saveSettings(body));
      return jsonResponse(settings());
    }
    if (path === "/api/settings/reset") {
      write(K_SET, {});
      return jsonResponse(settings());
    }

    // ---- models
    if (path === "/api/models") {
      var mid = defaultModelId();
      return jsonResponse({
        models: modelCatalog().map(function (m) {
          m.loaded = m.id === mid;
          return m;
        })
      });
    }
    if (/^\/api\/models\/.+\/download$/.test(path)) {
      return jsonResponse({ state: "done", received: 0, total: 0, speed_bps: 0, error: "" });
    }
    if (/^\/api\/models\/.+\/cancel$/.test(path)) return jsonResponse({ ok: true });
    if (/^\/api\/models\/.+$/.test(path) && method === "DELETE") return jsonResponse({ ok: true });

    // ---- engine (always "loaded" in cloud mode)
    if (path === "/api/engine/load" || path === "/api/engine/unload") {
      if (body.model_id) saveSettings({ model_id: body.model_id });
      return jsonResponse(statusPayload().engine);
    }

    // ---- conversations
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
    var mConv = path.match(/^\/api\/conversations\/([^/]+)(\/export)?$/);
    if (mConv) {
      var cid = mConv[1];
      if (mConv[2]) {
        var cv = conversationById(cid);
        var ms = (messages()[cid] || []).map(function (m) {
          return (m.role === "user" ? "**You:** " : "**Thrones:** ") + m.content;
        });
        return new Response("# " + (cv ? cv.title : "Chat") + "\n\n" + ms.join("\n\n"), {
          status: 200,
          headers: { "Content-Type": "text/markdown; charset=utf-8" }
        });
      }
      if (method === "DELETE") {
        write(K_CONV, conversations().filter(function (c) {
          return c.id !== cid;
        }));
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

    // ---- projects
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
        write(K_PROJ, projects().filter(function (x) {
          return x.id !== pid2;
        }));
        return jsonResponse({ ok: true });
      }
      var pl2 = projects().map(function (x) {
        if (x.id === pid2 && body.name) x.name = body.name;
        return x;
      });
      write(K_PROJ, pl2);
      return jsonResponse({ ok: true });
    }

    // ---- memory
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
        write(K_MEM, memories().filter(function (x) {
          return x.id !== mid2;
        }));
        return jsonResponse({ ok: true });
      }
      var ml2 = memories().map(function (x) {
        if (x.id === mid2) {
          if (typeof body.content === "string") x.content = body.content;
          if (typeof body.enabled === "boolean") x.enabled = body.enabled ? 1 : 0;
        }
        return x;
      });
      write(K_MEM, ml2);
      return jsonResponse({ ok: true });
    }

    // ---- documents (not part of the cloud build yet)
    if (path === "/api/documents") {
      if (method === "POST")
        return errResponse("Document Q&A is not in this mobile build yet.", 400);
      return jsonResponse({ documents: [] });
    }
    if (/^\/api\/documents\/.+$/.test(path)) return jsonResponse({ ok: true });

    // ---- chat
    if (path === "/api/chat") return chatStreamResponse(body, init.signal);
    var mStop = path.match(/^\/api\/chat\/([^/]+)\/stop$/);
    if (mStop) return jsonResponse({ stopped: true });

    if (path === "/api/export") {
      var dump = { conversations: conversations(), messages: messages(), memory: memories() };
      return new Response(JSON.stringify(dump, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return errResponse("Unknown endpoint: " + path, 404);
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url ? input.url : "";
    var path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path.indexOf("/api/") === 0) {
      var method = (init && init.method) || "GET";
      try {
        return Promise.resolve(route(path, method, init || {}));
      } catch (e) {
        return Promise.resolve(errResponse(String(e && e.message ? e.message : e), 500));
      }
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"));
  };
})();
