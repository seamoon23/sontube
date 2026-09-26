"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { isAdminMutationBlocked } from "@/lib/admin-mutation-guard";
import { prisma } from "@/lib/db";

export async function updateWifiRequiredAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (isAdminMutationBlocked(session)) return;
  const wifiRequired = formData.get("wifiRequired") === "on";

  await prisma.family.update({
    where: { id: session.familyId },
    data: { wifiRequired },
  });

  revalidatePath("/admin");
}
