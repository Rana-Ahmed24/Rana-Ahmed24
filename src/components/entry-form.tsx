"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { parseAmount, validateExpense, type ExpenseInput } from "@/lib/expenses";
import { api } from "@/lib/client-api";

export function EntryForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const descriptionId = useId();
  const listId = useId();
  const busy = useRef(false);
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
          category: "Other",
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
            onChange={(event) => setAmount(event.target.value)}
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
      <button className="save-button" type="submit" disabled={saving}>
        {saving ? <LoaderCircle size={17} className="spin" /> : null}
        {saving ? "Saving…" : "Save expense"}
      </button>
    </form>
  );
}
