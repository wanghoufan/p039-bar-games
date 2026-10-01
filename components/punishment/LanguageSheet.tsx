import type { Preferences } from "@/lib/punishment/schema";
export function LanguageChoices({ value, onChange }: {
    value: Preferences["language"];
    onChange: (v: Preferences["language"]) => void;
}) { return <div className="punishment-options" role="group" aria-label="语言">{([["zh", "中文"], ["bilingual", "中英双语"], ["en", "English"]] as const).map(([v, label]) => <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>)}</div>; }
