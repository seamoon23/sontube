import { z } from "zod";

export const videoClientSchema = z.object({
  originalUrl: z.string().min(1, "YouTube URL을 입력해 주세요."),
  title: z.string().min(1, "제목을 입력해 주세요.").max(120, "제목은 120자 이하로 입력해 주세요."),
  description: z.string().max(2000, "설명은 2000자 이하로 입력해 주세요.").optional(),
  durationText: z.string().max(40, "영상 시간은 40자 이하로 입력해 주세요.").optional(),
  safetyStatus: z.enum(["PARENT_CHECKED", "NEEDS_REVIEW", "HIDDEN"]),
  isPublished: z.boolean(),
  playMode: z.enum(["SINGLE_THEN_CLOSE", "ALLOW_CONTINUE"]),
  thumbnailType: z.enum(["YOUTUBE", "CUSTOM", "PLACEHOLDER"]),
  quickNewTags: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export const tagFormSchema = z.object({
  name: z.string().min(1, "태그 이름을 입력해 주세요.").max(40, "태그 이름은 40자 이하로 입력해 주세요."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상은 #RRGGBB 형식이어야 합니다."),
  icon: z.string().max(40, "아이콘 이름은 40자 이하로 입력해 주세요.").optional(),
  description: z.string().max(500, "설명은 500자 이하로 입력해 주세요.").optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export type VideoClientInput = z.infer<typeof videoClientSchema>;
export type TagFormInput = z.infer<typeof tagFormSchema>;
