/**
 * Every modal in the app is one variant of this discriminated union. To add a
 * modal: add a variant here, render a case in ModalRoot, and call
 * openModal({ type: "..." }). Mirrors ~/flow's features/modal/types.ts.
 */

import type { VersionStatus } from "@/domain/system/version";

/** A previewable artifact. Extend with more kinds (gdoc, gsheet, pdf, …). */
export type Artifact = { kind: "image"; src: string; alt?: string };

export type ModalDescriptor =
  | { type: "error"; title: string; message: string }
  | { type: "shortcuts" }
  | { type: "artifact"; artifact: Artifact }
  | { type: "update"; status: VersionStatus }
  | { type: "changelog" }
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
      onConfirm(): void;
    };

export type ModalType = ModalDescriptor["type"];
