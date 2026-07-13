/** Shared types for the self-updater (version check + apply). */

export interface VersionStatus {
  currentVersion: string;
  latestVersion: string;
  currentSha: string;
  latestSha: string;
  behind: number;
  updateAvailable: boolean;
}

export interface UpdateResult {
  ok: boolean;
  needsRestart: boolean;
  output: string;
}
