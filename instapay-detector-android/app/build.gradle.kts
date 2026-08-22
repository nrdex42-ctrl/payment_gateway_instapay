plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.instapaydetector.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.instapaydetector.app"
        // Android 8.0 (API 26) — matches the "Android 8+" requirement.
        minSdk = 26
        targetSdk = 34
        versionCode = 3
        versionName = "2.1.0"
        resValue("string", "app_name", "InstaPay Detector")
    }

    // Sign both debug and release builds with a bundled keystore so the
    // resulting APK can be installed on any Android 8+ device without
    // needing the user to manage their own keystore. For production you
    // should replace this with your own release keystore.
    signingConfigs {
        create("release") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }



    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    // AndroidX core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.cardview:cardview:1.0.0")

    // RecyclerView for efficient transaction lists
    implementation("androidx.recyclerview:recyclerview:1.3.2")

    // Fragment (for Fragment superclass in fragments)
    implementation("androidx.fragment:fragment-ktx:1.8.2")

    // SwipeRefreshLayout for pull-to-refresh
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    // Lifecycle ViewModel + LiveData for the dashboard
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.8.4")

    // MPAndroidChart for revenue charts
    implementation("com.github.PhilJay:MPAndroidChart:v3.1.0")

    // OkHttp for HTTP + WebSocket
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // JSON parsing
    implementation("org.json:json:20240303")
}
