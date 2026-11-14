package ai.thrones.app

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
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
 * The web UI is served from https://appassets.androidplatform.net/assets/www/ so that it keeps a
 * normal https origin. Every network call to an AI provider is executed here, natively, which
 * avoids browser CORS limits entirely. The UI itself is not modified: a shim script patches
 * window.fetch for the api routes and speaks to this bridge.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private val cancelled = ConcurrentHashMap.newKeySet<String>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
            userAgentString = userAgentString + " ThronesApp/1.0"
        }

        webView.addJavascriptInterface(Bridge(), "ThronesNative")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
        }

        webView.loadUrl("https://appassets.androidplatform.net/assets/www/setup.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun emit(reqId: String, kind: String, payload: String) {
        val js = "window.__tn(" + JSONObject.quote(reqId) + "," + JSONObject.quote(kind) + "," +
            JSONObject.quote(payload) + ")"
        webView.post { webView.evaluateJavascript(js, null) }
    }

    inner class Bridge {

        /** Blocking-free POST executed on a worker thread; each response line is streamed back. */
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
