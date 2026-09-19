import type { ReactNode } from "react";
import { STATUS_META } from "../constants";
import type { AreaStatus } from "../types";

export function StatusPill({
  status,
  size = "md",
}: {
  status: AreaStatus;
  size?: "sm" | "md";
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`pill ${size === "sm" ? "pill-sm" : ""}`}
      style={
        {
          "--pill": meta.color,
          borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`,
        } as React.CSSProperties
      }
      title={meta.hint}
    >
      <i className="pill-dot" />
      {meta.label}
    </span>
  );
}

export function ProgressBar({
  value,
  color = "#0f766e",
  track = "rgba(15,118,110,0.14)",
}: {
  value: number;
  color?: string;
  track?: string;
}) {
  return (
    <div className="bar-track" style={{ background: track }}>
      <div
        className="bar-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <em className="field-hint">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
