import { Tracker } from "@/components/tracker";
import { cairoToday, validDate, validMonth } from "@/lib/expenses";
import { databaseConfigured } from "@/lib/server/database";

export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string | string[];
    month?: string | string[];
    date?: string | string[];
    item?: string | string[];
    all?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "view" || params.mode === "entry" ? params.mode : "home";
  const today = cairoToday();
  const currentMonth = today.slice(0, 7);
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const initialMonth =
    monthParam && validMonth(monthParam) && monthParam <= currentMonth ? monthParam : currentMonth;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const itemParam = typeof params.item === "string" ? params.item.trim() : "";
  const initialItem = itemParam.length <= 160 ? itemParam : "";
  const initialSelected =
    dateParam &&
    validDate(dateParam) &&
    dateParam.slice(0, 7) === initialMonth &&
    dateParam <= today
      ? dateParam
      : initialItem || params.all === "1"
        ? "all"
        : initialMonth === currentMonth
          ? today
          : `${initialMonth}-01`;

  return (
    <Tracker
      initialToday={today}
      initialMonth={initialMonth}
      initialSelected={initialSelected}
      initialItem={initialItem}
      initialMode={mode}
      localPreview={process.env.LOCAL_PREVIEW === "1" && !process.env.VERCEL}
      configured={databaseConfigured()}
    />
  );
}
