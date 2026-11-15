package ai.thrones.app

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ScrollView
import android.widget.TextView
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Thrones mobile shell.
 *
 * Everything that can fail is wrapped: if the shell cannot start, the app shows the reason on
 * screen instead of closing. Network calls to AI providers run natively here, which avoids the
 * browser CORS limits. The interface itself is untouched.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private val cancelled = ConcurrentHashMap.newKeySet<String>()

    private val base = "https://appassets.androidplatform.net/assets/www/"
    private val chatUrl get() = base + "index.html"
    private val keysUrl get() = base + "setup.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { saveCrash(error) }
            previous?.uncaughtException(thread, error)
        }

        try {
            start()
            runCatching { File(filesDir, "crash.txt").delete() }
        } catch (error: Throwable) {
            runCatching { saveCrash(error) }
            showFailure(error)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun start() {
        goFullScreen()

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        runCatching { WebView.setWebContentsDebuggingEnabled(true) }

        webView = WebView(this)
        webView.setBackgroundColor(0xFF0B0B0C.toInt())
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            userAgentString = userAgentString + " ThronesApp/1.2"
        }

        webView.addJavascriptInterface(Bridge(), "ThronesNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = runCatching {
                assetLoader.shouldInterceptRequest(request.url)
            }.getOrNull()

            override fun onPageFinished(view: WebView, url: String) {
                runCatching { goFullScreen() }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                runCatching { view.destroy() }
                showFailure(RuntimeException("The web view stopped unexpectedly. Reopen the app."))
                return true
            }
        }

        webView.loadUrl(chatUrl)
    }

    /** Shows the real error instead of letting the app close silently. */
    private fun showFailure(error: Throwable) {
        val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        val text = TextView(this).apply {
            setTextColor(Color.WHITE)
            setBackgroundColor(0xFF0B0B0C.toInt())
            textSize = 13f
            setPadding(36, 96, 36, 96)
            gravity = Gravity.START
            text = "Thrones could not start.\n\n" +
                (error.message ?: error.javaClass.name) + "\n\n" +
                "Please send this text so it can be fixed:\n\n" + trace
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }

    private fun saveCrash(error: Throwable) {
        val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        File(filesDir, "crash.txt").writeText(trace)
    }

    /** Normal app layout: the system bars stay visible and the page starts below them. */
    private fun goFullScreen() {
        runCatching {
            window.setDecorFitsSystemWindows(true)
            window.insetsController?.show(WindowInsets.Type.systemBars())
        }
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                window.attributes = window.attributes.apply {
                    layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) runCatching { goFullScreen() }
    }

    /** Back walks history first; at the chat list it opens the key screen. */
    override fun onBackPressed() {
        runCatching {
            val url = webView.url ?: ""
            if (url.contains("setup.html")) {
                if (webView.canGoBack()) webView.goBack() else finish()
                return
            }
            if (webView.canGoBack()) webView.goBack() else webView.loadUrl(keysUrl)
        }.onFailure { finish() }
    }

    private fun emit(reqId: String, kind: String, payload: String) {
        val js = "window.__tn(" + JSONObject.quote(reqId) + "," + JSONObject.quote(kind) + "," +
            JSONObject.quote(payload) + ")"
        webView.post { runCatching { webView.evaluateJavascript(js, null) } }
    }

    inner class Bridge {

        /** POST on a worker thread; every response line is streamed back to the page. */
        @JavascriptInterface
        fun post(reqId: String, url: String, headersJson: String, body: String) {
            Thread {
                var conn: HttpURLConnection? = null
                try {
                    conn = URL(url).openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.connectTimeout = 30_000
                    conn.readTimeout = 600_000
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("Accept", "text/event-stream, application/json")
                    conn.setRequestProperty("Accept-Encoding", "identity")
                    runCatching {
                        val h = JSONObject(headersJson)
                        for (k in h.keys()) conn.setRequestProperty(k, h.getString(k))
                    }
                    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

                    val code = conn.responseCode
                    emit(reqId, "status", code.toString())

                    val stream = if (code in 200..299) conn.inputStream
                    else (conn.errorStream ?: conn.inputStream)

                    stream.bufferedReader(Charsets.UTF_8).use { reader ->
                        var line = reader.readLine()
                        while (line != null) {
                            if (cancelled.contains(reqId)) break
                            emit(reqId, "line", line)
                            line = reader.readLine()
                        }
                    }
                    emit(reqId, "done", "")
                } catch (e: Exception) {
                    emit(reqId, "error", e.message ?: "network error")
                } finally {
                    cancelled.remove(reqId)
                    runCatching { conn?.disconnect() }
                }
            }.start()
        }

        /** GET on a worker thread, used for provider model lists. */
        @JavascriptInterface
        fun get(reqId: String, url: String, headersJson: String) {
            Thread {
                var conn: HttpURLConnection? = null
                try {
                    conn = URL(url).openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.connectTimeout = 20_000
                    conn.readTimeout = 60_000
                    conn.setRequestProperty("Accept", "application/json")
                    conn.setRequestProperty("Accept-Encoding", "identity")
                    runCatching {
                        val h = JSONObject(headersJson)
                        for (k in h.keys()) conn.setRequestProperty(k, h.getString(k))
                    }
                    val code = conn.responseCode
                    emit(reqId, "status", code.toString())
                    val stream = if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
                    stream.bufferedReader(Charsets.UTF_8).use { reader ->
                        var line = reader.readLine()
                        while (line != null) {
                            emit(reqId, "line", line)
                            line = reader.readLine()
                        }
                    }
                    emit(reqId, "done", "")
                } catch (e: Exception) {
                    emit(reqId, "error", e.message ?: "network error")
                } finally {
                    runCatching { conn?.disconnect() }
                }
            }.start()
        }

        @JavascriptInterface
        fun cancel(reqId: String) {
            cancelled.add(reqId)
        }
    }
}
