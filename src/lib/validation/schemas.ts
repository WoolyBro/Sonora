import * as z from "zod";

import { MAX_INPUT_CHARS } from "@/lib/emotion/normalize";
import { EMOTIONS } from "@/lib/emotion/taxonomy";

const EmotionEnum = z.enum(EMOTIONS);
const unit = z.number().finite().min(0).max(1);

export const AnalyzeRequestSchema = z
  .object({
    text: z.string().max(MAX_INPUT_CHARS * 2).optional().default(""),
    selectedEmotion: EmotionEnum.optional(),
    intensity: unit.optional(),
  })
  .strict();

export const ProfileSchema = z.object({
  primaryEmotion: EmotionEnum,
  secondaryEmotions: z.array(EmotionEnum).max(3).default([]),
  scores: z.partialRecord(EmotionEnum, unit).default({}),
  intensity: unit,
});

export const RecommendRequestSchema = z
  .object({
    profile: ProfileSchema,
    shift: z.enum(["calmer", "brighter"]).optional(),
    preferences: z
      .object({
        vocals: z.enum(["any", "instrumental", "vocal"]).optional(),
        genres: z.array(z.string().max(40)).max(20).optional(),
      })
      .optional(),
    favouriteIds: z.array(z.string().max(80)).max(500).optional(),
    recentIds: z.array(z.string().max(80)).max(100).optional(),
    limit: z.number().int().min(1).max(12).optional(),
  })
  .strict();

export const FavouriteRequestSchema = z
  .object({
    trackId: z.string().min(1).max(80),
    action: z.enum(["add", "remove", "toggle"]).default("toggle"),
  })
  .strict();

export const HistoryRequestSchema = z.object({ trackId: z.string().min(1).max(80) }).strict();
