export function FlashMessage({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  if (!notice && !error) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-teal-200 bg-teal-50 text-teal-900"
      }`}
    >
      {error ?? notice}
    </div>
  );
}
