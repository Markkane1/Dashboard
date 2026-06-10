"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role, User } from "@/shared/types";
import type { AnalyticsOverview } from "@/infrastructure/api/admin";
import type { Permission, PermissionCatalogItem } from "@/shared/permissions";
import { ConfirmDialog, DashboardCard, StatCard, StatusBanner } from "@/shared/components/ui/DesignSystem";
import TaxonomyManager from "./TaxonomyManager";

type AdminPanelProps = {
  token: string;
  users: User[];
  analytics: AnalyticsOverview;
  roles: Role[];
  permissionCatalog: PermissionCatalogItem[];
};

type AdminTab = "overview" | "users" | "roles" | "taxonomy" | "messages";

const emptyRoleForm = {
  id: "",
  key: "",
  name: "",
  description: "",
  permissions: [] as Permission[],
  active: true,
  system: false,
};

async function apiRequest(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export default function AdminPanel({ token, users, analytics, roles, permissionCatalog }: AdminPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [isDeleteRoleOpen, setIsDeleteRoleOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const permissionsByModule = useMemo(
    () => permissionCatalog.reduce<Record<string, PermissionCatalogItem[]>>((groups, permission) => {
      groups[permission.module] = groups[permission.module] || [];
      groups[permission.module].push(permission);
      return groups;
    }, {}),
    [permissionCatalog]
  );

  const run = (action: () => Promise<void>, success: string) => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await action();
        setMessage(success);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  const updateUserAccess = (userId: string, roles: string[], permissions: Permission[] = []) => run(async () => {
    await apiRequest(`/users/${encodeURIComponent(userId)}/role`, token, {
      method: "PATCH",
      body: JSON.stringify({ roles, permissions }),
    });
  }, "User access updated.");

  const saveRole = (formData: FormData) => run(async () => {
    const payload = {
      key: formData.get("key"),
      name: formData.get("name"),
      description: formData.get("description"),
      active: formData.get("active") === "on",
      permissions: formData.getAll("permissions"),
    };
    const path = roleForm.id ? `/roles/${encodeURIComponent(roleForm.id)}` : "/roles";
    await apiRequest(path, token, {
      method: roleForm.id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    setRoleForm(emptyRoleForm);
  }, roleForm.id ? "Role updated." : "Role created.");

  const deleteRole = () => {
    if (!roleForm.id || roleForm.system) return;

    run(async () => {
      await apiRequest(`/roles/${encodeURIComponent(roleForm.id)}`, token, { method: "DELETE" });
      setRoleForm(emptyRoleForm);
      setIsDeleteRoleOpen(false);
    }, "Role deleted.");
  };

  const announce = (formData: FormData) => run(async () => {
    await apiRequest("/notifications/announce", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        message: formData.get("message"),
        linkUrl: formData.get("linkUrl"),
      }),
    });
  }, "Announcement sent.");

  const selectRole = (role: Role) => {
    setRoleForm({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      active: role.active,
      system: role.system,
    });
  };

  return (
    <div className="space-y-5">
      {(message || error) && (
        <StatusBanner variant={error ? "error" : "success"} title={error || message} />
      )}

      <DashboardCard className="flex gap-2 overflow-x-auto p-2" role="tablist" aria-label="Admin sections">
        {[
          ["overview", "Overview"],
          ["users", "Users"],
          ["roles", "Roles"],
          ["taxonomy", "Categories"],
          ["messages", "Messages"],
        ].map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab as AdminTab)}
            className={`rounded-md px-4 py-2 text-sm font-black ${activeTab === tab ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </DashboardCard>

      {activeTab === "overview" && (
        <div className="space-y-5">
          <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Users", analytics.users],
              ["Courses", analytics.courses],
              ["Enrollments", analytics.enrollments],
              ["Completion", `${analytics.completionRate}%`],
              ["Daily active", analytics.dailyActiveUsers],
              ["Weekly active", analytics.weeklyActiveUsers],
              ["Avg. lesson completion", `${analytics.averageLessonCompletionRate}%`],
              ["Avg. watch rate", `${analytics.averageLessonWatchRate}%`],
            ].map(([label, value]) => (
              <StatCard key={label} title={String(label)} value={value} />
            ))}
          </section>

          <DashboardCard className="p-4">
            <h2 className="text-lg font-black text-slate-950">Top courses</h2>
            <div className="mt-3 divide-y divide-slate-200">
              {analytics.topCourses.length === 0 ? (
                <p className="py-4 text-sm font-semibold text-slate-500">No enrollment data yet.</p>
              ) : analytics.topCourses.map((course) => (
                <div key={course.courseId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{course.title}</p>
                    <p className="text-xs font-semibold text-slate-500">{course.enrollments} enrollments, {course.completions} completions</p>
                  </div>
                  <span className="text-sm font-black text-teal-700">{course.completionRate}%</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      )}

      {activeTab === "users" && (
        <DashboardCard className="p-4">
          <div className="mb-3">
            <h2 className="text-lg font-black text-slate-950">User access</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Assign roles and direct permission exceptions.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {users.map((user) => (
              <form
                key={user.id}
                className="grid min-w-0 gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,520px)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  updateUserAccess(
                    user.id,
                    formData.getAll("roles").map(String),
                    formData.getAll("permissions").map(String) as Permission[]
                  );
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{user.name}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{user.permissions?.length || 0} effective permissions</p>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roles.filter((role) => role.active).map((role) => (
                      <label key={role.key} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                        <input
                          name="roles"
                          type="checkbox"
                          value={role.key}
                          defaultChecked={(user.roles?.length ? user.roles : [user.role || "student"]).includes(role.key)}
                        />
                        <span className="min-w-0 truncate">{role.name}</span>
                      </label>
                    ))}
                  </div>
                  <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                    <summary className="cursor-pointer font-black text-slate-700">Direct permission overrides</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {permissionCatalog.map((permission) => (
                        <label key={permission.id} className="flex items-start gap-2 font-semibold text-slate-600">
                          <input name="permissions" type="checkbox" value={permission.id} defaultChecked={user.directPermissions?.includes(permission.id) || false} />
                          <span>{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>

                <button type="submit" disabled={isPending} className="btn-primary h-fit">
                  Save
                </button>
              </form>
            ))}
          </div>
        </DashboardCard>
      )}

      {activeTab === "roles" && (
        <DashboardCard className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Role CRUD</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">Create reusable permission bundles.</p>
            </div>
            <button type="button" onClick={() => setRoleForm(emptyRoleForm)} className="btn-secondary">
              New role
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${roleForm.id === role.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <span className="block truncate text-sm font-black text-slate-950">{role.name}</span>
                  <span className="block text-xs font-semibold text-slate-500">{role.key} / {role.permissions.length} permissions</span>
                </button>
              ))}
            </div>

            <form
              className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveRole(new FormData(event.currentTarget));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  Role key
                  <input name="key" value={roleForm.key} onChange={(event) => setRoleForm({ ...roleForm, key: event.target.value })} readOnly={roleForm.system} required className="control mt-2 w-full" placeholder="content-reviewer" />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Role name
                  <input name="name" value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} required className="control mt-2 w-full" placeholder="Content reviewer" />
                </label>
              </div>
              <label className="block text-sm font-bold text-slate-700">
                Description
                <textarea name="description" value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} rows={2} className="control mt-2 w-full" />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input name="active" type="checkbox" checked={roleForm.active} onChange={(event) => setRoleForm({ ...roleForm, active: event.target.checked })} disabled={roleForm.system} />
                Active
              </label>
              <div className="grid gap-3 lg:grid-cols-2">
                {Object.entries(permissionsByModule).map(([moduleName, permissions]) => (
                  <div key={moduleName} className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{moduleName}</p>
                    <div className="mt-3 grid gap-2">
                      {permissions.map((permission) => (
                        <label key={permission.id} className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                          <input
                            name="permissions"
                            type="checkbox"
                            value={permission.id}
                            checked={roleForm.permissions.includes(permission.id)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...roleForm.permissions, permission.id]
                                : roleForm.permissions.filter((item) => item !== permission.id);
                              setRoleForm({ ...roleForm, permissions: next });
                            }}
                          />
                          <span>{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button disabled={isPending} className="btn-primary">
                  {roleForm.id ? "Save role" : "Create role"}
                </button>
                {roleForm.id && !roleForm.system && (
                  <button type="button" onClick={() => setIsDeleteRoleOpen(true)} disabled={isPending} className="btn-danger">
                    Delete role
                  </button>
                )}
              </div>
            </form>
          </div>
        </DashboardCard>
      )}

      {activeTab === "taxonomy" && (
        <TaxonomyManager token={token} />
      )}

      {activeTab === "messages" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            announce(new FormData(event.currentTarget));
          }}
          className="dashboard-card max-w-3xl space-y-4 p-4"
        >
          <div>
            <h2 className="text-lg font-black text-slate-950">Send announcement</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Post a notification to all users.</p>
          </div>
          <input name="title" required placeholder="Title" className="control w-full" />
          <textarea name="message" required placeholder="Message" rows={3} className="control w-full" />
          <input name="linkUrl" placeholder="/courses" className="control w-full" />
          <button disabled={isPending} className="btn-primary">
            Send announcement
          </button>
        </form>
      )}

      <ConfirmDialog
        open={isDeleteRoleOpen}
        title="Delete this role?"
        description="Users assigned to this role will lose the permissions provided by it."
        confirmLabel={isPending ? "Deleting..." : "Delete role"}
        cancelLabel="Cancel"
        onConfirm={deleteRole}
        onCancel={() => setIsDeleteRoleOpen(false)}
      />
    </div>
  );
}
