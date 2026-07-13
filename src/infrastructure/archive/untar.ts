import "server-only";

/**
 * Minimal gzip+tar extractor for GitHub repo tarballs. Handles the ustar header
 * (name + 155-char prefix), pax extended headers ('x' path= for long names) and
 * GNU long-name entries ('L'). Returns regular-file entries only; callers strip
 * the leading "<repo>-<sha>/" wrapper directory themselves.
 */

import { gunzipSync } from "node:zlib";

export interface TarEntry {
  path: string;
  data: Buffer;
}

function readString(buf: Buffer, start: number, len: number): string {
  const slice = buf.subarray(start, start + len);
  const nul = slice.indexOf(0);
  return slice.toString("utf8", 0, nul === -1 ? len : nul);
}

function readOctal(buf: Buffer, start: number, len: number): number {
  const text = readString(buf, start, len).trim();
  if (!text) return 0;
  const n = parseInt(text, 8);
  return Number.isNaN(n) ? 0 : n;
}

function isZeroBlock(block: Buffer): boolean {
  for (let i = 0; i < block.length; i++) if (block[i] !== 0) return false;
  return true;
}

export function extractTarGz(gz: Buffer): TarEntry[] {
  const buf = gunzipSync(gz);
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingName: string | null = null;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (isZeroBlock(header)) break;

    const name = readString(buf, offset, 100);
    const size = readOctal(buf, offset + 124, 12);
    const typeflag = String.fromCharCode(buf[offset + 156]);
    const prefix = readString(buf, offset + 345, 155);
    offset += 512;

    const data = buf.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (typeflag === "x") {
      const match = data.toString("utf8").match(/^\d+ path=(.*)$/m);
      if (match) pendingName = match[1];
      continue;
    }
    if (typeflag === "g") continue;
    if (typeflag === "L") {
      pendingName = data.toString("utf8").replace(/\0+$/, "");
      continue;
    }

    const isFile = typeflag === "0" || typeflag === "\0" || typeflag === "";
    if (isFile) {
      const path = pendingName ?? (prefix ? `${prefix}/${name}` : name);
      entries.push({ path, data: Buffer.from(data) });
    }
    pendingName = null;
  }

  return entries;
}
