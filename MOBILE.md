# Thrones Mobile

A phone build of the Thrones interface. The UI is the original one, unchanged. There is no local
model: every answer comes from a cloud AI provider you add a key for.

## What is where

| Path | What it is |
|---|---|
| `frontend/` | The original UI. **Not modified.** |
| `android/` | Android shell: WebView, native HTTP bridge, key screen. |
| `android/app/src/main/assets/www/shim.js` | Answers the UI's `/api/*` calls from cloud providers. |
| `android/app/src/main/assets/www/setup.html` | Key screen, shown on first launch. |
| `.github/workflows/android.yml` | Builds signed + unsigned APKs, one per CPU architecture. |

## Install

1. Open the **Actions** tab, pick the newest *Build Thrones Mobile (APK)* run.
2. Download the artifact, or open **Releases** and take the files from there.
3. Install `...-arm64-v8a-release-signed.apk` (nearly every phone since 2017).
   Use `armeabi-v7a` for old 32-bit phones, `x86_64` for emulators and Chromebooks.
4. On first launch the app asks for provider keys. They are stored in the app's own storage.

Press the phone's back button at the chat list to open the key screen again.

## Providers

OpenRouter, Google Gemini, NVIDIA NIM, Ollama, OpenAI, Anthropic, Groq, Mistral, DeepSeek,
xAI, Together, Fireworks, Sarvam, Cohere, Perplexity, LM Studio, and any OpenAI-compatible
endpoint.

## Not in this build yet

Document Q&A (PDF/DOCX), the Python tool, and multi-step Deep Research with page fetching.
Chat, Think mode streaming, memory, history, settings, projects and export all work.
