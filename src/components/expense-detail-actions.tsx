"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

type ActiveView = "receipt" | "note" | null;

export function ExpenseDetailActions({
  expenseId,
  description,
  notes,
  hasReceipt,
}: {
  expenseId: string;
  description: string;
  notes: string;
  hasReceipt: boolean;
}) {
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const id = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasNote = Boolean(notes.trim());

  useEffect(() => {
    if (!activeView) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveView(null);
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [activeView]);

  if (!hasReceipt && !hasNote) return null;

  const title = activeView === "note" ? "Expense note" : "Receipt";
  const titleId = `${id}-title`;

  return (
    <>
      <div className="expense-detail-actions" role="group" aria-label="Expense details">
        {hasReceipt ? (
          <button
            className="expense-view-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setActiveView("receipt")}
          >
            View receipt
          </button>
        ) : null}
        {hasNote ? (
          <button
            className="expense-view-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setActiveView("note")}
          >
            View note
          </button>
        ) : null}
      </div>
      {activeView ? (
        <div className="expense-viewer-backdrop">
          <button
            className="expense-viewer-backdrop-dismiss"
            type="button"
            tabIndex={-1}
            aria-label="Close viewer"
            onClick={() => setActiveView(null)}
          />
          <section
            id={`${id}-viewer`}
            className="expense-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="expense-viewer-header">
              <h2 className="expense-viewer-title" id={titleId}>
                {title} <span>· {description}</span>
              </h2>
              <button
                ref={closeButtonRef}
                className="expense-viewer-close"
                type="button"
                aria-label={`Close ${activeView === "note" ? "note" : "receipt"}`}
                onClick={() => setActiveView(null)}
              >
                <X size={21} aria-hidden="true" />
              </button>
            </header>
            {activeView === "receipt" ? (
              <div className="expense-receipt-viewer">
                <img
                  src={`/api/expenses/${expenseId}/receipt`}
                  alt={`Receipt for ${description}`}
                />
              </div>
            ) : (
              <p className="expense-note-viewer">{notes}</p>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
