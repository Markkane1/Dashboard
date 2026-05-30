"use client";

import { useRouter } from "next/navigation";

const meas = [
  "CBD",
  "CITES",
  "UNFCCC",
  "UNCCD",
  "Basel Convention",
  "Rotterdam Convention",
  "Stockholm Convention",
  "Minamata Convention",
  "Ramsar",
  "ITPGRFA",
  "UNCLOS",
];

export default function MEADropdown({ activeMea }: { activeMea?: string }) {
  const router = useRouter();

  return (
    <label className="block rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-sm font-black uppercase tracking-wide text-slate-500">Visit MEA section</span>
      <select
        value={activeMea || ""}
        onChange={(event) => {
          const value = event.target.value;
          router.push(value ? `/courses?mea=${encodeURIComponent(value)}` : "/courses");
        }}
        className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
      >
        <option value="">Select MEA</option>
        {meas.map((mea) => (
          <option key={mea} value={mea}>
            {mea}
          </option>
        ))}
      </select>
    </label>
  );
}
