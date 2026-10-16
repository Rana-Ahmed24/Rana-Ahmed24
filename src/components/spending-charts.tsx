import { dayLabel, money, monthBounds, type MonthData } from "@/lib/expenses";

export function SpendingCharts({
  month,
  today,
  selected,
  data,
  loading,
  onSelect,
}: {
  month: string;
  today: string;
  selected: string;
  data: MonthData | null;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const days = Number(monthBounds(month)[1].slice(-2));
  const values = Array.from(
    { length: days },
    (_, i) => data?.daily[`${month}-${String(i + 1).padStart(2, "0")}`] ?? 0,
  );
  const maxDaily = Math.max(1, ...values);

  return (
    <div className="charts-layout">
      <section className="chart-card" aria-label="Daily spending chart" aria-busy={loading}>
        <div
          className="daily-chart"
          role="group"
          aria-label={`Daily spending for ${month}`}
          style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
        >
          {values.map((amount, index) => {
            const date = `${month}-${String(index + 1).padStart(2, "0")}`;
            const tick = index === 0 || (index + 1) % 5 === 0;
            return (
              <button
                key={date}
                className={`daily-chart-day ${selected === date ? "selected" : ""}`}
                type="button"
                disabled={date > today || loading}
                aria-label={`${dayLabel(date)}: ${money(amount)} EGP`}
                aria-pressed={selected === date}
                title={`${dayLabel(date)} · ${money(amount)} EGP`}
                onClick={() => onSelect(date)}
              >
                <span className="daily-chart-track">
                  <span
                    className="daily-chart-bar"
                    style={{
                      height: amount ? `${Math.max(7, (amount / maxDaily) * 100)}%` : "2px",
                    }}
                  />
                </span>
                <span className="daily-chart-tick">{tick ? index + 1 : ""}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
