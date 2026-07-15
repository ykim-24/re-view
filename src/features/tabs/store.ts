/** Persisted browser-style tabs. Each tab is an app href; the label is derived. */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Tab {
  id: string;
  href: string;
}

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  lastAddedId: string | null;
  dragging: boolean;
  setDragging(value: boolean): void;
  addTab(href: string): void;
  setActive(id: string): void;
  updateActiveHref(href: string): void;
  closeTab(id: string): void;
  moveToIndex(fromId: string, toIndex: number): void;
  syncOnLoad(href: string): void;
}

function newTab(href: string): Tab {
  return { id: crypto.randomUUID(), href };
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set) => ({
      tabs: [],
      activeId: null,
      lastAddedId: null,
      dragging: false,
      setDragging: (value) => set({ dragging: value }),
      addTab: (href) =>
        set((s) => {
          const tab = newTab(href);
          return { tabs: [...s.tabs, tab], activeId: tab.id, lastAddedId: tab.id };
        }),
      setActive: (id) => set({ activeId: id }),
      updateActiveHref: (href) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === s.activeId ? { ...t, href } : t)),
        })),
      closeTab: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id);
          const tabs = s.tabs.filter((t) => t.id !== id);
          if (s.activeId !== id) return { tabs };
          const next = tabs[idx] ?? tabs[idx - 1] ?? null;
          return { tabs, activeId: next?.id ?? null };
        }),
      moveToIndex: (fromId, toIndex) =>
        set((s) => {
          const from = s.tabs.findIndex((t) => t.id === fromId);
          if (from === -1 || from === toIndex || toIndex < 0 || toIndex >= s.tabs.length) {
            return {};
          }
          const tabs = [...s.tabs];
          const [moved] = tabs.splice(from, 1);
          tabs.splice(toIndex, 0, moved);
          return { tabs };
        }),
      syncOnLoad: (href) =>
        set((s) => {
          const match = s.tabs.find((t) => t.href === href);
          if (match) return { activeId: match.id };
          const tab = newTab(href);
          return { tabs: [...s.tabs, tab], activeId: tab.id };
        }),
    }),
    {
      name: "rev-tabs",
      partialize: (s) => ({ tabs: s.tabs, activeId: s.activeId }),
    },
  ),
);
