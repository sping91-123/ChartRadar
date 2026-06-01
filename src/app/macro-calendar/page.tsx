import { redirect } from "next/navigation";

export default function MacroCalendarPage({ searchParams }: { searchParams?: { market?: string } }) {
  const query = searchParams?.market ? `?market=${encodeURIComponent(searchParams.market)}` : "";
  redirect(`/schedule${query}`);
}
