import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const APP_REPOSITORY = 'ketanvpn/alaalakasir';
export const CURRENT_APP_VERSION = __APP_VERSION__;
export const GITHUB_RELEASES_URL = `https://github.com/${APP_REPOSITORY}/releases`;

interface GitHubTag {
  name: string;
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

function selectApkAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  const apkAssets = (assets || []).filter(asset => asset.name && asset.name.toLowerCase().endsWith('.apk'));
  if (apkAssets.length === 0) return null;

  const preferredAsset = apkAssets.find(asset => {
    const name = asset.name.toLowerCase();
    return name.includes('release') && !name.includes('unsigned');
  });

  return preferredAsset ?? apkAssets[0];
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  apkUrl: string | null;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function parseVersion(version: string): number[] {
  return normalizeVersion(version)
    .split(/[.-]/)
    .map(part => Number.parseInt(part, 10))
    .map(part => (Number.isFinite(part) ? part : 0));
}

function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const leftPart = left[i] ?? 0;
    const rightPart = right[i] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

async function fetchJsonWithFallback<T>(url: string, timeoutMs = 15000): Promise<{ status: number; data: T | null }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const nativeRes = await CapacitorHttp.get({
        url,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'AlaalaKasir-App',
        },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });

      return {
        status: nativeRes.status,
        data: (nativeRes.data as T) || null,
      };
    } catch {
      // Fallback to window.fetch
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }

    return {
      status: res.status,
      data,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  try {
    const latestRelease = await fetchJsonWithFallback<GitHubRelease>(
      `https://api.github.com/repos/${APP_REPOSITORY}/releases/latest`
    );

    if (latestRelease.status === 200 && latestRelease.data && latestRelease.data.tag_name) {
      const release = latestRelease.data;
      const apkAsset = selectApkAsset(release.assets);

      return {
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: release.tag_name,
        updateAvailable: compareVersions(CURRENT_APP_VERSION, release.tag_name) < 0,
        releaseUrl: release.html_url || `${GITHUB_RELEASES_URL}/tag/${release.tag_name}`,
        apkUrl: apkAsset?.browser_download_url ?? null,
      };
    }

    const tagsRes = await fetchJsonWithFallback<GitHubTag[]>(
      `https://api.github.com/repos/${APP_REPOSITORY}/tags`
    );

    if (tagsRes.status === 200 && Array.isArray(tagsRes.data)) {
      const tags = tagsRes.data;
      const latestTag = tags.find(tag => /^v?\d+\.\d+\.\d+$/.test(tag.name));
      const latestVersion = latestTag?.name ?? null;

      return {
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        updateAvailable: latestVersion ? compareVersions(CURRENT_APP_VERSION, latestVersion) < 0 : false,
        releaseUrl: latestVersion ? `${GITHUB_RELEASES_URL}/tag/${latestVersion}` : GITHUB_RELEASES_URL,
        apkUrl: null,
      };
    }

    if (latestRelease.status === 403 || tagsRes.status === 403) {
      throw new Error('Batas akses GitHub API sementara tercapai. Silakan coba lagi beberapa saat lagi.');
    }

    throw new Error(`Gagal menghubungi server update (Status: ${latestRelease.status || tagsRes.status || 'Offline'})`);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Koneksi timeout saat mengecek update. Periksa koneksi internet Anda.');
    }
    throw error;
  }
}
