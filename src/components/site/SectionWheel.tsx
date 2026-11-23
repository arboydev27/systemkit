"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import Link from "next/link";
import styles from "./SectionWheel.module.css";

/** Where the home page's sections open on a wheel rather than sit in a row: a phone held upright. */
export const WHEEL_MEDIA = "(max-width: 639px) and (min-height: 600px)";

export type WheelSection = {
  href: string;
  label: string;
  detail: ReactNode;
  /** Instead of following the link, when the page has a better way in. The wheel closes first. */
  onSelect?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

// Degrees between neighbouring sections on the wheel: close enough that all four show at once, from nine o'clock down.
const STEP = 26;
// How far past either end a finger can pull the wheel, at most, before it springs back.
const STRETCH = 26;
// How far ahead a flick carries the wheel: its speed in degrees a millisecond, times this.
const CARRY = 170;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
// Past an end, the wheel gives less the further it's pulled, and never more than STRETCH.
const resist = (over: number) => STRETCH * (1 - 1 / (over / (STRETCH * 2) + 1));
// The rim's ticks come from sine and cosine, whose last digits differ between the server's engine and the browser's, so
// they're written to three decimals, far finer than a pixel on this dial, and both sides print the same text.
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The sections as a glass wheel that rolls in from the right edge of the screen, its hub on the edge and the sections
 * on its spokes, while the page behind blurs. The one at nine o'clock, against the notch on the rim, is the one in hand;
 * a finger turns the wheel with momentum and it settles on a section, and a tap on any section opens it.
 */
export function SectionWheel({ id, sections, open, onClose, label = "Sections" }: {
  id: string;
  sections: WheelSection[];
  open: boolean;
  onClose: () => void;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  // How far the wheel has turned, in degrees: section i sits i * STEP - turn below the notch.
  const [turn, setTurn] = useState(0);
  const [held, setHeld] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number; angle: number; from: number; moving: boolean; trail: { turn: number; at: number }[] } | null>(null);
  const flung = useRef(false);
  const settle = useRef(0);
  const last = (sections.length - 1) * STEP;
  const inHand = Math.round(clamp(turn, 0, last) / STEP);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open) {
      if (node.hasAttribute("data-closing")) node.removeAttribute("data-closing");
      if (!node.open) {
        setTurn(0);
        node.showModal();
        // Focus rests on the wheel itself, not a section, so a finger that opened it sees no focus ring; the arrow keys
        // turn it from there, and Tab steps through the sections.
        node.focus({ preventScroll: true });
      }
      return;
    }
    if (!node.open || node.hasAttribute("data-closing")) return;
    // Safari can't keep a closing dialog on top while it animates out, so it stays open, marked, until it has.
    node.setAttribute("data-closing", "");
    const animations = node.getAnimations({ subtree: true });
    Promise.race([Promise.allSettled(animations.map((animation) => animation.finished)), new Promise((done) => setTimeout(done, 700))]).then(() => {
      if (!node.hasAttribute("data-closing")) return;
      node.removeAttribute("data-closing");
      node.close();
    });
  }, [open]);

  // A phone turned on its side, or a window grown wide, has its sections in a row again.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(WHEEL_MEDIA);
    const change = () => { if (!query.matches) onClose(); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, [open, onClose]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  function angleOf(event: { clientX: number; clientY: number }) {
    const box = disc.current!.getBoundingClientRect();
    return Math.atan2(event.clientY - (box.top + box.height / 2), box.left + box.width / 2 - event.clientX) * 180 / Math.PI;
  }

  function turnTo(index: number, focus = false) {
    const next = clamp(index, 0, sections.length - 1);
    setTurn(next * STEP);
    if (focus) links.current[next]?.focus({ preventScroll: true });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || drag.current) return;
    window.clearTimeout(settle.current);
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, angle: angleOf(event), from: turn, moving: false, trail: [{ turn, at: event.timeStamp }] };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const hold = drag.current;
    if (!hold || hold.pointer !== event.pointerId) return;
    if (!hold.moving) {
      // A finger that hasn't moved is tapping a section, and the tap goes to it; only once it moves does it hold the wheel.
      if (Math.hypot(event.clientX - hold.x, event.clientY - hold.y) < 6) return;
      hold.moving = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setHeld(true);
    }
    let swept = angleOf(event) - hold.angle;
    if (swept > 180) swept -= 360;
    if (swept < -180) swept += 360;
    // Drawing the rim down turns the sections down with it.
    const raw = hold.from - swept;
    const next = raw < 0 ? -resist(-raw) : raw > last ? last + resist(raw - last) : raw;
    hold.trail = [...hold.trail.filter((point) => event.timeStamp - point.at < 90), { turn: raw, at: event.timeStamp }];
    setTurn(next);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const hold = drag.current;
    if (!hold || hold.pointer !== event.pointerId) return;
    drag.current = null;
    if (!hold.moving) return;
    flung.current = true;
    setHeld(false);
    const first = hold.trail[0];
    const end = hold.trail[hold.trail.length - 1];
    const speed = end.at > first.at ? (end.turn - first.turn) / (end.at - first.at) : 0;
    turnTo(Math.round((clamp(end.turn, 0, last) + speed * CARRY) / STEP));
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    // The click that ends a turn of the wheel isn't a tap on whatever section the finger let go over.
    if (!flung.current) return;
    flung.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    setTurn((now) => clamp(now + event.deltaY * 0.3, -STRETCH / 2, last + STRETCH / 2));
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setTurn((now) => Math.round(clamp(now, 0, last) / STEP) * STEP), 140);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    const at = links.current.findIndex((link) => link === document.activeElement);
    const from = at >= 0 ? at : inHand;
    const to = { ArrowDown: from + 1, ArrowRight: from + 1, ArrowUp: from - 1, ArrowLeft: from - 1, Home: 0, End: sections.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    turnTo(to, true);
  }

  return <dialog
    ref={dialog}
    id={id}
    className={styles.wheel}
    aria-label={label}
    tabIndex={-1}
    data-held={held || undefined}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose}
    onKeyDown={onKeyDown}
    // A tap on the blurred page, anywhere off the wheel, puts it away.
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    style={{ "--turn": `${turn}deg` } as CSSProperties}
  >
    <button type="button" className={styles.close} aria-label="Close sections" onClick={onClose}><i /><i /></button>
    <div
      ref={disc}
      className={styles.disc}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
    >
      <svg className={styles.dial} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
        {Array.from({ length: 120 }, (_, tick) => {
          const major = tick % 3 === 0;
          const angle = tick * 3 * Math.PI / 180;
          const inner = major ? 91.5 : 93;
          return <line key={tick} className={major ? styles.tickMajor : undefined} x1={round(-Math.cos(angle) * inner)} y1={round(Math.sin(angle) * inner)} x2={round(-Math.cos(angle) * 96)} y2={round(Math.sin(angle) * 96)} />;
        })}
      </svg>
      <i className={styles.lens} aria-hidden="true" />
      <i className={styles.notch} aria-hidden="true" />
      <i className={styles.hub} aria-hidden="true" />
      <ul className={styles.spokes}>
        {sections.map((section, index) => {
          const at = index * STEP - turn;
          const away = Math.abs(at) / STEP;
          return <li
            key={section.href}
            className={styles.spoke}
            data-in-hand={index === inHand || undefined}
            style={{ "--at": `${at}deg`, "--away": Math.min(away, 3).toFixed(3), "--order": index } as CSSProperties}
          >
            <Link
              ref={(node) => { links.current[index] = node; }}
              href={section.href}
              className={styles.section}
              tabIndex={Math.abs(at) > 100 ? -1 : undefined}
              onFocus={() => { if (!drag.current) setTurn(index * STEP); }}
              onClick={(event) => {
                if (!section.onSelect || event.metaKey || event.ctrlKey || event.shiftKey) return;
                dialog.current?.removeAttribute("data-closing");
                dialog.current?.close();
                section.onSelect(event);
              }}
            >
              <span className={styles.label}>{section.label}</span>
              <span className={styles.detail}>{section.detail}</span>
            </Link>
          </li>;
        })}
      </ul>
    </div>
  </dialog>;
}
