"use client";

/**
 * Browser-style tab strip. Each tab is an app route; the active tab mirrors the
 * current URL and connects visually to the content below. Switching a tab
 * navigates to its href; "+" opens a new tab (sliding up on entry); tabs can be
 * dragged to reorder; closing the last tab opens a fresh one. Tabs persist.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { gsap } from "gsap";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTabsStore, type Tab } from "./store";
import { useTabReorder } from "./useTabReorder";
import { tabLabel } from "./label";
import { UpdateAvailableButton } from "@/features/updater/UpdateAvailableButton";

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const addTab = useTabsStore((s) => s.addTab);
  const setActive = useTabsStore((s) => s.setActive);
  const updateActiveHref = useTabsStore((s) => s.updateActiveHref);
  const closeTab = useTabsStore((s) => s.closeTab);
  const moveToIndex = useTabsStore((s) => s.moveToIndex);
  const syncOnLoad = useTabsStore((s) => s.syncOnLoad);

  const rowRef = useRef<HTMLDivElement | null>(null);
  const ready = useHydrated();

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      syncOnLoad(href);
      return;
    }
    updateActiveHref(href);
  }, [href, syncOnLoad, updateActiveHref]);

  const prevLefts = useRef<Map<string, number>>(new Map());
  const prevCount = useRef(0);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const els = Array.from(row.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );
    const ids = tabs.map((t) => t.id);
    const removed = ids.length < prevCount.current;
    if (removed && !useTabsStore.getState().dragging) {
      els.forEach((el, i) => {
        const old = prevLefts.current.get(ids[i]);
        const now = el.getBoundingClientRect().left;
        if (old !== undefined && old !== now) {
          gsap.fromTo(
            el,
            { x: old - now },
            { x: 0, duration: 0.22, ease: "power3.out", clearProps: "transform" },
          );
        }
      });
    }
    const map = new Map<string, number>();
    els.forEach((el, i) => map.set(ids[i], el.getBoundingClientRect().left));
    prevLefts.current = map;
    prevCount.current = ids.length;
  }, [tabs]);

  const handleCommit = useCallback(
    (fromId: string, toIndex: number) => moveToIndex(fromId, toIndex),
    [moveToIndex],
  );
  const { draggingId, onPointerDown, shouldSuppressClick } = useTabReorder(
    rowRef,
    tabs.map((t) => t.id),
    handleCommit,
  );

  const handleSelect = useCallback(
    (tab: Tab) => {
      if (shouldSuppressClick()) return;
      setActive(tab.id);
      router.push(tab.href);
    },
    [shouldSuppressClick, setActive, router],
  );

  const handleClose = useCallback(
    (tab: Tab) => {
      const before = useTabsStore.getState();
      const wasActive = before.activeId === tab.id;
      closeTab(tab.id);
      const after = useTabsStore.getState();
      if (after.tabs.length === 0) {
        addTab("/");
        router.push("/");
        return;
      }
      if (wasActive) {
        const active = after.tabs.find((t) => t.id === after.activeId);
        if (active) router.push(active.href);
      }
    },
    [closeTab, addTab, router],
  );

  const handleAdd = useCallback(() => {
    addTab("/");
    router.push("/");
  }, [addTab, router]);

  const handleHome = useCallback(() => router.push("/"), [router]);

  return (
    <div className="flex h-9 shrink-0 items-stretch bg-tab-strip">
      <button
        onClick={handleHome}
        aria-label="Home"
        className="flex aspect-square cursor-pointer items-center justify-center transition-transform hover:scale-110"
      >
        <Image
          src="/gecko.png?v=2"
          alt="re:view"
          width={24}
          height={24}
          unoptimized
          className="h-6 w-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
        />
      </button>
      {ready && (
        <div ref={rowRef} className="flex items-stretch overflow-x-auto">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              dragging={tab.id === draggingId}
              onSelect={handleSelect}
              onClose={handleClose}
              onPointerDown={onPointerDown}
            />
          ))}
        </div>
      )}
      <button
        onClick={handleAdd}
        aria-label="New tab"
        className="flex w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
      </button>
      <UpdateAvailableButton />
    </div>
  );
}

const emptySubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface TabItemProps {
  tab: Tab;
  active: boolean;
  dragging: boolean;
  onSelect(tab: Tab): void;
  onClose(tab: Tab): void;
  onPointerDown(e: PointerEvent<HTMLElement>, id: string): void;
}

function TabItem({
  tab,
  active,
  dragging,
  onSelect,
  onClose,
  onPointerDown,
}: TabItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const prevWidth = useRef<number | null>(null);
  const lastAddedId = useTabsStore((s) => s.lastAddedId);
  const label = tabLabel(tab.href);

  useLayoutEffect(() => {
    if (tab.id !== lastAddedId || !ref.current) return;
    const tween = gsap.fromTo(
      ref.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.24, ease: "power2.out", clearProps: "transform,opacity" },
    );
    return () => {
      tween.kill();
    };
  }, [tab.id, lastAddedId]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.offsetWidth;
    const prev = prevWidth.current;
    prevWidth.current = next;
    if (prev === null || prev === next || useTabsStore.getState().dragging) return;
    gsap.fromTo(
      el,
      { width: prev },
      { width: next, duration: 0.32, ease: "power3.out", clearProps: "width" },
    );
  }, [label]);

  const handleSelect = () => onSelect(tab);
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => onPointerDown(e, tab.id);
  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab);
  };
  const handleClosePointerDown = (e: React.PointerEvent) => e.stopPropagation();
  const handleAuxDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(tab);
    }
  };

  return (
    <div
      ref={ref}
      onClick={handleSelect}
      onPointerDown={handlePointerDown}
      onMouseDown={handleAuxDown}
      className={cn(
        "group relative ml-0.5 mt-0.5 flex min-w-[120px] max-w-[220px] cursor-pointer select-none items-center gap-2 pl-3 pr-2 text-xs shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
        active && "bg-background text-foreground",
        !active && "bg-tab-surface text-muted-foreground hover:bg-tab-surface-hover",
        dragging && "bg-background text-foreground shadow-lg",
      )}
    >
      <AnimatedLabel text={label} />
      <button
        onClick={handleCloseClick}
        onPointerDown={handleClosePointerDown}
        aria-label="Close tab"
        className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function AnimatedLabel({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    if (useTabsStore.getState().dragging) return;
    const chars = el.querySelectorAll("[data-ch]");
    gsap.fromTo(
      chars,
      { opacity: 0, yPercent: 70, filter: "blur(4px)" },
      {
        opacity: 1,
        yPercent: 0,
        filter: "blur(0px)",
        duration: 0.32,
        ease: "power2.out",
        stagger: 0.025,
        clearProps: "all",
      },
    );
  }, [text]);

  return (
    <span ref={ref} className="flex min-w-0 overflow-hidden font-mono">
      {text.split("").map((ch, i) => (
        <span key={`${i}-${ch}`} data-ch className="inline-block whitespace-pre">
          {ch}
        </span>
      ))}
    </span>
  );
}
