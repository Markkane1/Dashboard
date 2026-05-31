export type NotificationItem = {
  id: string;
  userId: string;
  type: "info" | "course" | "certificate" | "announcement";
  title: string;
  message: string;
  linkUrl: string;
  readAt: string | null;
  createdAt: string | null;
};

const getBaseUrl = () => process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:5000";

export async function fetchNotifications(token: string, limit = 20): Promise<NotificationItem[]> {
  const res = await fetch(`${getBaseUrl()}/api/notifications?limit=${limit}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch notifications: ${res.status}`);
  }

  return res.json();
}
