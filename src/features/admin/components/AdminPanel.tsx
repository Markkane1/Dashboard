"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CertificateQueueItem, CohortRosterPreview, Course, ReportPreview, Role, User } from "@/shared/types";
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
  courses: Course[];
};

type AdminTab = "overview" | "operations" | "users" | "roles" | "taxonomy" | "cohorts" | "reports" | "audit" | "messages";

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

async function apiUpload(path: string, token: string, formData: FormData) {
  const res = await fetch(`/api/admin${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export default function AdminPanel({ token, users, analytics, roles, permissionCatalog, courses }: AdminPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [cohorts, setCohorts] = useState<Array<{ id: string; title: string; status: string; courseIds: string[]; trainerIds: string[]; seatLimit?: number }>>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [rosterPreview, setRosterPreview] = useState<CohortRosterPreview | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; actorEmail: string; action: string; entityType: string; entityId: string; createdAt: string }>>([]);
  const [courseApprovals, setCourseApprovals] = useState<Course[]>([]);
  const [certificateApprovals, setCertificateApprovals] = useState<CertificateQueueItem[]>([]);
  const [revocations, setRevocations] = useState<CertificateQueueItem[]>([]);
  const [reportPreview, setReportPreview] = useState<ReportPreview | null>(null);
  const [cohortForm, setCohortForm] = useState({ title: "", courseIds: [] as string[], trainerIds: [] as string[], startsAt: "", endsAt: "", seatLimit: 0 });
  const [reportFilters, setReportFilters] = useState({ type: "completion", courseId: "", cohortId: "", status: "", from: "", to: "", approvalStatus: "", revoked: "" });
  const [auditFilters, setAuditFilters] = useState({ actorId: "", action: "", entityType: "", entityId: "", from: "", to: "" });
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
  const trainerOptions = useMemo(
    () => users.filter((user) => user.role === "instructor" || user.roles?.includes("instructor") || user.role === "admin"),
    [users]
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

  const loadCohorts = () => run(async () => {
    setCohorts(await apiRequest("/cohorts", token));
  }, "Cohorts loaded.");

  const createCohort = (formData: FormData) => run(async () => {
    await apiRequest("/cohorts", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        courseIds: cohortForm.courseIds,
        trainerIds: cohortForm.trainerIds,
        startsAt: formData.get("startsAt") || undefined,
        endsAt: formData.get("endsAt") || undefined,
        seatLimit: Number(formData.get("seatLimit") || 0),
        status: "active",
      }),
    });
    setCohortForm({ title: "", courseIds: [], trainerIds: [], startsAt: "", endsAt: "", seatLimit: 0 });
    setCohorts(await apiRequest("/cohorts", token));
  }, "Cohort created.");

  const loadAuditLogs = () => run(async () => {
    const params = new URLSearchParams({ limit: "100" });
    Object.entries(auditFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setAuditLogs(await apiRequest(`/audit-logs?${params.toString()}`, token));
  }, "Audit logs loaded.");

  const loadOperations = () => run(async () => {
    const [courseQueue, certificateQueue, revokedQueue] = await Promise.all([
      apiRequest("/courses/approvals?status=pending", token),
      apiRequest("/certificates/approvals?status=pending", token),
      apiRequest("/certificates/revocations", token),
    ]);
    setCourseApprovals(courseQueue);
    setCertificateApprovals(certificateQueue);
    setRevocations(revokedQueue);
  }, "Operations queue loaded.");

  const reviewCourse = (courseId: string, action: "approve" | "reject") => run(async () => {
    await apiRequest(`/courses/${encodeURIComponent(courseId)}/approval`, token, {
      method: "POST",
      body: JSON.stringify({ action, comments: action === "approve" ? "Approved from operations console." : "Rejected from operations console." }),
    });
    setCourseApprovals(await apiRequest("/courses/approvals?status=pending", token));
  }, `Course ${action}d.`);

  const reviewCertificate = (item: CertificateQueueItem, status: "approved" | "rejected") => run(async () => {
    await apiRequest(`/certificates/${encodeURIComponent(item.courseId)}/approval`, token, {
      method: "POST",
      body: JSON.stringify({ userId: item.userId, status, comments: status === "approved" ? "Approved from operations console." : "Rejected from operations console." }),
    });
    setCertificateApprovals(await apiRequest("/certificates/approvals?status=pending", token));
  }, `Certificate ${status}.`);

  const previewRosterImport = (formData: FormData) => run(async () => {
    const cohortId = String(formData.get("cohortId") || selectedCohortId);
    if (!cohortId) throw new Error("Select a cohort before importing.");
    const upload = new FormData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV or XLSX roster file.");
    upload.set("file", file);
    const preview = await apiUpload(`/cohorts/${encodeURIComponent(cohortId)}/members/import/preview`, token, upload);
    setSelectedCohortId(cohortId);
    setRosterPreview(preview);
  }, "Roster preview ready.");

  const confirmRosterImport = () => {
    if (!selectedCohortId || !rosterPreview) return;
    run(async () => {
      await apiRequest(`/cohorts/${encodeURIComponent(selectedCohortId)}/members/import/confirm`, token, {
        method: "POST",
        body: JSON.stringify({ rows: rosterPreview.rows.filter((row) => row.status === "ready") }),
      });
      setRosterPreview(null);
      setCohorts(await apiRequest("/cohorts", token));
    }, "Roster imported.");
  };

  const reportQuery = (format?: string) => {
    const params = new URLSearchParams();
    Object.entries(reportFilters).forEach(([key, value]) => {
      if (key !== "type" && value) params.set(key, value);
    });
    if (format) params.set("format", format);
    const query = params.toString();
    return `/api/admin/reports/${encodeURIComponent(reportFilters.type)}/export${query ? `?${query}` : ""}`;
  };

  const auditReportQuery = (format?: string) => {
    const params = new URLSearchParams();
    Object.entries(auditFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (format) params.set("format", format);
    const query = params.toString();
    return `/api/admin/reports/audit-logs/export${query ? `?${query}` : ""}`;
  };

  const previewReport = () => run(async () => {
    const params = new URLSearchParams();
    Object.entries(reportFilters).forEach(([key, value]) => {
      if (key !== "type" && value) params.set(key, value);
    });
    const query = params.toString();
    setReportPreview(await apiRequest(`/reports/${encodeURIComponent(reportFilters.type)}/preview${query ? `?${query}` : ""}`, token));
  }, "Report preview loaded.");

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
          ["operations", "Operations"],
          ["users", "Users"],
          ["roles", "Roles"],
          ["taxonomy", "Categories"],
          ["cohorts", "Cohorts"],
          ["reports", "Reports"],
          ["audit", "Audit"],
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

      {activeTab === "operations" && (
        <div className="space-y-5">
          <DashboardCard className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Operations console</h2>
                <p className="text-sm font-semibold text-slate-600">Review pending course and certificate governance actions.</p>
              </div>
              <button type="button" onClick={loadOperations} className="btn-secondary">Refresh queues</button>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-950">Course approvals</p>
                <div className="mt-3 space-y-3">
                  {courseApprovals.length === 0 ? <p className="text-sm font-semibold text-slate-500">No pending courses loaded.</p> : courseApprovals.map((course) => (
                    <div key={course.id} className="rounded-md bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-950">{course.title}</p>
                      <p className="text-xs font-semibold text-slate-500">{course.category} / {course.approvalStatus}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => reviewCourse(course.id, "approve")} className="btn-primary">Approve</button>
                        <button type="button" onClick={() => reviewCourse(course.id, "reject")} className="btn-danger">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-950">Certificate approvals</p>
                <div className="mt-3 space-y-3">
                  {certificateApprovals.length === 0 ? <p className="text-sm font-semibold text-slate-500">No pending certificates loaded.</p> : certificateApprovals.map((item) => (
                    <div key={item.id} className="rounded-md bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-950">{item.learnerName || item.learnerEmail}</p>
                      <p className="text-xs font-semibold text-slate-500">{item.courseTitle} / {item.serialNumber || item.certificateId}</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => reviewCertificate(item, "approved")} className="btn-primary">Approve</button>
                        <button type="button" onClick={() => reviewCertificate(item, "rejected")} className="btn-danger">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-950">Revoked certificates</p>
                <div className="mt-3 space-y-3">
                  {revocations.length === 0 ? <p className="text-sm font-semibold text-slate-500">No revocations loaded.</p> : revocations.map((item) => (
                    <div key={item.id} className="rounded-md bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-950">{item.serialNumber || item.certificateId}</p>
                      <p className="text-xs font-semibold text-slate-500">{item.learnerName} / {item.revocationReason || "No reason recorded"}</p>
                    </div>
                  ))}
                </div>
              </div>
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

      {activeTab === "cohorts" && (
        <DashboardCard className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Training batches / cohorts</h2>
              <p className="text-sm font-semibold text-slate-600">Create official training batches, assign trainers, and bulk-import learner rosters.</p>
            </div>
            <button type="button" onClick={loadCohorts} className="btn-secondary">Refresh</button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); createCohort(new FormData(event.currentTarget)); }} className="grid gap-3 lg:grid-cols-3">
            <input name="title" value={cohortForm.title} onChange={(event) => setCohortForm({ ...cohortForm, title: event.target.value })} required placeholder="Cohort title" className="control" />
            <select
              multiple
              value={cohortForm.courseIds}
              onChange={(event) => setCohortForm({ ...cohortForm, courseIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}
              className="control min-h-28"
            >
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            <select
              multiple
              value={cohortForm.trainerIds}
              onChange={(event) => setCohortForm({ ...cohortForm, trainerIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}
              className="control min-h-28"
            >
              {trainerOptions.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name} ({trainer.email})</option>)}
            </select>
            <input name="startsAt" value={cohortForm.startsAt} onChange={(event) => setCohortForm({ ...cohortForm, startsAt: event.target.value })} type="date" className="control" />
            <input name="endsAt" value={cohortForm.endsAt} onChange={(event) => setCohortForm({ ...cohortForm, endsAt: event.target.value })} type="date" className="control" />
            <input name="seatLimit" value={cohortForm.seatLimit} onChange={(event) => setCohortForm({ ...cohortForm, seatLimit: Number(event.target.value) })} type="number" min="0" className="control" />
            <button disabled={isPending} className="btn-primary lg:col-span-3">Create cohort</button>
          </form>
          <form onSubmit={(event) => { event.preventDefault(); previewRosterImport(new FormData(event.currentTarget)); }} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select name="cohortId" value={selectedCohortId} onChange={(event) => setSelectedCohortId(event.target.value)} required className="control">
              <option value="">Select cohort for roster import</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.title}</option>)}
            </select>
            <input name="file" type="file" accept=".csv,.xlsx" className="control" />
            <button type="submit" disabled={isPending} className="btn-secondary">Preview roster</button>
          </form>
          {rosterPreview && (
            <div className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-black text-slate-950">{rosterPreview.readyRows} ready / {rosterPreview.blockedRows} blocked / {rosterPreview.totalRows} rows</p>
                <button type="button" onClick={confirmRosterImport} disabled={isPending || rosterPreview.readyRows === 0} className="btn-primary">Confirm import</button>
              </div>
              <div className="mt-3 max-h-64 overflow-auto rounded-md border border-slate-200">
                {rosterPreview.rows.map((row) => (
                  <div key={`${row.rowNumber}-${row.email}`} className="grid gap-2 border-b border-slate-100 p-2 text-xs sm:grid-cols-[80px_minmax(0,1fr)_120px_minmax(0,1fr)]">
                    <span className="font-bold text-slate-500">Row {row.rowNumber}</span>
                    <span className="truncate font-semibold text-slate-800">{row.email}</span>
                    <span className={row.status === "ready" ? "font-black text-emerald-700" : "font-black text-red-700"}>{row.status}</span>
                    <span className="text-slate-500">{row.errors.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
            {cohorts.length === 0 ? <p className="p-3 text-sm font-semibold text-slate-500">No cohorts loaded.</p> : cohorts.map((cohort) => (
              <div key={cohort.id} className="p-3 text-sm">
                <p className="font-black text-slate-950">{cohort.title}</p>
                <p className="text-xs font-semibold text-slate-500">{cohort.status} / {cohort.courseIds.length} courses / {cohort.trainerIds.length} trainers / {cohort.seatLimit || "unlimited"} seats</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {activeTab === "reports" && (
        <DashboardCard className="space-y-4 p-4">
          <h2 className="text-lg font-black text-slate-950">Compliance exports</h2>
          <p className="text-sm font-semibold text-slate-600">Preview and download filtered launch compliance reports.</p>
          <div className="grid gap-3 lg:grid-cols-4">
            <select value={reportFilters.type} onChange={(event) => setReportFilters({ ...reportFilters, type: event.target.value })} className="control">
              {["cohort-roster", "completion", "quiz-results", "certificates", "assignment-submissions", "audit-logs", "courses", "users"].map((report) => (
                <option key={report} value={report}>{report.replace(/-/g, " ")}</option>
              ))}
            </select>
            <select value={reportFilters.courseId} onChange={(event) => setReportFilters({ ...reportFilters, courseId: event.target.value })} className="control">
              <option value="">All courses</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            <select value={reportFilters.cohortId} onChange={(event) => setReportFilters({ ...reportFilters, cohortId: event.target.value })} className="control">
              <option value="">All cohorts</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.title}</option>)}
            </select>
            <input value={reportFilters.status} onChange={(event) => setReportFilters({ ...reportFilters, status: event.target.value })} placeholder="Status filter" className="control" />
            <input value={reportFilters.from} onChange={(event) => setReportFilters({ ...reportFilters, from: event.target.value })} type="date" className="control" />
            <input value={reportFilters.to} onChange={(event) => setReportFilters({ ...reportFilters, to: event.target.value })} type="date" className="control" />
            <select value={reportFilters.approvalStatus} onChange={(event) => setReportFilters({ ...reportFilters, approvalStatus: event.target.value })} className="control">
              <option value="">Any approval</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={reportFilters.revoked} onChange={(event) => setReportFilters({ ...reportFilters, revoked: event.target.value })} className="control">
              <option value="">Any revocation</option>
              <option value="true">Revoked</option>
              <option value="false">Not revoked</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={previewReport} className="btn-secondary">Preview count</button>
            <a className="btn-secondary" href={reportQuery()}>CSV</a>
            <a className="btn-secondary" href={reportQuery("xlsx")}>XLSX</a>
            <a className="btn-secondary" href={reportQuery("pdf")}>PDF</a>
          </div>
          {reportPreview && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-950">{reportPreview.rowCount} matching rows</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-white p-3 text-xs text-slate-700">{JSON.stringify(reportPreview.sample, null, 2)}</pre>
            </div>
          )}
        </DashboardCard>
      )}

      {activeTab === "audit" && (
        <DashboardCard className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Audit logs</h2>
              <p className="text-sm font-semibold text-slate-600">Review governed actions and compliance exports.</p>
            </div>
            <button type="button" onClick={loadAuditLogs} className="btn-secondary">Refresh</button>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <input value={auditFilters.actorId} onChange={(event) => setAuditFilters({ ...auditFilters, actorId: event.target.value })} placeholder="Actor ID" className="control" />
            <input value={auditFilters.action} onChange={(event) => setAuditFilters({ ...auditFilters, action: event.target.value })} placeholder="Action, e.g. certificate.approved" className="control" />
            <input value={auditFilters.entityType} onChange={(event) => setAuditFilters({ ...auditFilters, entityType: event.target.value })} placeholder="Entity type" className="control" />
            <input value={auditFilters.entityId} onChange={(event) => setAuditFilters({ ...auditFilters, entityId: event.target.value })} placeholder="Entity ID" className="control" />
            <input value={auditFilters.from} onChange={(event) => setAuditFilters({ ...auditFilters, from: event.target.value })} type="date" className="control" />
            <input value={auditFilters.to} onChange={(event) => setAuditFilters({ ...auditFilters, to: event.target.value })} type="date" className="control" />
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href={auditReportQuery("csv")}>Export CSV</a>
            <a className="btn-secondary" href={auditReportQuery("xlsx")}>Export XLSX</a>
            <a className="btn-secondary" href={auditReportQuery("pdf")}>Export PDF</a>
          </div>
          <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
            {auditLogs.length === 0 ? <p className="p-3 text-sm font-semibold text-slate-500">No audit logs loaded.</p> : auditLogs.map((log) => (
              <div key={log.id} className="p-3 text-sm">
                <p className="font-black text-slate-950">{log.action} <span className="font-semibold text-slate-500">on {log.entityType}</span></p>
                <p className="text-xs font-semibold text-slate-500">{log.actorEmail || "system"} / {log.entityId} / {new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
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
