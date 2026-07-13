"use client";

/** GitHub-flavored markdown renderer with embedded-HTML support, themed via .rev-markdown. */

import { useMemo, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { openModal } from "@/features/modal";

/** Preserve our `source:` citation scheme; sanitize everything else as usual. */
function urlTransform(url: string): string {
  if (url.startsWith("source:")) return url;
  return defaultUrlTransform(url);
}

/** A click on a `source:` citation link — a file path and optional 1-based line. */
export type SourceClick = (path: string, line?: number) => void;

/** Parse a `source:path/to/file.ts#L42` (or `#L42-L60`, or no anchor) href. */
export function parseSourceHref(href: string): { path: string; line?: number } | null {
  if (!href.startsWith("source:")) return null;
  const rest = href.slice("source:".length);
  const [path, anchor] = rest.split("#");
  if (!path) return null;
  const match = anchor?.match(/^L(\d+)/);
  return { path, line: match ? Number(match[1]) : undefined };
}

interface MarkdownProps {
  children: string;
  className?: string;
  /** when set, `source:` links render as clickable citations into the code */
  onSourceClick?: SourceClick;
  /** when set, inline `high`/`med`/`low` code renders as a colored severity badge */
  severityBadges?: boolean;
}

export function Markdown({
  children,
  className,
  onSourceClick,
  severityBadges,
}: MarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      img: MarkdownImage,
      a: (props) => <MarkdownAnchor {...props} onSourceClick={onSourceClick} />,
      code: (props) => <MarkdownCode {...props} severityBadges={severityBadges} />,
    }),
    [onSourceClick, severityBadges],
  );

  return (
    <div className={cn("rev-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        urlTransform={urlTransform}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

type AnchorProps = ComponentProps<"a"> & { onSourceClick?: SourceClick };

function isEmpty(children: ReactNode): boolean {
  if (children == null || children === false) return true;
  if (typeof children === "string") return children.trim() === "";
  if (Array.isArray(children)) return children.every(isEmpty);
  return false;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function MarkdownAnchor({ href, children, onSourceClick, ...rest }: AnchorProps) {
  const source = typeof href === "string" ? parseSourceHref(href) : null;

  if (source) {
    const label = isEmpty(children) ? basename(source.path) : children;
    if (onSourceClick) {
      const handleClick = () => onSourceClick(source.path, source.line);
      return (
        <button type="button" onClick={handleClick} className="rev-source-cite">
          <FileCode className="h-3 w-3 shrink-0" />
          {label}
        </button>
      );
    }
    return <span className="rev-source-cite-static">{label}</span>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}

type CodeProps = ComponentProps<"code"> & { severityBadges?: boolean };

const SEVERITY: Record<string, "high" | "med" | "low"> = {
  high: "high",
  med: "med",
  medium: "med",
  low: "low",
};

function textOf(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

function MarkdownCode({ className, children, severityBadges, ...rest }: CodeProps) {
  if (severityBadges && !className) {
    const sev = SEVERITY[textOf(children).trim().toLowerCase()];
    if (sev) return <span className={`rev-sev rev-sev-${sev}`}>{children}</span>;
  }
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

interface MarkdownImageProps {
  src?: string | Blob;
  alt?: string;
}

function MarkdownImage({ src, alt }: MarkdownImageProps) {
  if (typeof src !== "string") return null;
  const handleClick = () => openModal({ type: "artifact", artifact: { kind: "image", src, alt } });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      onClick={handleClick}
      className="cursor-zoom-in rounded-md"
    />
  );
}
