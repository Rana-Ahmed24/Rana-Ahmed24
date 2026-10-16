import { Tracker } from "@/components/tracker";
import { cairoToday } from "@/lib/expenses";
import { databaseConfigured } from "@/lib/server/database";

export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "view" || params.mode === "entry" ? params.mode : "home";

  return (
    <Tracker
      initialToday={cairoToday()}
      initialMode={mode}
      localPreview={process.env.LOCAL_PREVIEW === "1" && !process.env.VERCEL}
      configured={databaseConfigured()}
    />
  );
}
