'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Alberti disks (Phase 6): two concentric alphabet rings — the OUTER ring
 * is the ciphertext alphabet (static), the INNER ring is the plaintext
 * alphabet. Rotating the inner ring changes the shift: inner letter `p`
 * aligns under outer letter `c` when `plain = cipher - shift`, mirroring
 * caesarDecode exactly. Rotating the ring one step FORWARD (inner «а»
 * moves onto «б», clockwise) increases the shift by 1. Drag with the
 * pointer (mouse/touch), spin the wheel, or use ← / → keys. The visual
 * rotation follows the pointer continuously; the shift (and therefore the
 * decoded text) snaps at letter boundaries, and the ring settles onto the
 * snapped position on release. A rose marker rides on the inner «а» and
 * the readout below shows the cipher letter it points at — that pair fully
 * defines the shift.
 */

interface AlbertiDisksProps {
  alphabet: string;
  /** Current shift (0..n-1), mirroring caesarDecode. */
  shift: number;
  onShiftChange: (shift: number) => void;
}

const SIZE = 360;
const CENTER = SIZE / 2;
const OUTER_DISK_R = 150;
const OUTER_LABEL_R = 129;
const INNER_DISK_R = 106;
const INNER_LABEL_R = 84;

function polar(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export function AlbertiDisks({ alphabet, shift, onShiftChange }: AlbertiDisksProps) {
  const t = useT();
  const n = alphabet.length;
  const step = 360 / n;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startRaw: number; startRotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Continuous rotation in degrees (clockwise positive); snapped on release. */
  const [rotation, setRotation] = useState(0);

  const letters = useMemo(() => alphabet.split(''), [alphabet]);

  // Keep the ring in sync with external shift changes (reset button, new
  // session) — but never while a drag is in flight, or the ring would fight
  // the pointer.
  useEffect(() => {
    if (!dragRef.current) setRotation(shift * step);
  }, [shift, step]);

  const outerPoints = useMemo(
    () => letters.map((ch, i) => ({ ch, ...polar(OUTER_LABEL_R, i * step) })),
    [letters, step],
  );
  const innerPoints = useMemo(
    () => letters.map((ch, i) => ({ ch, ...polar(INNER_LABEL_R, i * step) })),
    [letters, step],
  );

  /** Clockwise-positive pointer angle around the disk center. */
  const pointerAngle = (event: React.PointerEvent): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - CENTER;
    const y = event.clientY - rect.top - CENTER;
    return (Math.atan2(y, x) * 180) / Math.PI;
  };

  const onPointerDown = (event: React.PointerEvent<SVGGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startRaw: pointerAngle(event), startRotation: rotation };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const raw = pointerAngle(event);
    const delta = ((raw - drag.startRaw + 540) % 360) - 180;
    const nextRotation = drag.startRotation + delta;
    setRotation(nextRotation);
    const nextShift = ((Math.round(nextRotation / step) % n) + n) % n;
    if (nextShift !== shift) onShiftChange(nextShift);
  };

  const onPointerEnd = (event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    // Settle onto the snapped letter position.
    setRotation(shift * step);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onShiftChange((shift + 1) % n);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onShiftChange((shift - 1 + n) % n);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onShiftChange(0);
    }
  };

  // Wheel rotates the ring one letter per notch (non-passive to block scroll).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      onShiftChange(((shift + direction) % n + n) % n);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [shift, n, onShiftChange]);

  // The outer (ciphertext) letter the inner «а» currently points at. The
  // ring rotation equals `shift * step`, and inner «а» is drawn at the
  // ring's 12 o'clock, so it lands under outer letter number `shift`.
  // Rotating the ring forward by one letter (а → б) therefore reads
  // exactly `shift = 1` — the same direction caesarDecode uses
  // (`plain = cipher - shift`).
  const alignedCipher = alphabet[((shift % n) + n) % n] ?? '?';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`select-none outline-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        role="slider"
        aria-label={t('caesar.shift')}
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={shift}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-sm"
          style={{ touchAction: 'none' }}
        >
          {/* Outer ring — ciphertext alphabet (static) */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_DISK_R}
            className="fill-inset"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_DISK_R}
            fill="none"
            strokeWidth={2}
            className="stroke-ink"
          />
          <g className="fill-ink font-mono" fontSize={13}>
            {outerPoints.map((p) => (
              <text key={p.ch} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central">
                {p.ch}
              </text>
            ))}
          </g>

          {/* Inner ring — plaintext alphabet (draggable) */}
          <g
            transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={INNER_DISK_R}
              strokeWidth={2}
              className="fill-paper stroke-red-700"
            />
            <g className="fill-ink font-mono" fontSize={12}>
              {innerPoints.map((p) => (
                <text
                  key={p.ch}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={p.ch === alphabet[0] ? 'fill-red-700' : undefined}
                >
                  {p.ch}
                </text>
              ))}
            </g>

            {/* Marker riding on the inner «а»: rotates with the ring and
                always points at the cipher letter shown in the readout. */}
            <line
              x1={CENTER}
              y1={CENTER - 117}
              x2={CENTER}
              y2={CENTER - 129}
              strokeWidth={2.5}
              className="stroke-red-700"
            />
          </g>

          {/* Hub */}
          <circle cx={CENTER} cy={CENTER} r={9} className="fill-red-700" />
        </svg>
      </div>

      <p className="font-mono text-sm text-fade">
        {alphabet[0]} → <strong className="text-red-700">{alignedCipher}</strong>
      </p>
      <div className="flex items-center gap-3 font-mono text-sm">
        <span className="text-fade">
          {t('caesar.shift')}: <strong className="text-ink">{shift}</strong>
        </span>
        <button
          type="button"
          onClick={() => onShiftChange(0)}
          className="border border-ink px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-ink transition hover:bg-inset"
        >
          {t('caesar.reset')}
        </button>
      </div>
    </div>
  );
}
