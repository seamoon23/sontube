"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createVideoAction, updateVideoAction, type ActionResult } from "@/app/admin/actions";
import { recommendTags, type RecommendationTag, type RecommendationVideo } from "@/lib/tag-recommendations";
import { buildYouTubeThumbnailUrl, parseYouTubeVideoId } from "@/lib/youtube";
import { videoClientSchema, type VideoClientInput } from "@/lib/validation";

export type VideoFormTag = RecommendationTag & {
  color: string | null;
  description: string | null;
};

export type VideoFormVideo = Omit<RecommendationVideo, "tags"> & {
  tags: RecommendationTag[];
};

export type VideoFormInitial = {
  id: string;
  originalUrl: string;
  title: string;
  description: string;
  searchKeywords: string;
  durationText: string;
  safetyStatus: "PARENT_CHECKED" | "NEEDS_REVIEW" | "HIDDEN";
  isPublished: boolean;
  isParentRecommended: boolean;
  playMode: "SINGLE_THEN_CLOSE" | "ALLOW_CONTINUE";
  thumbnailType: "YOUTUBE" | "CUSTOM" | "PLACEHOLDER";
  tagIds: string[];
  customThumbnailPath: string | null;
};

type VideoFormProps = {
  mode: "create" | "edit";
  initial?: VideoFormInitial;
  tags: VideoFormTag[];
  existingVideos: VideoFormVideo[];
};

const defaultValues: VideoClientInput = {
  originalUrl: "",
  title: "",
  description: "",
  searchKeywords: "",
  durationText: "",
  safetyStatus: "NEEDS_REVIEW",
  isPublished: false,
  isParentRecommended: false,
  playMode: "SINGLE_THEN_CLOSE",
  thumbnailType: "YOUTUBE",
  quickNewTags: "",
  tagIds: [],
};

export function VideoForm({ mode, initial, tags, existingVideos }: VideoFormProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VideoClientInput>({
    resolver: zodResolver(videoClientSchema),
    defaultValues: initial
      ? {
          originalUrl: initial.originalUrl,
          title: initial.title,
          description: initial.description,
          searchKeywords: initial.searchKeywords,
          durationText: initial.durationText,
          safetyStatus: initial.safetyStatus,
          isPublished: initial.isPublished,
          isParentRecommended: initial.isParentRecommended,
          playMode: initial.playMode,
          thumbnailType: initial.thumbnailType,
          quickNewTags: "",
          tagIds: initial.tagIds,
        }
      : defaultValues,
  });

  const watchedUrl = watch("originalUrl");
  const watchedTitle = watch("title");
  const watchedDescription = watch("description");
  const watchedTagIds = watch("tagIds");
  const selectedTagIds = useMemo(() => watchedTagIds ?? [], [watchedTagIds]);
  const thumbnailType = watch("thumbnailType");
  const parsedUrl = parseYouTubeVideoId(watchedUrl || "");

  const suggestedTags = useMemo(() => {
    return recommendTags({
      title: watchedTitle,
      description: watchedDescription,
      tags,
      existingVideos,
      limit: 8,
    }).filter((tag) => !selectedTagIds.includes(tag.id));
  }, [existingVideos, selectedTagIds, tags, watchedDescription, watchedTitle]);

  const previewThumbnail =
    parsedUrl.ok && thumbnailType === "YOUTUBE"
      ? buildYouTubeThumbnailUrl(parsedUrl.videoId)
      : initial?.customThumbnailPath && thumbnailType === "CUSTOM"
        ? initial.customThumbnailPath
        : "/thumbnail-placeholder.svg";

  const onSubmit = handleSubmit(() => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setResult(null);
    startTransition(async () => {
      const response =
        mode === "edit" && initial
          ? await updateVideoAction(initial.id, formData)
          : await createVideoAction(formData);
      setResult(response);
    });
  });

  function addSuggestedTag(tagId: string) {
    setValue("tagIds", Array.from(new Set([...selectedTagIds, tagId])), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-6" encType="multipart/form-data">
      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="originalUrl">
            YouTube 영상 URL
          </label>
          <input
            id="originalUrl"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
            placeholder="https://www.youtube.com/watch?v=..."
            {...register("originalUrl")}
          />
          {errors.originalUrl && <p className="mt-2 text-sm text-red-700">{errors.originalUrl.message}</p>}
          {watchedUrl && !parsedUrl.ok && (
            <p className="mt-2 text-sm text-amber-700">{parsedUrl.message}</p>
          )}
          {parsedUrl.ok && (
            <p className="mt-2 break-all text-sm text-leaf">videoId: {parsedUrl.videoId}</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="title">
                제목
              </label>
              <input
                id="title"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                {...register("title")}
              />
              {errors.title && <p className="mt-2 text-sm text-red-700">{errors.title.message}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="description">
                설명
              </label>
              <textarea
                id="description"
                rows={5}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                {...register("description")}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="durationText">
                영상 시간
              </label>
              <input
                id="durationText"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                placeholder="예: 08:30, 12분"
                {...register("durationText")}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="searchKeywords">
                아이 검색 키워드
              </label>
              <input
                id="searchKeywords"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                placeholder="예: 고양이, 알파벳, 바다, 과학실험"
                {...register("searchKeywords")}
              />
              <p className="mt-1 text-xs text-slate-500">
                아이 화면 검색에 쓰이는 보호자 작성 키워드입니다. YouTube 전체 검색과 연결되지 않습니다.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewThumbnail}
              alt="썸네일 미리보기"
              className="aspect-video w-full rounded-md object-cover"
            />
            <p className="mt-2 text-xs text-slate-500">썸네일 미리보기</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">검토 상태와 공개 설정</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            안전 검토
            <select className="rounded-md border border-slate-300 px-3 py-2" {...register("safetyStatus")}>
              <option value="NEEDS_REVIEW">검토 필요</option>
              <option value="PARENT_CHECKED">보호자 확인 완료</option>
              <option value="HIDDEN">숨김</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-800">
            재생 모드
            <select className="rounded-md border border-slate-300 px-3 py-2" {...register("playMode")}>
              <option value="SINGLE_THEN_CLOSE">한 편 보고 닫기</option>
              <option value="ALLOW_CONTINUE">계속 보기 허용</option>
            </select>
          </label>

          <label className="flex items-center gap-3 self-end rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
            <input type="checkbox" className="h-4 w-4 accent-ocean" {...register("isPublished")} />
            아이 화면에 공개
          </label>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 md:col-span-3">
            <input type="checkbox" className="h-4 w-4 accent-coral" {...register("isParentRecommended")} />
            부모님 최근 추천에 올리기
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">태그</h2>
        {suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-ocean hover:text-ocean"
                onClick={() => addSuggestedTag(tag.id)}
              >
                + {tag.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <label
              key={tag.id}
              className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
            >
              <input type="checkbox" value={tag.id} className="h-4 w-4 accent-ocean" {...register("tagIds")} />
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: tag.color ?? "#0369a1" }}
                aria-hidden="true"
              />
              {tag.name}
            </label>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-800">
          빠른 새 태그
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="쉼표로 구분해서 입력"
            {...register("quickNewTags")}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">썸네일</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="rounded-md border border-slate-200 p-3 text-sm">
            <input type="radio" value="YOUTUBE" className="mr-2 accent-ocean" {...register("thumbnailType")} />
            YouTube 기본 썸네일
          </label>
          <label className="rounded-md border border-slate-200 p-3 text-sm">
            <input type="radio" value="CUSTOM" className="mr-2 accent-ocean" {...register("thumbnailType")} />
            커스텀 썸네일
          </label>
          <label className="rounded-md border border-slate-200 p-3 text-sm">
            <input type="radio" value="PLACEHOLDER" className="mr-2 accent-ocean" {...register("thumbnailType")} />
            Placeholder
          </label>
        </div>
        <input
          type="file"
          name="customThumbnail"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
        />
        <p className="text-xs leading-5 text-slate-500">
          수정 화면에서 YouTube 기본 썸네일이나 Placeholder를 선택하면 기존 커스텀 썸네일 연결은 제거됩니다.
        </p>
      </section>

      {result && !result.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {result.message}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "저장 중" : mode === "edit" ? "수정 저장" : "영상 등록"}
        </button>
      </div>
    </form>
  );
}
