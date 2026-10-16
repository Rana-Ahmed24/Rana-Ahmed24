"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="gate">
      <div className="gate-card">
        <h1>Something interrupted the tracker.</h1>
        <p>Try opening it again. Any expenses already saved are still in your database.</p>
        <button className="primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
