package id.alaalakasir.app;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.List;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("canInstall", canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Gagal membuka pengaturan izin install", exception);
        }
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("path harus diisi");
            return;
        }

        if (!canRequestPackageInstalls()) {
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            result.put("canInstall", false);
            call.resolve(result);
            return;
        }

        try {
            Uri uri = getUriByPath(path);
            Intent intent = createInstallIntent(uri, Intent.ACTION_INSTALL_PACKAGE);
            boolean launched = startInstallerIntent(intent, uri);

            if (!launched) {
                Intent fallbackIntent = createInstallIntent(uri, Intent.ACTION_VIEW);
                launched = startInstallerIntent(fallbackIntent, uri);
            }

            if (!launched) {
                call.reject("Tidak ada installer APK yang bisa dibuka");
                return;
            }

            JSObject result = new JSObject();
            result.put("permissionRequired", false);
            result.put("canInstall", true);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Gagal membuka installer APK", exception);
        }
    }

    private Intent createInstallIntent(@NonNull Uri uri, @NonNull String action) {
        Intent intent = new Intent(action);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
        intent.setClipData(ClipData.newRawUri("APK update", uri));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return intent;
    }

    private boolean startInstallerIntent(@NonNull Intent intent, @NonNull Uri uri) {
        PackageManager packageManager = getContext().getPackageManager();
        List<ResolveInfo> installers = packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        if (installers == null || installers.isEmpty()) return false;

        for (ResolveInfo installer : installers) {
            String packageName = installer.activityInfo.packageName;
            getContext().grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }

        getActivity().startActivity(intent);
        return true;
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private Uri getUriByPath(@NonNull String path) {
        Uri uri = Uri.parse(path);
        String scheme = uri.getScheme();

        if (ContentResolver.SCHEME_CONTENT.equals(scheme)) {
            return uri;
        }

        File file;
        if (scheme == null || ContentResolver.SCHEME_FILE.equals(scheme)) {
            file = new File(uri.getPath());
        } else {
            file = new File(path);
        }

        return FileProvider.getUriForFile(
            getActivity(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
    }
}
