import { z } from "zod";

export const Talk = z.object({ little: z.string(), kids: z.string(), grownups: z.string() });
export type Talk = z.infer<typeof Talk>;

export const Prose = z.object({ why: z.string(), talk: Talk, pray: z.string(), do: z.string() });
export type Prose = z.infer<typeof Prose>;

/** What the model returns per night. References only; never verse text. */
export const ModelNight = z.object({
  night: z.number().int(),
  date: z.string().optional(),
  reference: z.string(),
  why: z.string(),
  talk: Talk,
  pray: z.string(),
  do: z.string(),
  es: Prose.optional(),
  flags: z.array(z.string()).optional(),
});
export type ModelNight = z.infer<typeof ModelNight>;
export const ModelWeek = z.object({ nights: z.array(ModelNight) });

export const SignupBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
  display_name: z.string().trim().min(2).max(60),
});
export const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const Sermon = z.object({ title: z.string().trim().max(120), passage: z.string().trim().max(60) });
export const ChurchCreate = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(60).optional().default(""),
  pastor_display_name: z.string().trim().min(2).max(60),
  tradition: z.enum(["hope", "prophecy", "liturgical"]).default("hope"),
  translation: z.enum(["bsb", "kjv", "web"]).default("bsb"),
  season: z.enum(["nov29", "dec1"]).default("nov29"),
  theme: z.enum(["names", "prophecy", "luke", "light"]).default("light"),
  sermons: z.array(Sermon).max(4).optional().default([]),
  xmas_eve_times: z.string().trim().max(200).optional().default(""),
  spanish_on: z.boolean().default(true),
  keep_going_on: z.boolean().default(true),
  keep_going_church_url: z.string().trim().max(200).url().or(z.literal("")).optional().default(""),
  tz: z.string().max(60).default("America/New_York"),
});
export type ChurchCreate = z.infer<typeof ChurchCreate>;
export const ChurchPatch = ChurchCreate.partial().extend({ ai_on: z.boolean().optional() });

export const NightEdit = z.object({
  reference: z.string().trim().max(60).optional(),
  why: z.string().max(400).optional(),
  talk: Talk.optional(),
  pray: z.string().max(400).optional(),
  do: z.string().max(400).optional(),
  es: Prose.optional(),
});
export const ApproveBody = z.object({ include_es: z.boolean().default(true) });
export const LightBody = z.object({ night: z.number().int().min(1).max(31), device: z.string().regex(/^[a-f0-9-]{36}$/) });
export const JoinBody = z.object({ device: z.string().regex(/^[a-f0-9-]{36}$/) });
