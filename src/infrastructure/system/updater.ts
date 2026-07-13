import "server-only";

/**
 * Local self-updater for this single-user tool. Talks to the local git checkout
 * to see whether the remote default branch is ahead, and to fast-forward the
 * working copy (running npm install when dependencies changed). All commands are
 * fixed — no user input reaches the shell.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { UpdateResult, VersionStatus } from "@/domain/system/version";

const exec = promisify(execFile);
const cwd = process.cwd();

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd });
  return stdout.trim();
}

async function remoteDefaultBranch(): Promise<string> {
  try {
    const ref = await git(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
    return ref.replace("refs/remotes/", "");
  } catch {
    return "origin/main";
  }
}

async function readLocalVersion(): Promise<string> {
  const raw = await readFile(path.join(cwd, "package.json"), "utf8");
  return (JSON.parse(raw).version as string) ?? "0.0.0";
}

async function readVersionAtRef(ref: string): Promise<string> {
  const raw = await git(["show", `${ref}:package.json`]);
  return (JSON.parse(raw).version as string) ?? "0.0.0";
}

export async function getVersionStatus(): Promise<VersionStatus> {
  const currentVersion = await readLocalVersion().catch(() => "0.0.0");
  const fallback: VersionStatus = {
    currentVersion,
    latestVersion: currentVersion,
    currentSha: "",
    latestSha: "",
    behind: 0,
    updateAvailable: false,
  };

  try {
    const branch = await remoteDefaultBranch();
    await git(["fetch", "--quiet", "origin"]);
    const currentSha = await git(["rev-parse", "HEAD"]);
    const latestSha = await git(["rev-parse", branch]);
    const behind = Number(await git(["rev-list", "--count", `HEAD..${branch}`])) || 0;
    const latestVersion = await readVersionAtRef(branch).catch(() => currentVersion);
    return {
      currentVersion,
      latestVersion,
      currentSha,
      latestSha,
      behind,
      updateAvailable: behind > 0 && currentSha !== latestSha,
    };
  } catch {
    return fallback;
  }
}

export async function applyUpdate(): Promise<UpdateResult> {
  const branch = await remoteDefaultBranch();
  const [remote, ...rest] = branch.split("/");
  const name = rest.join("/") || "main";

  const before = await git(["rev-parse", "HEAD"]);
  let output = await git(["pull", "--ff-only", remote, name]);

  const changed = await git(["diff", "--name-only", `${before}..HEAD`]).catch(() => "");
  const needsInstall = changed
    .split("\n")
    .some((f) => f === "package-lock.json" || f === "package.json");

  if (needsInstall) {
    const { stdout, stderr } = await exec("npm", ["install"], { cwd });
    output += `\n${stdout}\n${stderr}`;
  }

  return { ok: true, needsRestart: needsInstall, output: output.slice(0, 4000) };
}
