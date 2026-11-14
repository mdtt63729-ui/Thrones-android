package ai.thrones.app

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Thrones mobile shell.
 *
 * The web UI is served from https://appassets.androidplatform.net/assets/www/ so it keeps a normal
 * https origin. Every network call to an AI provider runs here, natively, which avoids browser CORS
 * limits. The UI itself is untouched: the shim script answers the api calls and talks to this bridge.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private val cancelled = ConcurrentHashMap.newKeySet<String>()

    private val base = "https://appassets.androidplatform.net/assets/www/"
    private val chatUrl get() = base + "index.html"
    private val keysUrl get() = base + "setup.html"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goFullScreen()

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

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
            userAgentString = userAgentString + " ThronesApp/1.1"
        }

        webView.addJavascriptInterface(Bridge(), "ThronesNative")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String) {
                goFullScreen()
            }
        }

        webView.loadUrl(chatUrl)
    }

    /** Edge to edge, bars hidden, swipe from an edge brings them back briefly. */
    private fun goFullScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goFullScreen()
    }

    /** Back goes through history first; at the chat list it opens the key screen. */
    override fun onBackPressed() {
        val url = webView.url ?: ""
        if (url.contains("setup.html")) {
            if (webView.canGoBack()) webView.goBack() else finish()
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            webView.loadUrl(keysUrl)
        }
    }

    private fun emit(reqId: String, kind: String, payload: String) {
        val js = "window.__tn(" + JSONObject.quote(reqId) + "," + JSONObject.quote(kind) + "," +
            JSONObject.quote(payload) + ")"
        webView.post { webView.evaluateJavascript(js, null) }
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
                    conn?.disconnect()
                }
            }.start()
        }

        @JavascriptInterface
        fun cancel(reqId: String) {
            cancelled.add(reqId)
        }
    }
}
