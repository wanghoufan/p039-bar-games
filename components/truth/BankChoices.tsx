import type { TruthBank } from "@/lib/truth/storage";

// 真心话题库选择：「普通（多男多女）」内容尚未入库，选中后进入会显示占位空态。
export function TruthBankChoices({ value, onChange }: {
  value: TruthBank;
  onChange: (v: TruthBank) => void;
}) {
  return <div className="punishment-options" role="group" aria-label="题库">{([["pair", "一男一女"], ["normal", "普通（即将上线）"]] as const).map(([v, label]) => <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>)}</div>;
}