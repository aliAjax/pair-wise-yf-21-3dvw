import { useMemo, useState } from "react";
import { DAMAGE_TYPES, DYEINGS, ORIGINS, PROCESS_STEPS } from "../constants";
import { uid } from "../helpers";
import type { Carpet, DamageArea } from "../types";
import { Field, Modal } from "./ui";
import CarpetMap, { type MapAreaMarker } from "./CarpetMap";

interface DraftArea {
  id: string;
  code: string;
  damageType: string;
  x: number;
  y: number;
  threadColor: string;
  estimatedHours: number;
}

function nextCode(areas: DraftArea[]): string {
  return String.fromCharCode(65 + areas.length); // A, B, C…
}

export default function CarpetFormModal({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Carpet | null;
  onClose: () => void;
  onSave: (carpet: Carpet) => void;
  onDelete?: (id: string) => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [origin, setOrigin] = useState(initial?.origin ?? ORIGINS[0]);
  const [era, setEra] = useState(initial?.era ?? "");
  const [knotDensity, setKnotDensity] = useState(initial?.knotDensity ?? 300);
  const [dyeing, setDyeing] = useState(initial?.dyeing ?? DYEINGS[0]);
  const [areas, setAreas] = useState<DraftArea[]>(
    () =>
      initial?.areas.map((a) => ({
        id: a.id,
        code: a.code,
        damageType: a.damageType,
        x: a.x,
        y: a.y,
        threadColor: a.threadColor,
        estimatedHours: a.estimatedHours,
      })) ?? [],
  );
  const [activeDraft, setActiveDraft] = useState<string | null>(null);
  const [error, setError] = useState("");

  const markers: MapAreaMarker[] = useMemo(
    () =>
      areas.map((a) => ({
        id: a.id,
        code: a.code,
        x: a.x,
        y: a.y,
        color: a.threadColor,
        status: "unassigned" as const,
        selected: a.id === activeDraft,
      })),
    [areas, activeDraft],
  );

  const patchArea = (id: string, patch: Partial<DraftArea>) =>
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const handleCanvas = (x: number, y: number) => {
    setAreas((prev) => {
      // 正在放置某个区 → 移动它；否则新建一个破损区
      if (activeDraft) {
        return prev.map((a) => (a.id === activeDraft ? { ...a, x, y } : a));
      }
      const draft: DraftArea = {
        id: uid("ar"),
        code: nextCode(prev),
        damageType: DAMAGE_TYPES[0],
        x,
        y,
        threadColor: "#8b5a2b",
        estimatedHours: 8,
      };
      setActiveDraft(draft.id);
      return [...prev, draft];
    });
  };

  const removeArea = (id: string) => {
    setAreas((prev) => {
      const kept = prev.filter((a) => a.id !== id);
      // 删除后重新编号，保证 A/B/C 连续
      return kept.map((a, i) => ({ ...a, code: String.fromCharCode(65 + i) }));
    });
    if (activeDraft === id) setActiveDraft(null);
  };

  const handleSave = () => {
    if (!code.trim()) {
      setError("请填写档案编号，如 CAR-142");
      return;
    }
    if (!era.trim()) {
      setError("请填写年代，如 约 1970s");
      return;
    }
    if (areas.length === 0) {
      setError("至少在标记图上录入一个破损区（点击毯面放置）");
      return;
    }
    const oldById = new Map(initial?.areas.map((a) => [a.id, a]) ?? []);
    const merged: DamageArea[] = areas.map((d) => {
      const old = oldById.get(d.id);
      if (old) {
        return {
          ...old,
          code: d.code,
          damageType: d.damageType,
          x: d.x,
          y: d.y,
          threadColor: d.threadColor,
          estimatedHours: d.estimatedHours,
        };
      }
      return {
        id: d.id,
        code: d.code,
        damageType: d.damageType,
        x: d.x,
        y: d.y,
        threadColor: d.threadColor,
        estimatedHours: d.estimatedHours,
        assigneeId: null,
        started: false,
        steps: PROCESS_STEPS.map(() => false),
        completedAt: null,
      };
    });
    const saved: Carpet = {
      id: initial?.id ?? uid("car"),
      code: code.trim(),
      origin,
      era: era.trim(),
      knotDensity: Number(knotDensity) || 0,
      dyeing,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      areas: merged,
    };
    onSave(saved);
  };

  const draftCarpet: Carpet = {
    id: initial?.id ?? "draft",
    code: code.trim() || "新地毯",
    origin,
    era: era.trim() || "年代待定",
    knotDensity: Number(knotDensity) || 0,
    dyeing,
    createdAt: "",
    areas: [],
  };

  return (
    <Modal
      wide
      title={initial ? `编辑地毯 ${initial.code}` : "录入新地毯工单"}
      onClose={onClose}
      footer={
        <>
          {initial && onDelete ? (
            <button
              className="danger-btn"
              onClick={() => {
                if (
                  window.confirm(
                    `确认删除 ${initial.code}？其全部破损区与派工记录将一并删除。`,
                  )
                ) {
                  onDelete(initial.id);
                }
              }}
            >
              删除该地毯
            </button>
          ) : null}
          <span className="modal-error">{error}</span>
          <button className="ghost-btn" onClick={onClose}>
            取消
          </button>
          <button className="primary-btn" onClick={handleSave}>
            保存工单
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-main">
          <div className="form-row">
            <Field label="档案编号">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAR-142" />
            </Field>
            <Field label="产地">
              <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {ORIGINS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="年代">
              <input value={era} onChange={(e) => setEra(e.target.value)} placeholder="约 1960s" />
            </Field>
            <Field label="结密度（结/dm²）">
              <input
                type="number"
                min={0}
                value={knotDensity}
                onChange={(e) => setKnotDensity(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="染色">
              <select value={dyeing} onChange={(e) => setDyeing(e.target.value)}>
                {DYEINGS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>

          <CarpetMap
            carpet={draftCarpet}
            markers={markers}
            selectedAreaId={activeDraft}
            placing
            onSelectArea={setActiveDraft}
            onCanvasClick={handleCanvas}
          />
        </div>

        <div className="form-side">
          <div className="side-head">
            <h4>破损区 / 补线 / 工序</h4>
            <span>{areas.length} 个区</span>
          </div>
          {areas.length === 0 ? (
            <p className="side-empty">点击左侧毯面，放置第一个破损区标记。</p>
          ) : (
            <ul className="draft-list">
              {areas.map((a) => (
                <li
                  key={a.id}
                  className={a.id === activeDraft ? "draft-active" : ""}
                  onClick={() => setActiveDraft(a.id)}
                >
                  <div className="draft-title">
                    <b>区 {a.code}</b>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeArea(a.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  {a.id === activeDraft ? (
                    <div className="draft-edit" onClick={(e) => e.stopPropagation()}>
                      <label className="field">
                        <span className="field-label">破损类型</span>
                        <select
                          value={a.damageType}
                          onChange={(e) => patchArea(a.id, { damageType: e.target.value })}
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
                            value={a.threadColor}
                            onChange={(e) => patchArea(a.id, { threadColor: e.target.value })}
                          />
                          <input
                            type="text"
                            value={a.threadColor}
                            onChange={(e) => patchArea(a.id, { threadColor: e.target.value })}
                          />
                        </div>
                      </label>
                      <label className="field">
                        <span className="field-label">预估工时（小时）</span>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={a.estimatedHours}
                          onChange={(e) =>
                            patchArea(a.id, {
                              estimatedHours: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                      </label>
                      <p className="xy-input">
                        位置 X {a.x}% · Y {a.y}%，点击毯面可移动
                      </p>
                    </div>
                  ) : (
                    <p className="draft-sum">
                      <i style={{ background: a.threadColor }} />
                      {a.damageType} · {a.estimatedHours}h
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
