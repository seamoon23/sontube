import { NextResponse } from "next/server";
import {
  createLiteCatalogEtag,
  getLiteCatalog,
  LITE_CATALOG_CACHE_CONTROL,
  matchesLiteCatalogEtag,
} from "@/lib/lite-catalog";

export const dynamic = "force-dynamic";
const LITE_CATALOG_ERROR_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

export async function GET(request: Request) {
  try {
    const catalog = await getLiteCatalog();
    const etag = createLiteCatalogEtag(catalog);
    const headers = {
      "cache-control": LITE_CATALOG_CACHE_CONTROL,
      etag,
    };

    if (matchesLiteCatalogEtag(request.headers.get("if-none-match"), etag)) {
      return new NextResponse(null, { status: 304, headers });
    }

    return NextResponse.json({ ok: true, catalog }, { headers });
  } catch {
    console.error("The public Lite catalog could not be loaded.");
    return NextResponse.json(
      { ok: false, message: "공개 목록을 불러오지 못했습니다." },
      {
        status: 503,
        headers: { "cache-control": LITE_CATALOG_ERROR_CACHE_CONTROL },
      },
    );
  }
}
