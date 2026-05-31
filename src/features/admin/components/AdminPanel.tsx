"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthoredQuizQuestion, Course, Role, User } from "@/shared/types";
import { AnalyticsOverview } from "@/infrastructure/api/admin";
import { Permission, PermissionCatalogItem } from "@/shared/permissions";
import QuizAuthoringEditor from "./QuizAuthoringEditor";

type AdminPanelProps = {
  token: string;
  courses: Course[];
  users: User[];
  analytics: AnalyticsOverview;
  roles: Role[];
  permissionCatalog: PermissionCatalogItem[];
};

async function apiRequest(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
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

function cleanQuizQuestions(questions: AuthoredQuizQuestion[]) {
  return questions
    .map((question, index) => ({
      id: question.id || `question-${index + 1}`,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()).filter(Boolean),
      correctAnswerIndex: question.correctAnswerIndex,
      explanation: question.explanation?.trim() || "",
    }))
    .filter((question) => question.prompt || question.options.length > 0);
}

const emptyRoleForm = {
  id: "",
  key: "",
  name: "",
  description: "",
  permissions: [] as Permission[],
  active: true,
  system: false,
};

export default function AdminPanel({ token, courses, users, analytics, roles, permissionCatalog }: AdminPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");
  const [quizQuestions, setQuizQuestions] = useState<AuthoredQuizQuestion[]>([]);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);

  const run = (action: () => Promise<void>) => {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  const createCourse = (formData: FormData) => run(async () => {
    await apiRequest("/courses", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        thumbnail: formData.get("thumbnail"),
        instructorName: formData.get("instructorName"),
        duration: formData.get("duration"),
        price: Number(formData.get("price") || 0),
        quizPassingScore: Number(formData.get("quizPassingScore") || 70),
        quizQuestions: cleanQuizQuestions(quizQuestions),
      }),
    });
    setQuizQuestions([]);
    setMessage("Course created.");
  });

  const createLesson = (formData: FormData) => run(async () => {
    await apiRequest("/lessons", token, {
      method: "POST",
      body: JSON.stringify({
        courseId: formData.get("courseId"),
        title: formData.get("title"),
        description: formData.get("description"),
        order: Number(formData.get("order") || 0),
        videoUrl: formData.get("videoUrl"),
        duration: Number(formData.get("duration") || 0),
        transcript: formData.get("transcript"),
        isPublished: formData.get("isPublished") === "on",
      }),
    });
    setMessage("Lesson created.");
  });

  const updateUserAccess = (userId: string, roles: string[], permissions: Permission[] = []) => run(async () => {
    await apiRequest(`/users/${userId}/role`, token, {
      method: "PATCH",
      body: JSON.stringify({ roles, permissions }),
    });
    setMessage("User access updated.");
  });

  const saveRole = (formData: FormData) => run(async () => {
    const payload = {
      key: formData.get("key"),
      name: formData.get("name"),
      description: formData.get("description"),
      active: formData.get("active") === "on",
      permissions: formData.getAll("permissions"),
    };
    const path = roleForm.id ? `/roles/${roleForm.id}` : "/roles";
    await apiRequest(path, token, {
      method: roleForm.id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    setRoleForm(emptyRoleForm);
    setMessage(roleForm.id ? "Role updated." : "Role created.");
  });

  const deleteRole = () => run(async () => {
    if (!roleForm.id || roleForm.system) return;
    await apiRequest(`/roles/${roleForm.id}`, token, { method: "DELETE" });
    setRoleForm(emptyRoleForm);
    setMessage("Role deleted.");
  });

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

  const permissionsByModule = permissionCatalog.reduce<Record<string, PermissionCatalogItem[]>>((groups, permission) => {
    groups[permission.module] = groups[permission.module] || [];
    groups[permission.module].push(permission);
    return groups;
  }, {});

  const announce = (formData: FormData) => run(async () => {
    await apiRequest("/notifications/announce", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        message: formData.get("message"),
        linkUrl: formData.get("linkUrl"),
      }),
    });
    setMessage("Announcement sent.");
  });

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-forest"}`}>
          {error || message}
        </div>
      )}

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
          <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createCourse(new FormData(event.currentTarget));
          }}
          className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-xl font-black text-slate-950">Create course</h2>
          <input name="title" required placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" required placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="category" required placeholder="Category slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="instructorName" placeholder="Instructor name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="duration" placeholder="Duration label" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="price" type="number" min="0" defaultValue="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="quizPassingScore" type="number" min="0" max="100" defaultValue="70" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="thumbnail" placeholder="Thumbnail URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <QuizAuthoringEditor questions={quizQuestions} onChange={setQuizQuestions} disabled={isPending} />
          <button disabled={isPending} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create course
          </button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            createLesson(new FormData(event.currentTarget));
          }}
          className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-xl font-black text-slate-950">Create lesson</h2>
          <select name="courseId" required value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input name="title" required placeholder="Lesson title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" placeholder="Lesson description" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="order" required type="number" min="0" defaultValue="1" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="duration" type="number" min="0" defaultValue="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <input name="videoUrl" required placeholder="/uploads/videos/example.mp4" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="transcript" placeholder="Transcript" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input name="isPublished" type="checkbox" /> Published
          </label>
          <button disabled={isPending || courses.length === 0} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create lesson
          </button>
        </form>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">User roles and permissions</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Assign one or more roles to each user. Direct permissions are reserved for exceptions and are merged with role permissions.
            </p>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="grid min-w-0 gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Effective permissions: <span className="text-forest">{user.permissions?.length || 0}</span>
                  </p>
                </div>
                <form
                  className="min-w-0 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const selectedRoles = formData.getAll("roles").map(String);
                    const selectedPermissions = formData.getAll("permissions").map(String) as Permission[];
                    updateUserAccess(user.id, selectedRoles, selectedPermissions);
                  }}
                >
                  <div className="grid gap-2 min-[420px]:grid-cols-2">
                    {roles.filter((role) => role.active).map((role) => (
                      <label key={role.key} className="flex min-w-0 items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                        <input
                          name="roles"
                          type="checkbox"
                          value={role.key}
                          defaultChecked={(user.roles?.length ? user.roles : [user.role || "student"]).includes(role.key)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-forest focus:ring-forest"
                        />
                        <span className="min-w-0">{role.name}</span>
                      </label>
                    ))}
                  </div>
                  <details className="rounded-2xl bg-white/50 p-3 text-xs">
                    <summary className="cursor-pointer font-black text-slate-600">Direct permission overrides</summary>
                    <div className="mt-3 grid gap-2">
                      {permissionCatalog.map((permission) => (
                        <label key={permission.id} className="flex items-start gap-2 font-semibold text-slate-600">
                          <input
                            name="permissions"
                            type="checkbox"
                            value={permission.id}
                            defaultChecked={user.directPermissions?.includes(permission.id) || false}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-forest focus:ring-forest"
                          />
                          <span>{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                  <button type="submit" disabled={isPending} className="w-full rounded-full bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                    Save access
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950">Role CRUD</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Roles are reusable permission bundles. Page, module, and action permissions are all controlled here.
              </p>
            </div>
            <button type="button" onClick={() => setRoleForm(emptyRoleForm)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">
              New role
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    roleForm.id === role.id ? "border-forest bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-forest"
                  }`}
                >
                  <span className="block text-sm font-black text-slate-900">{role.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{role.key} · {role.permissions.length} permissions</span>
                </button>
              ))}
            </div>

            <form
              className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveRole(new FormData(event.currentTarget));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Role key
                  <input
                    name="key"
                    value={roleForm.key}
                    onChange={(event) => setRoleForm({ ...roleForm, key: event.target.value })}
                    readOnly={roleForm.system}
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="content-reviewer"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Role name
                  <input
                    name="name"
                    value={roleForm.name}
                    onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Content reviewer"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Description
                <textarea
                  name="description"
                  value={roleForm.description}
                  onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                  rows={2}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  name="active"
                  type="checkbox"
                  checked={roleForm.active}
                  onChange={(event) => setRoleForm({ ...roleForm, active: event.target.checked })}
                  disabled={roleForm.system}
                />
                Active
              </label>
              <div className="space-y-4">
                {Object.entries(permissionsByModule).map(([moduleName, permissions]) => (
                  <div key={moduleName} className="rounded-2xl bg-white/60 p-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">{moduleName}</p>
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
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-forest focus:ring-forest"
                          />
                          <span>
                            <span className="block">{permission.label} <span className="text-[10px] uppercase text-slate-400">({permission.scope})</span></span>
                            <span className="block text-xs font-medium text-slate-500">{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button disabled={isPending} className="rounded-full bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                  {roleForm.id ? "Save role" : "Create role"}
                </button>
                {roleForm.id && !roleForm.system && (
                  <button type="button" onClick={deleteRole} disabled={isPending} className="rounded-full border border-red-200 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-60">
                    Delete role
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black text-slate-950">Learning analytics</h2>
          <div className="mt-4 space-y-3">
            {analytics.topCourses.map((course) => (
              <div key={course.courseId} className="min-w-0 rounded-md bg-slate-50 p-3">
                <div className="flex min-w-0 flex-col gap-1 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                  <p className="text-sm font-black text-slate-900">{course.title}</p>
                  <p className="shrink-0 text-xs font-bold text-forest">{course.completionRate}% complete</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{course.enrollments} enrollments, {course.completions} completions</p>
              </div>
            ))}
            {analytics.topCourses.length === 0 && <p className="text-sm text-slate-500">No enrollment data yet.</p>}
          </div>
        </section>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          announce(new FormData(event.currentTarget));
        }}
        className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-xl font-black text-slate-950">Send announcement</h2>
        <input name="title" required placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <textarea name="message" required placeholder="Message" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input name="linkUrl" placeholder="/courses" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={isPending} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
          Send to all users
        </button>
      </form>
    </div>
  );
}
