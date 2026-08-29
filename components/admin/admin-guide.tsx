"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type GuideSlide = { title: string; description: string; steps: string[] };
type AdminGuide = { key: string; title: string; slides: GuideSlide[] };

const GUIDE_STORAGE_PREFIX = "sontube:admin-guide-seen:";

const guides = {
  dashboard: {
    key: "dashboard",
    title: "대시보드 사용 안내",
    slides: [
      {
        title: "먼저 관리 상태를 확인하세요",
        description: "대시보드는 등록된 영상과 공개 상태를 한눈에 보여줍니다.",
        steps: [
          "아이 화면 공개 수는 보호자 확인과 공개 설정을 모두 마친 영상 수입니다.",
          "검토 필요 수가 남아 있으면 영상 목록에서 안전 상태를 확인하세요.",
        ],
      },
      {
        title: "자주 쓰는 작업으로 이동하세요",
        description: "바로가기와 상단 메뉴는 같은 관리 기능으로 연결됩니다.",
        steps: [
          "새 영상을 추가할 때는 영상 등록을 선택하세요.",
          "아이의 반응과 내 목록은 관심 요약에서 확인할 수 있습니다.",
        ],
      },
    ],
  },
  videoList: {
    key: "video-list",
    title: "영상 목록 사용 안내",
    slides: [
      {
        title: "필요한 영상만 빠르게 찾으세요",
        description: "검색과 필터는 내부에 저장된 영상만 대상으로 합니다.",
        steps: [
          "제목이나 보호자가 입력한 검색 키워드로 찾을 수 있습니다.",
          "태그, 채널, 안전 상태, 부모 추천, 썸네일 종류를 함께 좁힐 수 있습니다.",
        ],
      },
      {
        title: "공개 조건을 확인하세요",
        description: "아이 앱에는 승인된 영상만 동기화됩니다.",
        steps: [
          "안전 상태가 보호자 확인 완료인지 확인하세요.",
          "공개 설정이 켜져 있어야 앱 카탈로그에 포함됩니다.",
        ],
      },
      {
        title: "수정 화면에서 내용을 다듬으세요",
        description: "영상 행의 수정 버튼에서 제목, 태그, 썸네일을 바꿀 수 있습니다.",
        steps: [
          "부모 추천을 켜면 앱의 최근 추천 영역에 우선 표시됩니다.",
          "영상 URL을 바꿀 때는 다른 영상으로 잘못 연결되지 않았는지 확인하세요.",
        ],
      },
    ],
  },
  videoForm: {
    key: "video-form",
    title: "영상 등록·수정 안내",
    slides: [
      {
        title: "YouTube 영상 주소를 넣으세요",
        description: "개별 영상 주소에서 videoId만 확인하며 외부 API는 사용하지 않습니다.",
        steps: [
          "채널, 검색 결과, 플레이리스트 주소는 등록되지 않습니다.",
          "이미 등록된 영상은 중복으로 추가할 수 없습니다.",
        ],
      },
      {
        title: "아이에게 보일 정보를 적으세요",
        description: "제목과 검색 키워드는 아이가 영상을 찾을 때 사용됩니다.",
        steps: [
          "검색 키워드는 제목에 없는 쉬운 표현도 함께 적어 주세요.",
          "태그는 너무 세분화하지 말고 아이가 알아볼 범위로 고르세요.",
        ],
      },
      {
        title: "썸네일과 추천 여부를 정하세요",
        description: "YouTube 기본 썸네일 또는 직접 올린 이미지를 사용할 수 있습니다.",
        steps: [
          "부모 추천은 최근에 함께 보고 싶은 영상에만 켜 두는 편이 좋습니다.",
          "저장 전 안전 확인 상태와 공개 여부를 마지막으로 확인하세요.",
        ],
      },
    ],
  },
  channels: {
    key: "channels",
    title: "채널 목록 사용 안내",
    slides: [
      {
        title: "직접 등록한 채널만 모아 봅니다",
        description: "채널은 보호자가 한 편씩 등록한 영상을 내부에서 묶는 분류입니다.",
        steps: [
          "YouTube 채널의 다른 영상은 자동으로 수집하거나 표시하지 않습니다.",
          "채널별 등록 영상 수와 아이에게 공개된 승인 영상 수를 비교할 수 있습니다.",
        ],
      },
      {
        title: "채널 영상으로 바로 이동하세요",
        description: "이 채널 영상 보기는 영상 목록의 채널 필터로 연결됩니다.",
        steps: [
          "새 영상 등록 화면에서 기존 채널을 선택하거나 새 채널명을 입력하세요.",
          "아이 앱은 같은 채널 중 승인·공개된 영상만 묶어 보여줍니다.",
        ],
      },
    ],
  },
  tags: {
    key: "tags",
    title: "태그 관리 안내",
    slides: [
      {
        title: "아이에게 익숙한 단어를 사용하세요",
        description: "태그는 아이 화면의 필터이자 영상 탐색 기준입니다.",
        steps: [
          "동물, 과학, 만들기처럼 짧고 구분하기 쉬운 이름이 좋습니다.",
          "비슷한 뜻의 태그를 여러 개 만들기보다 하나로 통일하세요.",
        ],
      },
      {
        title: "사용하지 않는 태그는 비활성화하세요",
        description: "비활성 태그는 새 선택지에서 숨기되 기존 연결 기록은 보존합니다.",
        steps: [
          "사용 횟수를 확인한 뒤 정리하면 기존 영상의 분류를 놓치지 않습니다.",
          "추천 태그는 최근 사용과 사용 빈도를 바탕으로 자동 계산됩니다.",
        ],
      },
    ],
  },
  insights: {
    key: "insights",
    title: "관심 요약 안내",
    slides: [
      {
        title: "관심 신호를 가볍게 살펴보세요",
        description: "좋아요, 궁금해요, 어려워요 같은 반응은 다음 영상을 고를 때 참고하는 신호입니다.",
        steps: [
          "한 번의 반응보다 기간별로 반복되는 태그와 키워드를 살펴보세요.",
          "감시나 평가 점수로 쓰기보다 대화의 출발점으로 활용하세요.",
        ],
      },
      {
        title: "기간을 바꿔 흐름을 비교하세요",
        description: "최근 7일, 30일, 전체 기록을 나눠 볼 수 있습니다.",
        steps: [
          "최근 관심과 오래 이어지는 관심을 구분해서 볼 수 있습니다.",
          "내 목록에 반복해서 담긴 영상도 함께 확인하세요.",
        ],
      },
      {
        title: "분석용 문장을 필요할 때만 복사하세요",
        description: "요약된 통계를 외부 AI에 직접 붙여 넣을 수 있는 문장으로 제공합니다.",
        steps: [
          "SonTube가 외부 AI API를 직접 호출하거나 비용을 발생시키지 않습니다.",
          "복사 전 개인을 특정할 수 있는 내용이 없는지 한 번 더 확인하세요.",
        ],
      },
    ],
  },
  appKeys: {
    key: "app-keys",
    title: "앱 키 사용 안내",
    slides: [
      {
        title: "기기마다 구분하기 쉬운 이름을 붙이세요",
        description: "앱 키는 승인 영상 목록을 설치형 클라이언트로 동기화할 때 사용합니다.",
        steps: [
          "예: 거실 태블릿, 주말용 휴대폰처럼 알아보기 쉬운 이름을 사용하세요.",
          "생성된 전체 키는 한 번만 표시되므로 바로 기기에 등록하세요.",
        ],
      },
      {
        title: "앱 설정에서 키를 등록하세요",
        description: "키를 등록한 기기는 보호자가 승인한 영상만 내려받습니다.",
        steps: [
          "기본 자동 동기화 간격은 1일입니다.",
          "앱은 시작하거나 다시 전면으로 돌아올 때 목록 버전을 자동으로 확인합니다.",
        ],
      },
      {
        title: "사용하지 않는 키는 중지하세요",
        description: "분실했거나 더 이상 사용하지 않는 기기의 키는 비활성화할 수 있습니다.",
        steps: [
          "비활성화한 키는 다음 동기화부터 카탈로그를 받을 수 없습니다.",
          "키 자체는 비밀번호처럼 취급하고 메신저나 공개 문서에 남기지 마세요.",
        ],
      },
      {
        title: "아이 기기에서는 화면 고정도 켜 주세요",
        description: "설치형 앱은 외부 웹 주소를 막지만 Android 홈 화면까지 단독으로 잠그지는 못합니다.",
        steps: [
          "기기에서 설정 > 보안 또는 보안 및 개인정보 보호 > 기타 보안 설정 > 앱 고정 순서로 이동하세요.",
          "완전한 전용 단말 잠금이 필요하면 관리 기기용 Lock Task 설정을 별도로 검토하세요.",
        ],
      },
    ],
  },
} satisfies Record<string, AdminGuide>;

function getGuide(pathname: string): AdminGuide {
  if (pathname === "/admin") return guides.dashboard;
  if (pathname === "/admin/videos/new" || /^\/admin\/videos\/[^/]+\/edit$/.test(pathname)) return guides.videoForm;
  if (pathname.startsWith("/admin/videos")) return guides.videoList;
  if (pathname.startsWith("/admin/channels")) return guides.channels;
  if (pathname.startsWith("/admin/tags")) return guides.tags;
  if (pathname.startsWith("/admin/insights")) return guides.insights;
  if (pathname.startsWith("/admin/app-keys")) return guides.appKeys;
  return guides.dashboard;
}
export function AdminGuideButton() {
  const pathname = usePathname();
  const guide = useMemo(() => getGuide(pathname), [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const closeGuide = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => guideButtonRef.current?.focus());
  }, []);

  const completeGuide = useCallback(() => {
    try {
      window.localStorage.setItem(`${GUIDE_STORAGE_PREFIX}${guide.key}`, "1");
    } catch {
      // localStorage can be unavailable in hardened browsers.
    }
    closeGuide();
  }, [closeGuide, guide.key]);

  useEffect(() => {
    setSlideIndex(0);
    if (guide.key !== "dashboard") {
      setIsOpen(false);
      return;
    }
    try {
      const hasSeenGuide = window.localStorage.getItem(`${GUIDE_STORAGE_PREFIX}${guide.key}`) === "1";
      setIsOpen(!hasSeenGuide);
    } catch {
      setIsOpen(false);
    }
  }, [guide.key]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGuide();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGuide, isOpen]);

  const slide = guide.slides[slideIndex];
  const isLastSlide = slideIndex === guide.slides.length - 1;

  return (
    <>
      <button
        ref={guideButtonRef}
        type="button"
        onClick={() => {
          setSlideIndex(0);
          setIsOpen(true);
        }}
        className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-ocean transition hover:border-ocean hover:bg-sky-100"
      >
        사용 안내
      </button>

      <div className={`fixed inset-0 z-50 transition ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!isOpen}>
        <button
          type="button"
          aria-label="사용 안내 닫기"
          onClick={closeGuide}
          className={`absolute inset-0 bg-slate-950/40 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
          tabIndex={-1}
        />
        <aside
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-guide-title"
          aria-describedby="admin-guide-description"
          inert={!isOpen}
          className={`absolute inset-y-0 right-0 grid w-full max-w-md grid-rows-[auto_1fr_auto] bg-white shadow-2xl transition-transform duration-200 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
            <div>
              <p className="text-sm font-semibold text-ocean">SonTube 도움말</p>
              <h2 id="admin-guide-title" className="mt-1 text-xl font-bold text-ink">{guide.title}</h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeGuide}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean"
            >
              닫기
            </button>
          </header>

          <div className="overflow-y-auto px-5 py-6" aria-live="polite">
            <p className="text-sm font-semibold text-slate-500">{slideIndex + 1} / {guide.slides.length}</p>
            <h3 className="mt-3 text-2xl font-bold leading-tight text-ink">{slide.title}</h3>
            <p id="admin-guide-description" className="mt-3 text-sm leading-6 text-slate-600">{slide.description}</p>
            <ol className="mt-7 grid gap-3">
              {slide.steps.map((step, index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 rounded-md bg-slate-50 p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-sm font-bold text-white">{index + 1}</span>
                  <span className="self-center text-sm font-medium leading-6 text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <footer className="grid grid-cols-[auto_1fr] gap-3 border-t border-slate-200 p-5">
            <button
              type="button"
              onClick={() => setSlideIndex((current) => Math.max(0, current - 1))}
              disabled={slideIndex === 0}
              className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => isLastSlide ? completeGuide() : setSlideIndex((current) => current + 1)}
              className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {isLastSlide ? "안내 완료" : "다음"}
            </button>
          </footer>
        </aside>
      </div>
    </>
  );
}
