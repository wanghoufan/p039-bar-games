"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeonBackground } from "@/components/brand/NeonBackground";
import { Button } from "@/components/ui/Button";
import { LanguageChoices } from "@/components/punishment/LanguageSheet";
import { BankChoices } from "@/components/punishment/BankSheet";
import { ShieldChoices } from "@/components/punishment/ShieldSheet";
import { usePreferences } from "@/components/punishment/usePreferences";
import { newSession, saveSession } from "@/lib/punishment/session";
export default function PunishmentSetup() { const router = useRouter(); const { preferences: p, update, ready } = usePreferences(); return <NeonBackground><main className="screen punishment-setup"><Link href="/">‹ 返回首页</Link><h1>大冒险</h1><p>现实游戏定输赢，这里一键出题。</p><h2>题库</h2><BankChoices value={p.bank} onChange={bank => update({ ...p, bank })}/><h2>语言</h2><LanguageChoices value={p.language} onChange={language => update({ ...p, language })}/><h2>盾牌</h2><p>只开启今晚想玩的内容。</p><ShieldChoices disabled={p.disabledTags} onChange={disabledTags => update({ ...p, disabledTags })}/><p className="punishment-sample-note">开发示范题库 · 正式题目待人工审核</p><Button disabled={!ready} onClick={() => { update(p); saveSession(newSession()); router.push("/punishment/play"); }}>开始</Button></main></NeonBackground>; }
