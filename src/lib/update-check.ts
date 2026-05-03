export const APP_REPOSITORY = 'ketanvpn/alaalakasir';
export const CURRENT_APP_VERSION = __APP_VERSION__;
export const GITHUB_RELEASES_URL = `https://github.com/${APP_REPOSITORY}/releases`;

interface GitHubTag {
  name: string;
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
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
  const response = await fetch(`https://api.github.com/repos/${APP_REPOSITORY}/tags`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!response.ok) {
    throw new Error('Gagal mengecek versi terbaru');
  }

  const tags = (await response.json()) as GitHubTag[];
  const latestTag = tags.find(tag => /^v?\d+\.\d+\.\d+/.test(tag.name));
  const latestVersion = latestTag?.name ?? null;

  return {
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    updateAvailable: latestVersion ? compareVersions(CURRENT_APP_VERSION, latestVersion) < 0 : false,
    releaseUrl: GITHUB_RELEASES_URL,
  };
}
