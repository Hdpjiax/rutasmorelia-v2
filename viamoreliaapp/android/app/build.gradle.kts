import java.io.FileInputStream
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firma de release: android/key.properties + upload-keystore.jks (no se suben a git)
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()

if (hasReleaseKeystore) {
    // UTF-8 + strip BOM (PowerShell Set-Content a veces escribe EF BB BF)
    InputStreamReader(FileInputStream(keystorePropertiesFile), StandardCharsets.UTF_8).use { reader ->
        keystoreProperties.load(reader)
    }
}

fun prop(name: String): String {
    // Soporta claves con BOM residual y espacios
    val direct = keystoreProperties.getProperty(name)?.trim()
    if (!direct.isNullOrEmpty()) return direct
    for ((k, v) in keystoreProperties) {
        val key = k.toString().trim().removePrefix("\uFEFF")
        if (key == name) {
            val value = v?.toString()?.trim().orEmpty()
            if (value.isNotEmpty()) return value
        }
    }
    error(
        "key.properties: falta '$name'. " +
            "Revisa android/key.properties (storePassword, keyPassword, keyAlias, storeFile)."
    )
}

android {
    namespace = "com.viamorelia.viamoreliaapp"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.viamorelia.viamoreliaapp"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = prop("keyAlias")
                keyPassword = prop("keyPassword")
                storeFile = rootProject.file(prop("storeFile"))
                storePassword = prop("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                // Sin key.properties: permite flutter run --release local con firma debug
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
