plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ai.thrones.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "ai.thrones.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 9
        versionName = "1.8.0"
    }

    // One APK per CPU architecture - never a universal APK.
    splits {
        abi {
            isEnable = true
            reset()
            include("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
            isUniversalApk = false
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources.excludes += setOf("META-INF/*.kotlin_module") }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
