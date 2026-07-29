import java.net.URI

plugins {
    id("com.android.application")
}

fun validateAppUrl(rawValue: String, label: String, requireHttps: Boolean): String {
    val normalized = rawValue.trim().trimEnd('/')
    val uri = runCatching { URI(normalized) }
        .getOrElse { throw GradleException("$label must be a valid URL", it) }
    val scheme = uri.scheme?.lowercase()

    require(scheme == "http" || scheme == "https") {
        "$label must use http or https"
    }
    require(uri.host != null && uri.userInfo == null) {
        "$label must have a host and must not contain user information"
    }
    require(uri.path == "/app" && uri.query == null && uri.fragment == null) {
        "$label must point to the exact /app path without a query or fragment"
    }
    if (requireHttps) {
        require(scheme == "https") {
            "$label must use https for release builds"
        }
    }

    return uri.toASCIIString()
}

fun quoted(value: String) = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val debugAppUrl = validateAppUrl(
    providers.gradleProperty("SONTUBE_DEBUG_APP_URL")
        .orElse(providers.gradleProperty("SONTUBE_APP_URL"))
        .orElse("http://10.0.2.2:3000/app")
        .get(),
    "SONTUBE_DEBUG_APP_URL",
    requireHttps = false,
)
val releaseAppUrlProperty = providers.gradleProperty("SONTUBE_RELEASE_APP_URL")
val releaseAppUrl = releaseAppUrlProperty.orNull?.let {
    validateAppUrl(it, "SONTUBE_RELEASE_APP_URL", requireHttps = true)
} ?: "https://invalid.invalid/app"

val validateReleaseAppUrl by tasks.registering {
    group = "verification"
    description = "Fails a release build unless SONTUBE_RELEASE_APP_URL is an exact HTTPS /app URL."
    doLast {
        val configured = releaseAppUrlProperty.orNull
            ?: throw GradleException("Set SONTUBE_RELEASE_APP_URL to the deployed HTTPS /app URL before a release build")
        validateAppUrl(configured, "SONTUBE_RELEASE_APP_URL", requireHttps = true)
    }
}

android {
    namespace = "com.sontube.client"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sontube.client"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    buildTypes {
        debug {
            buildConfigField("String", "SONTUBE_APP_URL", quoted(debugAppUrl))
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        release {
            buildConfigField("String", "SONTUBE_APP_URL", quoted(releaseAppUrl))
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseAppUrl)
}
