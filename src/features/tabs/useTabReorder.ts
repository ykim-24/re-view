/**
 * Pointer-based tab reordering. The dragged tab follows the cursor (the real
 * element, not a native drag ghost) while the others slide via a CSS transform
 * transition. The drag is hard-clamped to the row so a tab can't be dragged over
 * the logo or the "+" button; on release it animates into its target slot. The
 * new order is committed after the drop settles. A small activation threshold
 * keeps plain clicks working, and a click after a drag is suppressed.
 */

import { useCallback, useRef, useState, type PointerEvent, type RefObject } from "react";
import { gsap } from "gsap";
import { useTabsStore } from "./store";

const THRESHOLD = 4;
const SHIFT_MS = 180;

interface DragState {
  startX: number;
  fromIndex: number;
  fromId: string;
  width: number;
  centers: number[];
  slots: number[];
  rowLeft: number;
  rowRight: number;
  els: HTMLElement[];
  targetIndex: number;
  lastDx: number;
  active: boolean;
}

function clearStyles(els: HTMLElement[]) {
  for (const el of els) {
    el.style.transform = "";
    el.style.transition = "";
    el.style.zIndex = "";
    el.style.pointerEvents = "";
  }
}

function restOffset(st: DragState): number {
  let off = 0;
  if (st.targetIndex > st.fromIndex) {
    for (let i = st.fromIndex + 1; i <= st.targetIndex; i++) off += st.slots[i];
  } else {
    for (let i = st.targetIndex; i < st.fromIndex; i++) off -= st.slots[i];
  }
  return off;
}

export function useTabReorder(
  rowRef: RefObject<HTMLDivElement | null>,
  tabIds: string[],
  onCommit: (fromId: string, toIndex: number) => void,
) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>, id: string) => {
      if (e.button !== 0) return;
      const row = rowRef.current;
      if (!row) return;
      const els = Array.from(row.children).filter(
        (c): c is HTMLElement => c instanceof HTMLElement,
      );
      const fromIndex = tabIds.indexOf(id);
      if (fromIndex === -1 || !els[fromIndex]) return;

      const rects = els.map((el) => el.getBoundingClientRect());
      const centers = rects.map((r) => r.left + r.width / 2);
      const slots = els.map((el, i) => {
        const s = getComputedStyle(el);
        return rects[i].width + (parseFloat(s.marginLeft) || 0) + (parseFloat(s.marginRight) || 0);
      });

      dragRef.current = {
        startX: e.clientX,
        fromIndex,
        fromId: id,
        width: rects[fromIndex].width,
        centers,
        slots,
        rowLeft: rects[0].left,
        rowRight: rects[rects.length - 1].right,
        els,
        targetIndex: fromIndex,
        lastDx: 0,
        active: false,
      };

      const move = (ev: globalThis.PointerEvent) => {
        const st = dragRef.current;
        if (!st) return;
        const rawDx = ev.clientX - st.startX;
        if (!st.active) {
          if (Math.abs(rawDx) < THRESHOLD) return;
          st.active = true;
          setDraggingId(st.fromId);
          useTabsStore.getState().setDragging(true);
        }

        const origLeft = st.centers[st.fromIndex] - st.width / 2;
        const origRight = st.centers[st.fromIndex] + st.width / 2;
        const minDx = st.rowLeft - origLeft;
        const maxDx = st.rowRight - origRight;
        const clampedDx = Math.max(minDx, Math.min(maxDx, rawDx));
        st.lastDx = clampedDx;

        const dragged = st.els[st.fromIndex];
        dragged.style.transition = "none";
        dragged.style.transform = `translateX(${clampedDx}px)`;
        dragged.style.zIndex = "30";
        dragged.style.pointerEvents = "none";

        const leftNow = origLeft + clampedDx;
        const rightNow = origRight + clampedDx;
        let target = st.fromIndex;
        while (target < st.centers.length - 1 && rightNow > st.centers[target + 1]) target += 1;
        while (target > 0 && leftNow < st.centers[target - 1]) target -= 1;
        st.targetIndex = target;

        const slot = st.slots[st.fromIndex];
        st.els.forEach((el, i) => {
          if (i === st.fromIndex) return;
          let shift = 0;
          if (st.fromIndex < target && i > st.fromIndex && i <= target) shift = -slot;
          else if (st.fromIndex > target && i >= target && i < st.fromIndex) shift = slot;
          el.style.transition = `transform ${SHIFT_MS}ms ease`;
          el.style.transform = `translateX(${shift}px)`;
        });
      };

      const finish = (st: DragState) => {
        clearStyles(st.els);
        setDraggingId(null);
        if (st.targetIndex !== st.fromIndex) onCommit(st.fromId, st.targetIndex);
        dragRef.current = null;
        requestAnimationFrame(() => useTabsStore.getState().setDragging(false));
      };

      const up = () => {
        const st = dragRef.current;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!st) return;
        if (!st.active) {
          clearStyles(st.els);
          dragRef.current = null;
          return;
        }
        suppressClick.current = true;
        gsap.fromTo(
          st.els[st.fromIndex],
          { x: st.lastDx },
          {
            x: restOffset(st),
            duration: 0.2,
            ease: "power3.out",
            onComplete: () => finish(st),
          },
        );
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [rowRef, tabIds, onCommit],
  );

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return { draggingId, onPointerDown, shouldSuppressClick };
}
