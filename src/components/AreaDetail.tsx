import { useState } from "react";
import { DAMAGE_TYPES, PROCESS_STEPS, STATUS_META } from "../constants";
import type { DamageArea, Carpet, Repairer } from "../types";
import { areaProgress, areaStatus } from "../helpers";
import { ProgressBar, StatusPill } from "./ui";

export default function AreaDetail({
  carpet,
  area,
  repairers,
  onAssign,
  onUnassign,
  onStart,
  onToggleStep,
  onComplete,
  onUpdateArea,
}: {
  carpet: Carpet;
  area: DamageArea;
  repairers: Repairer[];
  onAssign: (repairerId: string) => void;
  onUnassign: () => void;
  onStart: () => void;
  onToggleStep: (index: number) => void;
  onComplete: () => void;
  onUpdateArea: (patch: Partial<DamageArea>) => void;
}) {
  const status = areaStatus(area, repairers);
  const repairer = repairers.find((r) => r.id === area.assigneeId);
  const [pick, setPick] = useState("");
  const [editing, setEditing] = useState(false);
  const progress = areaProgress(area);
  const locked = status === "locked";
  const finished = status === "done";
  const allStepsDone = area.steps.every(Boolean);
  const editable = !finished && !locked;

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="detail-code">
            破损区 {area.code}
            <span className="muted">（{carpet.code}）</span>
          </div>
          <StatusPill status={status} />
        </div>
        <button className="ghost-btn" onClick={() => setEditing((v) => !v)}>
          {editing ? "收起编辑" : "编辑参数"}
        </button>
      </div>

      {locked ? (
        <div className="notice notice-warn">
          负责人 <b>{repairer?.name}</b> 已离岗：工单保持锁定，工序与完工不可操作，待其返岗后继续。
        </div>
      ) : null}
      {finished ? (
        <div className="notice notice-ok">
          已于 {new Date(area.completedAt!).toLocaleString("zh-CN")} 完工。
        </div>
      ) : null}

      {editing ? (
        <div className="edit-grid">
          <label className="field">
            <span className="field-label">破损类型</span>
            <select
              value={area.damageType}
              disabled={!editable}
              onChange={(e) => onUpdateArea({ damageType: e.target.value })}
            >
              {DAMAGE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">补线色</span>
            <div className="color-input">
              <input
                type="color"
                value={area.threadColor}
                disabled={!editable}
                onChange={(e) => onUpdateArea({ threadColor: e.target.value })}
              />
              <input
                type="text"
                value={area.threadColor}
                disabled={!editable}
                onChange={(e) => onUpdateArea({ threadColor: e.target.value })}
              />
            </div>
          </label>
          <label className="field">
            <span className="field-label">预估工时（小时）</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={area.estimatedHours}
              disabled={!editable}
              onChange={(e) =>
                onUpdateArea({ estimatedHours: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
          <div className="field">
            <span className="field-label">标记位置</span>
            <div className="xy-input">
              <span>
                X <b>{area.x}%</b>
              </span>
              <span>
                Y <b>{area.y}%</b>
              </span>
              <em>在左侧标记图上拖放式录入（点击可重新选中）</em>
            </div>
          </div>
        </div>
      ) : (
        <div className="kv-grid">
          <div>
            <span>破损类型</span>
            <b>{area.damageType}</b>
          </div>
          <div>
            <span>补线色</span>
            <b className="color-value">
              <i style={{ background: area.threadColor }} />
              {area.threadColor}
            </b>
          </div>
          <div>
            <span>预估工时</span>
            <b>{area.estimatedHours} h</b>
          </div>
          <div>
            <span>负责人</span>
            <b>{repairer ? repairer.name : "—"}</b>
          </div>
        </div>
      )}

      <div className="progress-block">
        <div className="progress-head">
          <span className="field-label">工序进度</span>
          <b>{progress}%</b>
        </div>
        <ProgressBar
          value={progress}
          color={STATUS_META[status].color}
          track={`color-mix(in srgb, ${STATUS_META[status].color} 16%, transparent)`}
        />
        <ul className="steps">
          {PROCESS_STEPS.map((step, i) => {
            const done = area.steps[i];
            return (
              <li key={step} className={done ? "step-done" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={status !== "in_progress"}
                    onChange={() => onToggleStep(i)}
                  />
                  <span className="step-no">{i + 1}</span>
                  {step}
                </label>
              </li>
            );
          })}
        </ul>
        {status !== "in_progress" && !finished ? (
          <p className="step-note">
            {locked
              ? "工单锁定中，工序不可勾选。"
              : status === "unassigned"
                ? "派工并开工后可勾选工序。"
                : "开工后可勾选工序。"}
          </p>
        ) : null}
      </div>

      <div className="detail-actions">
        {status === "unassigned" ? (
          <>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">选择修复师派工…</option>
              {repairers
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <button className="primary-btn" disabled={!pick} onClick={() => pick && onAssign(pick)}>
              派工
            </button>
          </>
        ) : null}
        {status === "assigned" ? (
          <>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">改派给…</option>
              {repairers
                .filter((r) => r.active && r.id !== area.assigneeId)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <button className="primary-btn" disabled={!pick} onClick={() => pick && onAssign(pick)}>
              改派
            </button>
            <button className="ghost-btn" onClick={onStart}>
              开工
            </button>
            <button className="danger-btn" onClick={onUnassign}>
              撤回待分配
            </button>
          </>
        ) : null}
        {status === "in_progress" ? (
          <button
            className="primary-btn"
            disabled={!allStepsDone}
            title={allStepsDone ? "" : "全部工序完成后才能记完工"}
            onClick={onComplete}
          >
            {allStepsDone ? "记完工" : "完成全部工序后可记完工"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
