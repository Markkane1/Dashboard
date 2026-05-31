"use client";

import { useEffect, useState, useTransition } from "react";
import { TaxonomyItem, createTaxonomyItem, deleteTaxonomyItem, fetchTaxonomies, updateTaxonomyItem } from "@/infrastructure/api/taxonomies";

const taxonomyTypes = [
  { id: "category", label: "Categories" },
  { id: "sdg", label: "SDGs" },
  { id: "section", label: "Sections" },
  { id: "topic", label: "Topics" },
] as const;

type TaxonomyManagerProps = {
  token: string;
};

export default function TaxonomyManager({ token }: TaxonomyManagerProps) {
  const [type, setType] = useState<"category" | "sdg" | "section" | "topic">("category");
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [keyValue, setKeyValue] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchTaxonomies(type)
      .then((data) => {
        if (!active) return;
        setItems(data);
        setSelectedId("");
        setKeyValue("");
        setLabel("");
        setDescription("");
        setOrder(0);
        setActive(true);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load taxonomy items");
      });

    return () => {
      active = false;
    };
  }, [type]);

  const selectItem = (item: TaxonomyItem) => {
    setSelectedId(item.id);
    setKeyValue(item.key);
    setLabel(item.label);
    setDescription(item.description || "");
    setOrder(item.order || 0);
    setActive(item.active);
    setError("");
    setMessage("");
  };

  const clearForm = () => {
    setSelectedId("");
    setKeyValue("");
    setLabel("");
    setDescription("");
    setOrder(0);
    setActive(true);
    setError("");
    setMessage("");
  };

  const refresh = () => {
    fetchTaxonomies(type)
      .then((data) => {
        setItems(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to reload taxonomy items"));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const payload = {
          type,
          key: keyValue.trim(),
          label: label.trim(),
          description: description.trim(),
          order: Number(order || 0),
          active,
        };
        if (!payload.key || !payload.label) {
          throw new Error("Key and label are required.");
        }

        if (selectedId) {
          await updateTaxonomyItem(token, selectedId, payload);
          setMessage("Taxonomy item updated.");
        } else {
          await createTaxonomyItem(token, payload);
          setMessage("Taxonomy item created.");
        }
        refresh();
        clearForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  };

  const remove = async () => {
    if (!selectedId) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        await deleteTaxonomyItem(token, selectedId);
        setMessage("Taxonomy item deleted.");
        refresh();
        clearForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      }
    });
  };

  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Taxonomy manager</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Categories, SDGs, Sections, Topics</h2>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3">
          {taxonomyTypes.map((taxonomy) => (
            <button
              key={taxonomy.id}
              type="button"
              onClick={() => setType(taxonomy.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${type === taxonomy.id ? 'bg-forest text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {taxonomy.label}
            </button>
          ))}
        </div>
      </div>

      {(message || error) && (
        <div className={`mt-6 rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-forest'}`}>
          {error || message}
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <form onSubmit={submit} className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Key
              <input
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder={type === 'sdg' ? '1' : 'example-topic'}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Label
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Human Rights"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Order
              <input
                type="number"
                value={order}
                onChange={(event) => setOrder(Number(event.target.value))}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-forest focus:ring-forest" />
              Active
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional description for administrative use"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="submit" disabled={isPending} className="rounded-full bg-forest px-4 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
              {selectedId ? 'Update item' : 'Create item'}
            </button>
            {selectedId && (
              <button type="button" onClick={remove} disabled={isPending} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                Delete
              </button>
            )}
            <button type="button" onClick={clearForm} disabled={isPending} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
              Clear
            </button>
          </div>
        </form>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">{taxonomyTypes.find((item) => item.id === type)?.label}</p>
            <button type="button" onClick={refresh} className="text-sm font-semibold text-forest hover:underline">
              Refresh
            </button>
          </div>
          <div className="mt-4 space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No items found for this type.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:border-forest hover:bg-emerald-50"
                >
                  <div className="flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                    <div className="min-w-0">
                      <p>{item.label}</p>
                      <p className="text-xs text-slate-500">{item.key} / order {item.order}</p>
                    </div>
                    <span className={`w-fit shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${item.active ? 'bg-emerald-100 text-forest' : 'bg-slate-100 text-slate-600'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
