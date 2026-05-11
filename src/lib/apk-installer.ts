import { registerPlugin } from '@capacitor/core';

export interface ApkInstallerInstallResult {
  canInstall: boolean;
  permissionRequired: boolean;
}

export interface ApkInstallerPermissionResult {
  canInstall: boolean;
}

interface ApkInstallerPlugin {
  canInstallPackages(): Promise<ApkInstallerPermissionResult>;
  openInstallPermissionSettings(): Promise<void>;
  install(options: { path: string }): Promise<ApkInstallerInstallResult>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');
