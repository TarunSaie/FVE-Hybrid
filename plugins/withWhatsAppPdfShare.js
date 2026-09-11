const {
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULE_NAME = 'WhatsAppPdfShare';

const moduleSource = `package com.fitverse.elite

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class WhatsAppPdfShareModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "WhatsAppPdfShare"

  @ReactMethod
  fun sharePdfToContact(phone: String, fileUri: String, promise: Promise) {
    try {
      val cleanPhone = phone.filter { it.isDigit() }.let {
        if (it.length == 10) "91$it" else it
      }
      require(cleanPhone.length >= 10) { "The member does not have a valid WhatsApp phone number." }

      val whatsappPackage = listOf("com.whatsapp", "com.whatsapp.w4b").firstOrNull { packageName ->
        reactContext.packageManager.getLaunchIntentForPackage(packageName) != null
      } ?: throw IllegalStateException("WhatsApp or WhatsApp Business is not installed on this device.")

      val contentUri = getContentUri(fileUri)
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        setPackage(whatsappPackage)
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra("jid", "$cleanPhone@s.whatsapp.net")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      reactContext.grantUriPermission(
        whatsappPackage,
        contentUri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )

      if (intent.resolveActivity(reactContext.packageManager) == null) {
        throw IllegalStateException("The installed WhatsApp app cannot receive PDF documents.")
      }

      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WHATSAPP_PDF_SHARE_FAILED", error.message, error)
    }
  }

  private fun getContentUri(fileUri: String): Uri {
    val parsedUri = Uri.parse(fileUri)
    if (parsedUri.scheme == "content") return parsedUri

    val path = if (parsedUri.scheme == "file") parsedUri.path else fileUri
    val file = File(requireNotNull(path) { "The generated PDF path is invalid." })
    require(file.exists()) { "The generated PDF could not be found." }

    return FileProvider.getUriForFile(
      reactContext,
      "\${reactContext.packageName}.fileprovider",
      file,
    )
  }
}
`;

const packageSource = `package com.fitverse.elite

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WhatsAppPdfSharePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(WhatsAppPdfShareModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;

const filePathsSource = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <cache-path name="fitverse_cache" path="." />
  <files-path name="fitverse_files" path="." />
  <external-cache-path name="fitverse_external_cache" path="." />
</paths>
`;

function withWhatsAppPdfShare(config) {
  config = withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const query = manifest.queries[0] || { package: [] };
    query.package = query.package || [];

    for (const packageName of ['com.whatsapp', 'com.whatsapp.w4b']) {
      if (!query.package.some((item) => item.$?.['android:name'] === packageName)) {
        query.package.push({ $: { 'android:name': packageName } });
      }
    }

    if (!manifest.queries.length) manifest.queries.push(query);
    const application = manifest.application?.[0];
    if (!application) throw new Error('Android application manifest entry was not found.');
    application.provider = application.provider || [];

    const providerAuthority = '${applicationId}.fileprovider';
    if (!application.provider.some((item) => item.$?.['android:authorities'] === providerAuthority)) {
      application.provider.push({
        $: {
          'android:name': 'androidx.core.content.FileProvider',
          'android:authorities': providerAuthority,
          'android:exported': 'false',
          'android:grantUriPermissions': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.support.FILE_PROVIDER_PATHS',
              'android:resource': '@xml/fve_file_paths',
            },
          },
        ],
      });
    }

    return androidConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (androidConfig) => {
      const androidRoot = androidConfig.modRequest.platformProjectRoot;
      const packagePath = androidConfig.android.package.replace(/\./g, '/');
      const sourceDir = path.join(androidRoot, 'app', 'src', 'main', 'java', packagePath);
      const xmlDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
      const mainApplicationPath = path.join(sourceDir, 'MainApplication.kt');

      fs.mkdirSync(sourceDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'WhatsAppPdfShareModule.kt'), moduleSource);
      fs.writeFileSync(path.join(sourceDir, 'WhatsAppPdfSharePackage.kt'), packageSource);
      fs.writeFileSync(path.join(xmlDir, 'fve_file_paths.xml'), filePathsSource);

      const mainApplication = fs.readFileSync(mainApplicationPath, 'utf8');
      const packageRegistration = 'add(WhatsAppPdfSharePackage())';
      if (!mainApplication.includes(packageRegistration)) {
        const marker = 'PackageList(this).packages.apply {';
        if (!mainApplication.includes(marker)) {
          throw new Error('Could not register WhatsAppPdfSharePackage in MainApplication.kt.');
        }
        fs.writeFileSync(
          mainApplicationPath,
          mainApplication.replace(marker, `${marker}\n          ${packageRegistration}`)
        );
      }

      return androidConfig;
    },
  ]);
}

module.exports = createRunOncePlugin(withWhatsAppPdfShare, MODULE_NAME, '1.0.0');
