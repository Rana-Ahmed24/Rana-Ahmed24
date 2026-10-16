"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import {
  CATEGORIES,
  parseAmount,
  validateExpense,
  type Category,
  type ExpenseInput,
} from "@/lib/expenses";
import { api } from "@/lib/client-api";

export function EntryForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Groceries");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const descriptionId = useId();
  const listId = useId();
  const busy = useRef(false);

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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setError("");
    setNotice("");

    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      setError("Enter a price from EGP 0.01 to EGP 9,999,999.99.");
      return;
    }

    let input: ExpenseInput;
    try {
      input = validateExpense(
        {
          id: crypto.randomUUID(),
          expense_date: date,
          amount_piastres: parsedAmount,
          description,
          category,
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
      await api("/api/expenses", { method: "POST", body: JSON.stringify(input) });
      setSuggestions((current) => [
        input.description,
        ...current.filter((name) => name !== input.description),
      ]);
      setDescription("");
      setAmount("");
      setCategory("Groceries");
      setNotes("");
      setNotice("Expense saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save. Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={save}>
      <fieldset disabled={saving}>
        <label className="form-field" htmlFor="expense-date">
          <span>Date</span>
          <input
            id="expense-date"
            type="date"
            min="2000-01-01"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label className="form-field" htmlFor={descriptionId}>
          <span>Item</span>
          <input
            id={descriptionId}
            list={listId}
            placeholder="For example: meat, vegetables, potatoes"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={160}
            autoComplete="off"
            required
          />
          <datalist id={listId}>
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <div className="entry-row">
          <label className="form-field" htmlFor="expense-amount">
            <span>Price (EGP)</span>
            <input
              id="expense-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="form-field" htmlFor="expense-category">
            <span>Category</span>
            <select
              id="expense-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
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
      <button className="save-button" type="submit" disabled={saving}>
        {saving ? <LoaderCircle size={17} className="spin" /> : null}
        {saving ? "Saving…" : "Save expense"}
      </button>
    </form>
  );
}
