"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AlertCircle, Check, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import {
  amountText,
  dayLabel,
  monthLabel,
  money,
  normalizeAmountInput,
  parseAmount,
  validateExpense,
  type Expense,
  type ExpenseInput,
  type MonthData,
} from "@/lib/expenses";
import { api } from "@/lib/client-api";

function newestFirst(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function EntryForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<Expense[]>([]);
  const [historyMonth, setHistoryMonth] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const descriptionId = useId();
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const historyRequest = useRef(0);
  const historyMonthQuery = date.slice(0, 7);
  const normalizedDescription = description.trim().normalize("NFKC").toLocaleLowerCase();
  const filteredSuggestions = suggestions.filter((name) =>
    name.normalize("NFKC").toLocaleLowerCase().includes(normalizedDescription),
  );

  function chooseSuggestion(name: string) {
    setDescription(name);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function handleSuggestionKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (event.key === "ArrowDown" && filteredSuggestions.length) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((index) => (index + 1) % filteredSuggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && filteredSuggestions.length) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((index) => (index <= 0 ? filteredSuggestions.length - 1 : index - 1));
      return;
    }
    if (event.key === "Enter" && suggestionsOpen && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(filteredSuggestions[activeSuggestion]);
    }
  }

  const loadHistory = useCallback(async (month: string) => {
    const request = ++historyRequest.current;
    try {
      const result = await api<MonthData>(`/api/expenses?month=${month}`);
      if (request !== historyRequest.current) return;
      setHistory(newestFirst(result.expenses));
      setHistoryMonth(month);
      setHistoryError("");
    } catch (cause) {
      if (request !== historyRequest.current) return;
      setHistoryMonth(month);
      setHistoryError(cause instanceof Error ? cause.message : "Couldn't load entry history.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api<{ items: string[] }>("/api/expenses/items")
      .then(({ items }) => {
        if (active) setSuggestions(items);
      })
      .catch(() => {
        // Saved names are optional; a lookup failure should not block entry.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // History state changes only after the asynchronous API request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory(historyMonthQuery);
    return () => {
      historyRequest.current += 1;
    };
  }, [historyMonthQuery, loadHistory]);

  function editHistoryExpense(expense: Expense) {
    setEditingExpense(expense);
    setDate(expense.expense_date);
    setDescription(expense.description);
    setAmount(amountText(expense.amount_piastres));
    setNotes(expense.notes);
    setError("");
    setNotice("");
    setHistoryError("");
    setPendingDeleteId(null);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditing() {
    setEditingExpense(null);
    setDate(today);
    setDescription("");
    setAmount("");
    setNotes("");
    setError("");
    setNotice("");
    setPendingDeleteId(null);
  }

  async function removeHistoryExpense(expense: Expense) {
    if (removingId || saving) return;
    setHistoryError("");
    setRemovingId(expense.id);
    try {
      await api(`/api/expenses/${expense.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: expense.version }),
      });
      historyRequest.current += 1;
      setHistory((current) => current.filter((item) => item.id !== expense.id));
      setPendingDeleteId(null);
      if (editingExpense?.id === expense.id) {
        setEditingExpense(null);
        setDate(today);
        setDescription("");
        setAmount("");
        setNotes("");
      }
      setNotice("Expense removed.");
      void api<{ items: string[] }>("/api/expenses/items")
        .then(({ items }) => setSuggestions(items))
        .catch(() => {
          // A refreshed suggestion list is optional after deletion.
        });
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Couldn't delete this expense.");
    } finally {
      setRemovingId(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || removingId) return;
    setError("");
    setNotice("");

    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      setError("Enter a price from EGP 0.01 to EGP 9,999,999.99.");
      return;
    }

    const editTarget = editingExpense;
    let input: ExpenseInput;
    try {
      input = validateExpense(
        {
          id: editTarget?.id ?? crypto.randomUUID(),
          expense_date: date,
          amount_piastres: parsedAmount,
          description,
          category: editTarget?.category ?? "Other",
          notes,
        },
        today,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the expense details.");
      return;
    }

    busy.current = true;
    setSaving(true);
    try {
      const { expense: savedExpense } = await api<{ expense: Expense }>(
        editTarget ? `/api/expenses/${editTarget.id}` : "/api/expenses",
        {
          method: editTarget ? "PATCH" : "POST",
          body: JSON.stringify(editTarget ? { ...input, version: editTarget.version } : input),
        },
      );
      historyRequest.current += 1;
      setHistory((current) => {
        const remaining = current.filter((item) => item.id !== savedExpense.id);
        return newestFirst(
          savedExpense.expense_date.slice(0, 7) === historyMonthQuery
            ? [...remaining, savedExpense]
            : remaining,
        );
      });
      setHistoryError("");
      void loadHistory(historyMonthQuery);
      setSuggestions((current) => [
        savedExpense.description,
        ...current.filter((name) => name !== savedExpense.description),
      ]);
      if (editTarget) {
        void api<{ items: string[] }>("/api/expenses/items")
          .then(({ items }) => setSuggestions(items))
          .catch(() => {
            // A refreshed suggestion list is optional after an edit.
          });
      }
      setDescription("");
      setAmount("");
      setNotes("");
      setEditingExpense(null);
      setNotice(editTarget ? "Expense updated." : "Expense saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save. Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <form ref={formRef} className="entry-form" onSubmit={save}>
        {editingExpense ? (
          <p className="form-message form-editing" role="status">
            Editing “{editingExpense.description}”. Save changes when you’re done.
          </p>
        ) : null}
        <fieldset disabled={saving || Boolean(removingId)}>
          <label className="form-field" htmlFor="expense-date">
            <span>Date</span>
            <input
              id="expense-date"
              type="date"
              min="2000-01-01"
              max={today}
              value={date}
              disabled={saving || Boolean(removingId)}
              onChange={(event) => {
                setDate(event.target.value);
                setPendingDeleteId(null);
              }}
              required
            />
          </label>
          <div className="form-field item-combobox">
            <label htmlFor={descriptionId}>Item</label>
            <input
              id={descriptionId}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen && filteredSuggestions.length > 0}
              aria-controls={listId}
              aria-activedescendant={
                activeSuggestion >= 0 ? `${listId}-option-${activeSuggestion}` : undefined
              }
              placeholder="For example: meat, vegetables, potatoes"
              value={description}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(event) => {
                setDescription(event.target.value);
                setSuggestionsOpen(true);
                setActiveSuggestion(-1);
              }}
              onKeyDown={handleSuggestionKeyDown}
              onBlur={() => {
                setSuggestionsOpen(false);
                setActiveSuggestion(-1);
              }}
              maxLength={160}
              autoComplete="off"
              required
            />
            {suggestionsOpen && filteredSuggestions.length ? (
              <div className="item-suggestions" id={listId} role="listbox" aria-label="Saved items">
                {filteredSuggestions.map((name, index) => (
                  <button
                    type="button"
                    className={`item-suggestion ${activeSuggestion === index ? "active" : ""}`}
                    id={`${listId}-option-${index}`}
                    key={name}
                    role="option"
                    aria-selected={activeSuggestion === index}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => chooseSuggestion(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="form-field">
            <label htmlFor="expense-amount">Price (EGP)</label>
            <input
              id="expense-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
              required
            />
          </div>
          <label className="form-field" htmlFor="expense-notes">
            <span>Notes (optional)</span>
            <textarea
              id="expense-notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </fieldset>
        {error ? (
          <p className="form-message form-error" role="alert">
            <AlertCircle size={17} /> {error}
          </p>
        ) : null}
        {notice ? (
          <p className="form-message form-success" role="status">
            <Check size={17} /> {notice}
          </p>
        ) : null}
        <div className={`form-submit-row${editingExpense ? " is-editing" : ""}`}>
          <button className="save-button" type="submit" disabled={saving || Boolean(removingId)}>
            {saving ? <LoaderCircle size={17} className="spin" /> : null}
            {saving ? "Saving…" : editingExpense ? "Save changes" : "Save expense"}
          </button>
          {editingExpense ? (
            <button
              className="edit-cancel-button"
              type="button"
              disabled={saving || Boolean(removingId)}
              onClick={cancelEditing}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <section className="entry-history" aria-labelledby="entry-history-title">
        <div className="entry-history-heading">
          <h2 id="entry-history-title">Entry history</h2>
          <span>{monthLabel(historyMonthQuery)}</span>
        </div>
        {historyError ? (
          <div className="history-error" role="alert">
            <span>{historyError}</span>
            <button type="button" onClick={() => void loadHistory(historyMonthQuery)}>
              Refresh
            </button>
          </div>
        ) : null}
        <div
          className="entry-history-list"
          aria-live="polite"
          aria-busy={historyMonth !== historyMonthQuery}
        >
          {historyMonth !== historyMonthQuery ? (
            <p className="history-empty">Loading history…</p>
          ) : historyError ? null : history.length ? (
            history.map((expense) => (
              <article className="history-row" key={expense.id}>
                <div className="history-item">
                  <span>{expense.description}</span>
                  <small>
                    {dayLabel(expense.expense_date, true)}
                    {expense.notes ? ` · ${expense.notes}` : ""}
                  </small>
                </div>
                <strong className="history-price">{money(expense.amount_piastres)} EGP</strong>
                <div className="history-actions">
                  {pendingDeleteId === expense.id ? (
                    <>
                      <span className="history-confirm-label">Delete this entry?</span>
                      <button
                        className="history-cancel"
                        type="button"
                        disabled={Boolean(removingId) || saving}
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="history-delete-confirm"
                        type="button"
                        disabled={Boolean(removingId) || saving}
                        onClick={() => void removeHistoryExpense(expense)}
                      >
                        {removingId === expense.id ? "Removing…" : "Delete"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="history-edit"
                        type="button"
                        aria-label={`Edit ${expense.description} from ${dayLabel(expense.expense_date)}`}
                        disabled={Boolean(removingId) || saving}
                        onClick={() => editHistoryExpense(expense)}
                      >
                        <Pencil size={15} />
                        <span>Edit</span>
                      </button>
                      <button
                        className="history-remove"
                        type="button"
                        aria-label={`Delete ${expense.description} from ${dayLabel(expense.expense_date)}`}
                        disabled={Boolean(removingId) || saving}
                        onClick={() => setPendingDeleteId(expense.id)}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="history-empty">No expenses recorded for this month.</p>
          )}
        </div>
      </section>
    </>
  );
}
