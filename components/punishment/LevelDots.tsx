import { levels, type Level } from "@/lib/punishment/schema";
export function LevelDots({ level, onChange }: {
    level: Level;
    onChange: (l: Level) => void;
}) { return <div className="punishment-dots" role="group" aria-label="内容选择">{levels.map(l => <button key={l} type="button" aria-label={`选择 ${l}`} aria-pressed={l === level} onClick={() => onChange(l)}><span /></button>)}</div>; }
