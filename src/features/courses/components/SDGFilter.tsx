import Link from "next/link";

function hrefWithParam(searchParams: Record<string, string | undefined>, key: string, value?: string) {
  const params = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(searchParams)) {
    if (paramValue && paramKey !== "cursor") params.set(paramKey, paramValue);
  }
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const query = params.toString();
  return query ? `/courses?${query}` : "/courses";
}

export default function SDGFilter({
  activeGoal,
  goals = [1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17],
  searchParams = {},
}: {
  activeGoal?: number;
  goals?: number[];
  searchParams?: Record<string, string | undefined>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Filter by SDG</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={hrefWithParam(searchParams, "sdg")}
          className={`rounded-md px-3 py-2 text-sm font-bold ${!activeGoal ? "bg-ocean text-white" : "bg-slate-100 text-slate-700"}`}
        >
          All SDGs
        </Link>
        {goals.map((goal) => (
          <Link
            key={goal}
            href={hrefWithParam(searchParams, "sdg", String(goal))}
            className={`rounded-md px-3 py-2 text-sm font-bold ${
              activeGoal === goal ? "bg-ocean text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Goal {goal}
          </Link>
        ))}
      </div>
    </section>
  );
}
