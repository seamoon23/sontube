export const IMPERSONATION_READ_ONLY_MESSAGE =
  "대체 로그인은 읽기 전용입니다. 변경하려면 대체 로그인을 종료해 주세요.";

type AdminMutationSession = {
  impersonatedBy?: string;
};

export function isAdminMutationBlocked(session: AdminMutationSession): boolean {
  return Boolean(session.impersonatedBy);
}
