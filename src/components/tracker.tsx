"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar } from "./calendar";
import { EntryForm } from "./entry-form";
import { SpendingCharts } from "./spending-charts";
import { dayLabel, monthLabel, money, type Expense, type MonthData } from "@/lib/expenses";

type Mode = "home" | "view" | "entry";
type MonthlyExpenseGroup = {
  description: string;
  amount_piastres: number;
  count: number;
  dates: Set<string>;
};

function groupMonthlyExpenses(
  expenses: Expense[],
): Array<Omit<MonthlyExpenseGroup, "dates"> & { dates: string[] }> {
  const groups = new Map<string, MonthlyExpenseGroup>();
  for (const expense of expenses) {
    const description = expense.description.trim().replace(/\s+/g, " ");
    const key = description.normalize("NFKC").toLowerCase();
    const group = groups.get(key) ?? {
      description,
      amount_piastres: 0,
      count: 0,
      dates: new Set<string>(),
    };
    group.amount_piastres += expense.amount_piastres;
    group.count += 1;
    group.dates.add(expense.expense_date);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ dates, ...group }) => ({ ...group, dates: [...dates].sort() }))
    .sort(
      (a, b) => b.amount_piastres - a.amount_piastres || a.description.localeCompare(b.description),
    );
}

export function Tracker({
  initialToday,
  initialMode,
  localPreview,
  configured,
}: {
  initialToday: string;
  initialMode: Mode;
  localPreview: boolean;
  configured: boolean;
}) {
  const mode = initialMode;
  const [today, setToday] = useState(initialToday);
  const [month, setMonth] = useState(initialToday.slice(0, 7));
  const [selected, setSelected] = useState<string | "all">(initialToday);
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedRef = useRef<HTMLElement>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch(`/api/expenses?month=${month}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn't load expenses.");
      if (sequence !== requestSequence.current) return;
      setData(result as MonthData);
      setToday(result.today as string);
      setError("");
    } catch (cause) {
      if (sequence === requestSequence.current)
        setError(cause instanceof Error ? cause.message : "Couldn't load expenses.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (mode !== "view" || !configured) return;
    // Fetch the selected month when the read-only calendar is open.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- State updates happen after the request resolves.
    void load();
  }, [configured, load, mode]);

  useEffect(() => {
    if (mode !== "view" || !configured) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [configured, load, mode]);

  function changeMonth(next: string) {
    setLoading(true);
    setMonth(next);
    setSelected((current) =>
      current === "all" ? "all" : next === today.slice(0, 7) ? today : `${next}-01`,
    );
    setError("");
  }

  function selectDay(date: string) {
    setSelected(date);
    if (window.innerWidth < 800)
      selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectAll() {
    setSelected("all");
    if (window.innerWidth < 800)
      selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!configured) {
    return (
      <>
        <Header />
        <main className="app-main">
          <p className="error-banner">Connect the expense database before using this page.</p>
        </main>
      </>
    );
  }

  if (mode === "home") {
    return (
      <>
        <Header />
        <main className="app-main">
          {localPreview ? <PreviewNote /> : null}
          <nav className="mode-chooser" aria-label="Choose what to do">
            <a href="/?mode=view">View expenses</a>
            <a href="/?mode=entry">Enter expenses</a>
          </nav>
        </main>
      </>
    );
  }

  if (mode === "entry") {
    return (
      <>
        <Header />
        <main className="app-main">
          {localPreview ? <PreviewNote /> : null}
          <EntryForm today={today} />
        </main>
      </>
    );
  }

  const current = data?.month === month ? data : null;
  const allSelected = selected === "all";
  const expenses = current?.expenses.filter((expense) => expense.expense_date === selected) ?? [];
  const monthlyGroups = allSelected ? groupMonthlyExpenses(current?.expenses ?? []) : [];
  const total = allSelected ? (current?.total ?? 0) : (current?.daily[selected] ?? 0);

  return (
    <>
      <Header />
      <main className="app-main">
        {localPreview ? <PreviewNote /> : null}
        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="plain-button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}
        <div className="view-layout">
          <Calendar
            month={month}
            today={today}
            selected={selected}
            daily={current?.daily ?? {}}
            loading={loading && !current}
            onSelect={selectDay}
            onSelectAll={selectAll}
            onMonth={changeMonth}
          />
          <section className="day-card" ref={selectedRef} aria-labelledby="day-title">
            <h2 id="day-title">{allSelected ? `All ${monthLabel(month)}` : dayLabel(selected)}</h2>
            <div className="day-total">
              <span>{allSelected ? "Month total" : "Daily total"}</span>
              <strong>{current ? `${money(total)} EGP` : loading ? "Loading…" : "0.00 EGP"}</strong>
            </div>
            <div className="expense-list" aria-live="polite" aria-busy={loading && !current}>
              {!current && loading ? (
                <p className="empty-day">Loading expenses…</p>
              ) : allSelected && monthlyGroups.length ? (
                monthlyGroups.map((group) => (
                  <article className="expense-row monthly-expense-row" key={group.description}>
                    <div className="expense-description">
                      <span>{group.description}</span>
                      <small>
                        {group.count} {group.count === 1 ? "entry" : "entries"} ·{" "}
                        {group.dates.map((date) => dayLabel(date, true)).join(", ")}
                      </small>
                    </div>
                    <strong>{money(group.amount_piastres)} EGP</strong>
                  </article>
                ))
              ) : expenses.length ? (
                expenses.map((expense) => (
                  <article className="expense-row" key={expense.id}>
                    <span>{expense.description}</span>
                    <strong>{money(expense.amount_piastres)} EGP</strong>
                  </article>
                ))
              ) : (
                <p className="empty-day">
                  {allSelected
                    ? "No expenses recorded for this month."
                    : "No expenses recorded for this day."}
                </p>
              )}
            </div>
          </section>
        </div>
        <SpendingCharts
          month={month}
          today={today}
          selected={allSelected ? "" : selected}
          data={current}
          loading={loading && !current}
          onSelect={selectDay}
        />
      </main>
    </>
  );
}

function Header() {
  return (
    <header className="app-header">
      <span className="app-title">A-Z Home Expenses</span>
    </header>
  );
}

function PreviewNote() {
  return <p className="preview-note">Local preview · sample data only</p>;
}
