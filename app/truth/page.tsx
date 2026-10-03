"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeonBackground } from "@/components/brand/NeonBackground";
import { Button } from "@/components/ui/Button";
import { LanguageChoices } from "@/components/punishment/LanguageSheet";
import { TruthBankChoices } from "@/components/truth/BankChoices";
import { useTruthPreferences } from "@/components/truth/useTruthPreferences";
import { newTruthSession, saveTruthSession } from "@/lib/truth/storage";

export default function TruthSetup() {
  const router = useRouter();
  const { preferences: p, update, ready } = useTruthPreferences();
  return <NeonBackground><main className="screen punishment-setup"><Link href="/">‹ 返回首页</Link><h1>真心话</h1><p>只想问，最想问的那个问题。</p><h2>题库</h2><TruthBankChoices value={p.bank} onChange={bank => update({ ...p, bank })} /><h2>语言</h2><LanguageChoices value={p.language} onChange={language => update({ ...p, language })} /><Button disabled={!ready} onClick={() => { update(p); saveTruthSession(newTruthSession()); router.push("/truth/play"); }}>开始</Button></main></NeonBackground>;
}