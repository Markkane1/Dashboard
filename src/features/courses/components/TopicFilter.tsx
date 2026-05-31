import Link from "next/link";

type TopicOption = {
  key: string;
  label: string;
};

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

export default function TopicFilter({
  topics,
  activeTopic,
  searchParams = {},
}: {
  topics: Array<string | TopicOption>;
  activeTopic?: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const topicOptions = topics.map((topic) => (
    typeof topic === "string" ? { key: topic, label: topic.replace(/-/g, " ") } : topic
  ));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Filter by topic</h2>
      <div className="mt-3 grid gap-2 text-sm font-bold">
        <Link
          href={hrefWithParam(searchParams, "topic")}
          className={`rounded-md px-3 py-2 ${!activeTopic ? 'bg-forest text-white' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'}`}
        >
          All topics
        </Link>
        {topicOptions.map((topic) => (
          <Link
            key={topic.key}
            href={hrefWithParam(searchParams, "topic", topic.key)}
            className={`rounded-md px-3 py-2 ${activeTopic === topic.key ? 'bg-forest text-white' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'}`}
          >
            {topic.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
