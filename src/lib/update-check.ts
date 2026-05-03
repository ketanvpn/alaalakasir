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

export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  const headers = { Accept: 'application/vnd.github+json' };
  const latestReleaseResponse = await fetch(`https://api.github.com/repos/${APP_REPOSITORY}/releases/latest`, {
    headers,
    cache: 'no-store',
  });

  if (latestReleaseResponse.ok) {
    const release = (await latestReleaseResponse.json()) as GitHubRelease;
    const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));

    return {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: release.tag_name,
      updateAvailable: compareVersions(CURRENT_APP_VERSION, release.tag_name) < 0,
      releaseUrl: release.html_url,
      apkUrl: apkAsset?.browser_download_url ?? null,
    };
  }

  const response = await fetch(`https://api.github.com/repos/${APP_REPOSITORY}/tags`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Repository GitHub tidak bisa diakses publik');
    }
    throw new Error(`Gagal mengecek versi terbaru (${response.status})`);
  }

  const tags = (await response.json()) as GitHubTag[];
  const latestTag = tags.find(tag => /^v?\d+\.\d+\.\d+/.test(tag.name));
  const latestVersion = latestTag?.name ?? null;

  return {
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    updateAvailable: latestVersion ? compareVersions(CURRENT_APP_VERSION, latestVersion) < 0 : false,
    releaseUrl: latestVersion ? `${GITHUB_RELEASES_URL}/tag/${latestVersion}` : GITHUB_RELEASES_URL,
    apkUrl: null,
  };
}
