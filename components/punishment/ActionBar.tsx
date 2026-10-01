import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Timer } from "@/lib/punishment/timer";
export function ActionBar({ seconds, status, onNext, onStart, onPause, onResume, onEnd }: {
    seconds: number | null;
    status: Timer["status"];
    onNext: () => void;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onEnd: () => void;
}) {
    return <footer className="punishment-actions">{status === "idle" ? <><Button variant="secondary" onClick={onNext}>下一个 <Icon name="chevron"/></Button><Button variant="secondary" onClick={onNext}><Icon name="refresh"/>换一个</Button>{seconds !== null && <Button onClick={onStart}><Icon name="play"/>开始{seconds}秒</Button>}</> : <><Button variant="secondary" onClick={status === "running" ? onPause : onResume}><Icon name={status === "running" ? "pause" : "play"}/>{status === "running" ? "暂停" : "继续"}</Button><Button onClick={onEnd}>结束</Button></>}</footer>;
}
