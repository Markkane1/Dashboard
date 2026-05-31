export type TaxonomyItem = {
  id: string;
  type: 'category' | 'sdg' | 'section' | 'topic';
  key: string;
  label: string;
  description?: string;
  order: number;
  active: boolean;
  metadata?: Record<string, unknown>;
};

const getBaseUrl = () => process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

export async function fetchTaxonomies(type?: string): Promise<TaxonomyItem[]> {
  const url = new URL(`${getBaseUrl()}/api/taxonomies`);
  if (type) url.searchParams.set('type', type);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch taxonomy items. Status: ${res.status}`);
  }
  return res.json();
}

export async function createTaxonomyItem(token: string, item: Omit<TaxonomyItem, 'id'>): Promise<TaxonomyItem> {
  const res = await fetch(`${getBaseUrl()}/api/taxonomies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to create taxonomy item: ${res.status}`);
  }
  return res.json();
}

export async function updateTaxonomyItem(token: string, id: string, updates: Partial<Omit<TaxonomyItem, 'id'>>): Promise<TaxonomyItem> {
  const res = await fetch(`${getBaseUrl()}/api/taxonomies/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to update taxonomy item: ${res.status}`);
  }
  return res.json();
}

export async function deleteTaxonomyItem(token: string, id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/taxonomies/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok && res.status !== 204) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete taxonomy item: ${res.status}`);
  }
}
