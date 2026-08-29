"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export async function updateWifiRequiredAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const wifiRequired = formData.get("wifiRequired") === "on";

  await prisma.family.update({
    where: { id: session.familyId },
    data: { wifiRequired },
  });

  revalidatePath("/admin");
}