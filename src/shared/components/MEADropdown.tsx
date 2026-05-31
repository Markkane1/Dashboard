"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

type MEADropdownProps = {
  activeSection?: string;
  sections?: Array<string | { key: string; label: string }>;
};

export default function MEADropdown({ activeSection, sections }: MEADropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const list = sections?.length
    ? sections.map((section) => typeof section === "string" ? { key: section, label: section } : section)
    : [
        { key: "CBD", label: "CBD" },
        { key: "CITES", label: "CITES" },
        { key: "UNFCCC", label: "UNFCCC" },
        { key: "UNCCD", label: "UNCCD" },
        { key: "Basel Convention", label: "Basel Convention" },
        { key: "Rotterdam Convention", label: "Rotterdam Convention" },
        { key: "Stockholm Convention", label: "Stockholm Convention" },
        { key: "Minamata Convention", label: "Minamata Convention" },
        { key: "Ramsar", label: "Ramsar" },
        { key: "ITPGRFA", label: "ITPGRFA" },
        { key: "UNCLOS", label: "UNCLOS" },
      ];

  return (
    <label className="block rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-sm font-black uppercase tracking-wide text-slate-500">Filter by section</span>
      <select
        value={activeSection || ""}
        onChange={(event) => {
          const value = event.target.value;
          const params = new URLSearchParams(Array.from(searchParams.entries()));
          params.delete("cursor");
          if (value) {
            params.set("section", value);
          } else {
            params.delete("section");
          }
          params.delete("mea");
          const query = params.toString();
          router.push(query ? `/courses?${query}` : "/courses");
        }}
        className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
      >
        <option value="">Select section</option>
        {list.map((section) => (
          <option key={section.key} value={section.key}>
            {section.label}
          </option>
        ))}
      </select>
    </label>
  );
}
