import Link from "next/link";
export default function NotFound() {
  return (
    <main className="app-main">
      <h1>A-Z Home Expenses</h1>
      <p>This page is unavailable.</p>
      <Link href="/?mode=view">View expenses</Link>
    </main>
  );
}
