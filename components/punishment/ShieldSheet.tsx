import { tags } from "@/lib/punishment/schema";
export function ShieldChoices({ disabled, onChange }: {
    disabled: string[];
    onChange: (v: string[]) => void;
}) { return <div className="punishment-shield">{Object.entries(tags).map(([tag, label]) => <label key={tag}><span>{label}</span><input type="checkbox" checked={!disabled.includes(tag)} onChange={e => onChange(e.target.checked ? disabled.filter(v => v !== tag) : [...disabled, tag])}/></label>)}</div>; }
