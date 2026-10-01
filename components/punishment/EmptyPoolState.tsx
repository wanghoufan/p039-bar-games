import { Button } from "@/components/ui/Button";
export function EmptyPoolState({ onSwitch, onShield }: {
    onSwitch: () => void;
    onShield: () => void;
}) { return <section className="punishment-card punishment-empty"><h1>暂无可用</h1><div><Button variant="secondary" onClick={onSwitch}>切换其他</Button><Button onClick={onShield}>调整盾牌</Button></div></section>; }
