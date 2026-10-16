import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayLabel, money, monthBounds, monthLabel, moveMonth } from "@/lib/expenses";

function compact(amount: number): string {
  if (amount < 100_000) return money(amount, false);
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    amount / 100,
  );
}
export function Calendar({
  month,
  today,
  selected,
  daily,
  onSelect,
  onSelectAll,
  onMonth,
  loading,
}: {
  month: string;
  today: string;
  selected: string | "all";
  daily: Record<string, number>;
  loading: boolean;
  onSelect: (date: string) => void;
  onSelectAll: () => void;
  onMonth: (month: string) => void;
}) {
  const start = new Date(`${month}-01T12:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  const count = Number(monthBounds(month)[1].slice(-2));
  return (
    <section className="calendar-card" aria-label="Expense calendar">
      <div className="calendar-navigation">
        <button
          className="icon-button"
          aria-label="Previous month"
          disabled={month === "2000-01"}
          onClick={() => onMonth(moveMonth(month, -1))}
        >
          <ChevronLeft size={19} />
        </button>
        <label className="month-picker">
          <span>{monthLabel(month)}</span>
          <input
            aria-label="Choose month"
            type="month"
            value={month}
            min="2000-01"
            max={today.slice(0, 7)}
            onChange={(e) => {
              if (
                /^\d{4}-\d{2}$/.test(e.target.value) &&
                e.target.value >= "2000-01" &&
                e.target.value <= today.slice(0, 7)
              )
                onMonth(e.target.value);
            }}
          />
        </label>
        <button
          className="icon-button"
          aria-label="Next month"
          disabled={month >= today.slice(0, 7)}
          onClick={() => onMonth(moveMonth(month, 1))}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div className="calendar-summary-choice">
        <button
          className={`month-summary-button ${selected === "all" ? "selected" : ""}`}
          type="button"
          aria-label={`View all expenses for ${monthLabel(month)}`}
          aria-pressed={selected === "all"}
          disabled={loading}
          onClick={onSelectAll}
        >
          All month
        </button>
      </div>
      <div className="calendar-week" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className={`calendar-grid ${loading ? "is-loading" : ""}`} aria-busy={loading}>
        {Array.from({ length: offset }, (_, i) => (
          <div key={`blank-${i}`} className="calendar-blank" />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const future = date > today;
          const amount = daily[date] ?? 0;
          return (
            <button
              key={date}
              className={`calendar-day ${selected === date ? "selected" : ""} ${date === today ? "today" : ""} ${amount ? "has-spend" : ""}`}
              onClick={() => onSelect(date)}
              disabled={future || loading}
              aria-pressed={selected === date}
              aria-current={date === today ? "date" : undefined}
              aria-label={`${dayLabel(date)}, ${money(amount)} EGP${date === today ? ", today" : ""}`}
            >
              <span className="day-number">{i + 1}</span>
              <span className="day-amount">{amount ? compact(amount) : "—"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
