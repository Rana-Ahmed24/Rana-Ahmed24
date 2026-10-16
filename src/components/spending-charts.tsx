import { dayLabel, money, monthBounds, type MonthData } from "@/lib/expenses";

const ITEM_COLORS = ["#5b8f65", "#5b80b5", "#d19a3f", "#c77284", "#8b70b8", "#49a6a0"];

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
  const itemTotals = new Map<string, { name: string; amount: number }>();
  for (const expense of data?.expenses ?? []) {
    const name = expense.description.trim().replace(/\s+/g, " ");
    const key = name.normalize("NFKC").toLocaleLowerCase();
    const item = itemTotals.get(key) ?? { name, amount: 0 };
    item.amount += expense.amount_piastres;
    itemTotals.set(key, item);
  }
  const sortedItems = [...itemTotals.entries()]
    .map(([key, item]) => ({ key, ...item }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const topItems = sortedItems.slice(0, 5);
  const remainingAmount = sortedItems.slice(5).reduce((sum, item) => sum + item.amount, 0);
  const itemBreakdown = [
    ...topItems,
    ...(remainingAmount
      ? [{ key: "remaining", name: "Remaining items", amount: remainingAmount }]
      : []),
  ];
  const total = data?.total ?? 0;
  let accumulatedAmount = 0;
  const segments = itemBreakdown.map((item, index) => {
    const start = (accumulatedAmount / total) * 100;
    accumulatedAmount += item.amount;
    const end = (accumulatedAmount / total) * 100;
    return `${ITEM_COLORS[index]} ${start}% ${end}%`;
  });
  const itemSummary = itemBreakdown
    .map(({ name, amount }) => `${name}: ${money(amount)} EGP`)
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
      <section className="chart-card item-chart" aria-label="Spending by item" aria-busy={loading}>
        <div
          className={`item-donut ${segments.length ? "has-items" : ""}`}
          style={{
            background: segments.length ? `conic-gradient(${segments.join(", ")})` : undefined,
          }}
          role="img"
          aria-label={`Monthly total ${money(total)} EGP${itemSummary ? `; ${itemSummary}` : ""}`}
        >
          <div className="item-donut-center">
            <strong>{data ? money(total) : "—"}</strong>
            <span>EGP</span>
          </div>
        </div>
        <div className="item-breakdown">
          {itemBreakdown.map(({ key, name, amount }, index) => (
            <div className="item-line" key={key}>
              <span className="item-name" title={name}>
                <i style={{ background: ITEM_COLORS[index] }} />
                <span>{name}</span>
              </span>
              <div className="item-bar" aria-hidden="true">
                <span
                  style={{
                    background: ITEM_COLORS[index],
                    width: total ? `${(amount / total) * 100}%` : "0%",
                  }}
                />
              </div>
              <strong>{money(amount)}</strong>
              <span className="item-percent">
                {total ? `${Math.round((amount / total) * 100)}%` : "0%"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
