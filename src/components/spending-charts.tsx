import { CATEGORY_STYLE } from "./category";
import { CATEGORIES, dayLabel, money, monthBounds, type MonthData } from "@/lib/expenses";

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
  const categories = CATEGORIES.map((category) => ({
    category,
    amount:
      data?.expenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount_piastres, 0) ?? 0,
  }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = data?.total ?? 0;
  const segments = categories.map(({ category, amount }, index) => {
    const before = categories.slice(0, index).reduce((sum, item) => sum + item.amount, 0);
    return `${CATEGORY_STYLE[category].color} ${(before / total) * 100}% ${((before + amount) / total) * 100}%`;
  });
  const categorySummary = categories
    .map(({ category, amount }) => `${category}: ${money(amount)} EGP`)
    .join(", ");

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

      <section
        className="chart-card category-chart"
        aria-label="Spending by category"
        aria-busy={loading}
      >
        <div
          className={`category-donut ${segments.length ? "has-categories" : ""}`}
          style={{
            background: segments.length ? `conic-gradient(${segments.join(", ")})` : undefined,
          }}
          role="img"
          aria-label={`Monthly total ${money(total)} EGP${categorySummary ? `; ${categorySummary}` : ""}`}
        >
          <div className="category-donut-center">
            <strong>{data ? money(total) : "—"}</strong>
            <span>EGP</span>
          </div>
        </div>
        <div className="category-breakdown">
          {categories.map(({ category, amount }) => (
            <div className="category-line" key={category}>
              <span className="category-label">
                <i style={{ background: CATEGORY_STYLE[category].color }} />
                <span title={category}>{category}</span>
              </span>
              <div className="category-bar" aria-hidden="true">
                <span
                  style={{
                    background: CATEGORY_STYLE[category].color,
                    width: `${(amount / total) * 100}%`,
                  }}
                />
              </div>
              <strong>{money(amount)}</strong>
              <span className="category-percent">{Math.round((amount / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
