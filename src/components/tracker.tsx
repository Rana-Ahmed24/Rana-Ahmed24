"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar } from "./calendar";
import { EntryForm } from "./entry-form";
import { SpendingCharts } from "./spending-charts";
import { dayLabel, money, type MonthData } from "@/lib/expenses";

type Mode = "home" | "view" | "entry";

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
  const [selected, setSelected] = useState(initialToday);
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
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
    setError("");
  }

  function selectDay(date: string) {
    setSelected(date);
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
  const expenses = current?.expenses.filter((expense) => expense.expense_date === selected) ?? [];
  const total = current?.daily[selected] ?? 0;

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
            onMonth={changeMonth}
          />
          <section className="day-card" ref={selectedRef} aria-labelledby="day-title">
            <h2 id="day-title">{dayLabel(selected)}</h2>
            <div className="day-total">
              <span>Daily total</span>
              <strong>{current ? `${money(total)} EGP` : loading ? "Loading…" : "0.00 EGP"}</strong>
            </div>
            <div className="expense-list" aria-live="polite" aria-busy={loading && !current}>
              {!current && loading ? (
                <p className="empty-day">Loading expenses…</p>
              ) : expenses.length ? (
                expenses.map((expense) => (
                  <article className="expense-row" key={expense.id}>
                    <span>{expense.description}</span>
                    <strong>{money(expense.amount_piastres)} EGP</strong>
                  </article>
                ))
              ) : (
                <p className="empty-day">No expenses recorded for this day.</p>
              )}
            </div>
          </section>
        </div>
        <SpendingCharts
          month={month}
          today={today}
          selected={selected}
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
