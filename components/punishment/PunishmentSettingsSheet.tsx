import type { Preferences } from "@/lib/punishment/schema";
import { LanguageChoices } from "./LanguageSheet";
import { ShieldChoices } from "./ShieldSheet";
export function PunishmentSettings({ value, onChange }: {
    value: Preferences;
    onChange: (v: Preferences) => void;
}) { return <div className="punishment-settings"><h3>语言</h3><LanguageChoices value={value.language} onChange={language => onChange({ ...value, language })}/><h3>盾牌</h3><p>关闭的内容不会出现在后续题目中。</p><ShieldChoices disabled={value.disabledTags} onChange={disabledTags => onChange({ ...value, disabledTags })}/><h3>外观</h3><div className="punishment-options">{([["dark", "深色"], ["light", "浅色"], ["system", "跟随系统"]] as const).map(([theme, label]) => <button key={theme} aria-pressed={value.theme === theme} onClick={() => onChange({ ...value, theme })}>{label}</button>)}</div><div className="punishment-shield"><label>声音<input type="checkbox" checked={value.sound} onChange={e => onChange({ ...value, sound: e.target.checked })}/></label><label>震动<input type="checkbox" checked={value.vibration} onChange={e => onChange({ ...value, vibration: e.target.checked })}/></label></div><details><summary>关于 / 隐私</summary><p>仅在本机保存偏好与本局进度，不采集玩家信息。</p></details></div>; }
