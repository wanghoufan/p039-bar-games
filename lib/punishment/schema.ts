import { z } from "zod";
export const levels = [1, 2, 3, 4, 5] as const;
export const tags = { performance: "表演", embarrassing: "尴尬", flirt: "暧昧", contact: "身体接触", kiss: "亲吻", drinking: "饮酒", private: "私密" } as const;
export const levelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export const challengeSchema = z.object({ id: z.string().refine(value => value.trim().length > 0, "Must not be blank"), level: levelSchema, zh: z.string().refine(value => value.trim().length > 0, "Must not be blank"), en: z.string().refine(value => value.trim().length > 0, "Must not be blank"), contentTags: z.array(z.enum(Object.keys(tags) as [
        keyof typeof tags,
        ...Array<keyof typeof tags>
    ])), timerSeconds: z.number().int().positive().nullable().default(null) }).strict();
export type Challenge = z.infer<typeof challengeSchema>;
export type Level = Challenge["level"];
export const preferencesSchema = z.object({ language: z.enum(["zh", "bilingual", "en"]), disabledTags: z.array(z.string()), theme: z.enum(["system", "dark", "light"]), sound: z.boolean(), vibration: z.boolean(), bank: z.enum(["normal", "couple", "oneMany"]).default("normal") });
export type Preferences = z.infer<typeof preferencesSchema>;
const byLevel = z.object({ 1: z.array(z.string()), 2: z.array(z.string()), 3: z.array(z.string()), 4: z.array(z.string()), 5: z.array(z.string()) });
export const sessionSchema = z.object({ selectedLevel: levelSchema, currentCardId: z.string().nullable(), usedCardIdsByLevel: byLevel, orderByLevel: byLevel });
export type Session = z.infer<typeof sessionSchema>;
