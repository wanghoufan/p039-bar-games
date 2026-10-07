import type { Preferences } from "@/lib/punishment/schema";
export function BankChoices({ value, onChange }: {
    value: Preferences["bank"];
    onChange: (v: Preferences["bank"]) => void;
}) { return <div className="punishment-options" role="group" aria-label="题库">{([["couple", "一男一女"], ["normal", "多男多女"], ["oneMany", "一男多女"]] as const).map(([v, label]) => <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>)}</div>; }