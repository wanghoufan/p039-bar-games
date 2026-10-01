import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { LevelDots } from "@/components/punishment/LevelDots";
import { ChallengeCard } from "@/components/punishment/ChallengeCard";
import { ActionBar } from "@/components/punishment/ActionBar";
import { challenges } from "@/content/punishment/challenges";
afterEach(cleanup);
it("shows five unnumbered dots and allows selection", () => { const change = vi.fn(); render(<LevelDots level={2} onChange={change}/>); expect(screen.getAllByRole("button")).toHaveLength(5); expect(screen.getByRole("group").textContent).toBe(""); fireEvent.click(screen.getByLabelText("选择 4")); expect(change).toHaveBeenCalledWith(4); });
it("renders exactly the stored language content", () => { for (const language of ["zh", "en", "bilingual"] as const) {
    const { container } = render(<ChallengeCard card={challenges[4]} language={language} timing={false}/>);
    expect(container.querySelectorAll("p")).toHaveLength(language === "bilingual" ? 2 : 1);
    expect(container.textContent).toContain(language === "en" ? challenges[4].en : challenges[4].zh);
    cleanup();
} });
it("uses card seconds and restores normal actions without a restart button", () => { const fn = vi.fn(); const props = { onNext: fn, onStart: fn, onPause: fn, onResume: fn, onEnd: fn }; const { rerender } = render(<ActionBar {...props} seconds={30} status="idle"/>); expect(screen.getAllByRole("button")).toHaveLength(3); expect(screen.getByText("开始30秒")).toBeVisible(); rerender(<ActionBar {...props} seconds={30} status="running"/>); expect(screen.getByText("暂停")).toBeVisible(); expect(screen.getAllByRole("button")).toHaveLength(2); rerender(<ActionBar {...props} seconds={30} status="paused"/>); expect(screen.getByText("继续")).toBeVisible(); rerender(<ActionBar {...props} seconds={null} status="idle"/>); expect(screen.getAllByRole("button")).toHaveLength(2); });
