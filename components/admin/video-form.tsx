"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createVideoAction, updateVideoAction, type ActionResult } from "@/app/admin/actions";
import { MAX_CHANNEL_DISPLAY_NAME_LENGTH } from "@/lib/channels";
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

export type VideoFormChannel = {
  id: string;
  displayName: string;
  isActive: boolean;
};

export type VideoFormInitial = {
  id: string;
  originalUrl: string;
  title: string;
  description: string;
  searchKeywords: string;
  durationText: string;
  channelId: string | null;
  safetyStatus: "PARENT_CHECKED" | "NEEDS_REVIEW" | "HIDDEN";
  isPublished: boolean;
  isLitePublished: boolean;
  liteSortOrder: number;
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
  channels: VideoFormChannel[];
  existingVideos: VideoFormVideo[];
};

const defaultValues: VideoClientInput = {
  originalUrl: "",
  title: "",
  description: "",
  searchKeywords: "",
  durationText: "",
  channelMode: "NONE",
  channelId: "",
  newChannelName: "",
  safetyStatus: "NEEDS_REVIEW",
  isPublished: false,
  isLitePublished: false,
  liteSortOrder: 0,
  isParentRecommended: false,
  playMode: "SINGLE_THEN_CLOSE",
  thumbnailType: "YOUTUBE",
  quickNewTags: "",
  tagIds: [],
};

export function VideoForm({ mode, initial, tags, channels, existingVideos }: VideoFormProps) {
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
          channelMode: initial.channelId ? "EXISTING" : "NONE",
          channelId: initial.channelId ?? "",
          newChannelName: "",
          safetyStatus: initial.safetyStatus,
          isPublished: initial.isPublished,
          isLitePublished: initial.isLitePublished,
          liteSortOrder: initial.liteSortOrder,
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
  const channelMode = watch("channelMode");
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
            aria-invalid={Boolean(errors.originalUrl) || undefined}
            aria-describedby={errors.originalUrl ? "original-url-error" : undefined}
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
            placeholder="https://www.youtube.com/watch?v=..."
            {...register("originalUrl")}
          />
          {errors.originalUrl && <p id="original-url-error" className="mt-2 text-sm text-red-700">{errors.originalUrl.message}</p>}
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
                aria-invalid={Boolean(errors.title) || undefined}
                aria-describedby={errors.title ? "video-title-error" : undefined}
                className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                {...register("title")}
              />
              {errors.title && <p id="video-title-error" className="mt-2 text-sm text-red-700">{errors.title.message}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="description">
                설명
              </label>
              <textarea
                id="description"
                rows={5}
                className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                {...register("description")}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="durationText">
                영상 시간
              </label>
              <input
                id="durationText"
                className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
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
                aria-describedby="search-keywords-help"
                className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                placeholder="예: 고양이, 알파벳, 바다, 과학실험"
                {...register("searchKeywords")}
              />
              <p id="search-keywords-help" className="mt-1 text-xs text-slate-500">
                아이 화면 검색에 쓰이는 보호자 작성 키워드입니다. YouTube 전체 검색과 연결되지 않습니다.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewThumbnail}
              alt="썸네일 미리보기"
              decoding="async"
              className="aspect-video w-full rounded-md object-cover"
            />
            <p className="mt-2 text-xs text-slate-500">썸네일 미리보기</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-ink">채널(제작자)</h2>
          <p id="channel-help" className="mt-1 text-xs leading-5 text-slate-500">
            같은 채널로 등록한 승인 영상끼리 묶어 보여줍니다. YouTube 채널의 다른 영상은 자동으로 가져오지 않습니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-describedby="channel-help">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm text-slate-800">
            <input type="radio" value="NONE" className="mt-0.5 accent-ocean" {...register("channelMode")} />
            <span>
              <span className="block font-semibold">채널 미지정</span>
              <span className="mt-1 block text-xs text-slate-500">나중에 채널을 연결할 수 있습니다.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm text-slate-800">
            <input type="radio" value="EXISTING" className="mt-0.5 accent-ocean" {...register("channelMode")} />
            <span>
              <span className="block font-semibold">기존 채널 선택</span>
              <span className="mt-1 block text-xs text-slate-500">이미 등록된 채널에 영상을 추가합니다.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm text-slate-800">
            <input type="radio" value="NEW" className="mt-0.5 accent-ocean" {...register("channelMode")} />
            <span>
              <span className="block font-semibold">새 채널 입력</span>
              <span className="mt-1 block text-xs text-slate-500">새 이름을 등록하고 이 영상에 연결합니다.</span>
            </span>
          </label>
        </div>

        {channelMode === "EXISTING" && (
          <label className="grid gap-2 text-sm font-medium text-slate-800" htmlFor="channelId">
            기존 채널
            <select
              id="channelId"
              aria-invalid={Boolean(errors.channelId) || undefined}
              aria-describedby={errors.channelId ? "channel-help channel-id-error" : "channel-help"}
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register("channelId")}
            >
              <option value="">채널을 선택해 주세요</option>
              {channels.map((channel) => (
                <option
                  key={channel.id}
                  value={channel.id}
                  disabled={!channel.isActive && channel.id !== initial?.channelId}
                >
                  {channel.displayName}{channel.isActive ? "" : " (사용 중지)"}
                </option>
              ))}
            </select>
            {channels.length === 0 && (
              <span className="text-xs font-normal text-slate-500">등록된 채널이 없습니다. 새 채널 입력을 선택해 주세요.</span>
            )}
            {errors.channelId && <span id="channel-id-error" className="text-sm font-normal text-red-700">{errors.channelId.message}</span>}
          </label>
        )}

        {channelMode === "NEW" && (
          <label className="grid gap-2 text-sm font-medium text-slate-800" htmlFor="newChannelName">
            새 채널명
            <input
              id="newChannelName"
              maxLength={MAX_CHANNEL_DISPLAY_NAME_LENGTH}
              placeholder="예: 우리집 과학교실"
              aria-invalid={Boolean(errors.newChannelName) || undefined}
              aria-describedby={errors.newChannelName ? "new-channel-help new-channel-error" : "new-channel-help"}
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register("newChannelName")}
            />
            <span id="new-channel-help" className="text-xs font-normal text-slate-500">
              띄어쓰기와 대소문자만 다른 기존 채널이 있으면 그 채널에 연결됩니다.
            </span>
            {errors.newChannelName && (
              <span id="new-channel-error" className="text-sm font-normal text-red-700">{errors.newChannelName.message}</span>
            )}
          </label>
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">검토 상태와 공개 설정</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            안전 검토
            <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2" {...register("safetyStatus")}>
              <option value="NEEDS_REVIEW">검토 필요</option>
              <option value="PARENT_CHECKED">보호자 확인 완료</option>
              <option value="HIDDEN">숨김</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-800">
            재생 모드
            <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2" {...register("playMode")}>
              <option value="SINGLE_THEN_CLOSE">한 편 보고 닫기</option>
              <option value="ALLOW_CONTINUE">계속 보기 허용</option>
            </select>
          </label>

          <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
            <input type="checkbox" className="h-4 w-4 accent-ocean" {...register("isPublished")} />
            아이 화면에 공개
          </label>
          <div className="grid gap-3 rounded-md border border-sky-200 bg-sky-50 p-3 md:col-span-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-start">
            <div className="grid gap-2">
              <label className="flex items-start gap-3 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  aria-invalid={Boolean(errors.isLitePublished) || undefined}
                  aria-describedby={errors.isLitePublished ? "lite-published-error" : undefined}
                  className="mt-0.5 h-4 w-4 accent-ocean"
                  {...register("isLitePublished")}
                />
                <span>
                  <span className="block font-semibold">Lite 웹앱에 공개</span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">
                    로그인 없이 누구나 볼 수 있는 공개 체험 목록에 포함됩니다. 보호자 확인 완료 및 아이 화면 공개 상태에서만 저장할 수 있습니다.
                  </span>
                </span>
              </label>
              {errors.isLitePublished && <p id="lite-published-error" className="text-sm text-red-700">{errors.isLitePublished.message}</p>}
            </div>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Lite 정렬순서
              <input
                type="number"
                min={0}
                max={9999}
                aria-invalid={Boolean(errors.liteSortOrder) || undefined}
                aria-describedby={errors.liteSortOrder ? "lite-sort-error" : undefined}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2"
                {...register("liteSortOrder")}
              />
              {errors.liteSortOrder && <span id="lite-sort-error" className="text-xs font-normal text-red-700">{errors.liteSortOrder.message}</span>}
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 md:col-span-3">
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
                className="min-h-11 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-ocean hover:text-ocean"
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
              className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
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
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="쉼표로 구분해서 입력"
            {...register("quickNewTags")}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">썸네일</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex min-h-11 items-center rounded-md border border-slate-200 p-3 text-sm">
            <input type="radio" value="YOUTUBE" className="mr-2 accent-ocean" {...register("thumbnailType")} />
            YouTube 기본 썸네일
          </label>
          <label className="flex min-h-11 items-center rounded-md border border-slate-200 p-3 text-sm">
            <input type="radio" value="CUSTOM" className="mr-2 accent-ocean" {...register("thumbnailType")} />
            커스텀 썸네일
          </label>
          <label className="flex min-h-11 items-center rounded-md border border-slate-200 p-3 text-sm">
            <input type="radio" value="PLACEHOLDER" className="mr-2 accent-ocean" {...register("thumbnailType")} />
            Placeholder
          </label>
        </div>
        <input
          type="file"
          name="customThumbnail"
          accept="image/png,image/jpeg,image/webp"
          className="block min-h-11 w-full text-sm text-slate-700 file:mr-4 file:min-h-11 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
        />
        <p className="text-xs leading-5 text-slate-500">
          수정 화면에서 YouTube 기본 썸네일이나 Placeholder를 선택하면 기존 커스텀 썸네일 연결은 제거됩니다.
        </p>
      </section>

      {result && !result.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" aria-live="assertive" aria-atomic="true">
          {result.message}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "저장 중" : mode === "edit" ? "수정 저장" : "영상 등록"}
        </button>
      </div>
    </form>
  );
}
