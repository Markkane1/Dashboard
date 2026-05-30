import Link from "next/link";
import { categories } from "@/lib/data/courses";
import { Category } from "@/lib/types";

export default function CategoryTabs({ activeCategory }: { activeCategory?: Category }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <Link
        href="/courses"
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
          !activeCategory ? "bg-forest text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
        }`}
      >
        All categories
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/courses?category=${category.id}`}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
            activeCategory === category.id ? "bg-forest text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          {category.label}
        </Link>
      ))}
    </div>
  );
}
