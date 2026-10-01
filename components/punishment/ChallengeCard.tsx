import type { ReactNode } from "react";
import type { Challenge, Preferences } from "@/lib/punishment/schema";
import { Icon } from "@/components/ui/Icon";
export function ChallengeCard({ card, language, timing, children }: {
    card: Challenge;
    language: Preferences["language"];
    timing: boolean;
    children?: ReactNode;
}) {
    const long = card.zh.length > 45 || card.en.length > 125;
    return <article className={`punishment-card ${timing ? "is-timing" : ""} ${long ? "is-long" : ""}`} data-card-id={card.id} aria-label="题目">
 {!timing && <Icon name="spark" className="punishment-spark"/>}
 <div className="punishment-copy" aria-live="polite">{language !== "en" && <p lang="zh-CN" className="punishment-zh">{card.zh}</p>}{language === "bilingual" && <div className="punishment-divider"/>}{language !== "zh" && <p lang="en" className="punishment-en">{card.en}</p>}</div>{children}</article>;
}
