"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthoredQuizQuestion, Course, Lesson } from "@/shared/types";
import { fetchTaxonomies } from "@/infrastructure/api/taxonomies";
import {
  AdminSidebar,
  ConfirmDialog,
  DashboardCard,
  EmptyState,
  StatusBanner,
} from "@/shared/components/ui/DesignSystem";
import QuizAuthoringEditor from "./QuizAuthoringEditor";

type ContentManagerPanelProps = {
  token: string;
  courses: Course[];
};

type CourseForm = {
  title: string;
  description: string;
  category: string;
  instructorName: string;
  duration: string;
  thumbnail: string;
  price: number;
  quizPassingScore: number;
  sdgGoals: number[];
  topics: string[];
  sections: string[];
  syllabusUrl: string;
  isDiploma: boolean;
  isExternal: boolean;
  externalUrl: string;
  diplomaRequiredCourseIds: string[];
};

type LessonForm = {
  title: string;
  description: string;
  order: number;
  videoUrl: string;
  duration: number;
  transcript: string;
  isPublished: boolean;
};

type TaxonomyOption = {
  id: string;
  label: string;
};

type WorkspaceTab = "details" | "lessons" | "quiz";
type PendingDelete = "course" | "lesson" | null;

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
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

  return res.status === 204 ? (null as T) : res.json();
}

function getCourseForm(course?: Course | null): CourseForm {
  return {
    title: course?.title || "",
    description: course?.description || "",
    category: course?.category || "",
    instructorName: course?.instructorName || "",
    duration: course?.duration || "",
    thumbnail: course?.thumbnail || "",
    price: course?.price || 0,
    quizPassingScore: course?.quizPassingScore || 70,
    sdgGoals: course?.sdgGoals || [],
    topics: course?.topics || [],
    sections: course?.sections || course?.mea || [],
    syllabusUrl: course?.syllabusUrl || "",
    isDiploma: Boolean(course?.isDiploma),
    isExternal: Boolean(course?.isExternal),
    externalUrl: course?.externalUrl || "",
    diplomaRequiredCourseIds: course?.diplomaRequiredCourseIds || [],
  };
}

function getLessonForm(lesson?: Lesson | null): LessonForm {
  return {
    title: lesson?.title || "",
    description: lesson?.description || "",
    order: lesson?.order || 1,
    videoUrl: lesson?.videoUrl || "",
    duration: lesson?.duration || 0,
    transcript: lesson?.transcript || "",
    isPublished: Boolean(lesson?.isPublished),
  };
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

function fieldClass(extra = "") {
  return `w-full rounded-md border border-slate-300 px-3 py-2 text-sm ${extra}`;
}

function getCoursePayload(form: CourseForm, quizQuestions?: AuthoredQuizQuestion[]) {
  return {
    ...form,
    price: Number(form.price || 0),
    quizPassingScore: Number(form.quizPassingScore || 70),
    sdgGoals: form.sdgGoals,
    topics: form.topics,
    sections: form.sections,
    quizQuestions: quizQuestions ? cleanQuizQuestions(quizQuestions) : undefined,
  };
}

export default function ContentManagerPanel({ token, courses }: ContentManagerPanelProps) {
  const router = useRouter();
  const [courseList, setCourseList] = useState<Course[]>(courses);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(courses[0] || null);
  const [courseForm, setCourseForm] = useState<CourseForm>(getCourseForm(courses[0]));
  const [createForm, setCreateForm] = useState<CourseForm>(getCourseForm(null));
  const [quizQuestions, setQuizQuestions] = useState<AuthoredQuizQuestion[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [lessonForm, setLessonForm] = useState<LessonForm>(getLessonForm());
  const [newLessonForm, setNewLessonForm] = useState<LessonForm>(getLessonForm());
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const [sdgOptions, setSdgOptions] = useState<number[]>([1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("details");
  const [isCreatingCourse, setIsCreatingCourse] = useState(courses.length === 0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isPending, startTransition] = useTransition();

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson._id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );
  const requiredCourseOptions = courseList.filter((course) => course.id !== selectedCourseId && !course.isDiploma);
  const createRequiredCourseOptions = courseList.filter((course) => !course.isDiploma);
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return courseList;

    return courseList.filter((course) => (
      course.title.toLowerCase().includes(normalizedQuery) ||
      course.category.toLowerCase().includes(normalizedQuery) ||
      (course.instructorName || "").toLowerCase().includes(normalizedQuery)
    ));
  }, [courseList, query]);

  const run = (action: () => Promise<void>, success: string) => {
    setStatus("");
    setError("");
    startTransition(async () => {
      try {
        await action();
        setStatus(success);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  useEffect(() => {
    setCourseList(courses);
  }, [courses]);

  useEffect(() => {
    let active = true;

    async function loadTaxonomies() {
      try {
        const [categoryItems, topicItems, sectionItems, sdgItems] = await Promise.all([
          fetchTaxonomies("category"),
          fetchTaxonomies("topic"),
          fetchTaxonomies("section"),
          fetchTaxonomies("sdg"),
        ]);

        if (!active) return;
        setCategories(categoryItems.map((item) => ({ id: item.key, label: item.label })));
        setTopicOptions(topicItems.map((item) => item.key));
        setSectionOptions(sectionItems.map((item) => item.key));

        const parsedSdgs = sdgItems
          .map((item) => Number(item.key))
          .filter((goal) => Number.isInteger(goal));

        if (parsedSdgs.length > 0) {
          setSdgOptions(parsedSdgs.sort((a, b) => a - b));
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load taxonomy items");
      }
    }

    loadTaxonomies();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setSelectedCourse(null);
      setCourseForm(getCourseForm(null));
      setQuizQuestions([]);
      setLessons([]);
      setSelectedLessonId("");
      return;
    }

    let active = true;
    setError("");

    Promise.all([
      apiRequest<Course>(`/courses/manage/${encodeURIComponent(selectedCourseId)}`, token),
      apiRequest<Lesson[]>(`/lessons/manage/course/${encodeURIComponent(selectedCourseId)}`, token),
    ])
      .then(([course, courseLessons]) => {
        if (!active) return;
        setSelectedCourse(course);
        setCourseForm(getCourseForm(course));
        setQuizQuestions(course.quizQuestions || []);
        setLessons(courseLessons);
        setSelectedLessonId(courseLessons[0]?._id || "");
        setLessonForm(getLessonForm(courseLessons[0]));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load course authoring data");
      });

    return () => {
      active = false;
    };
  }, [selectedCourseId, token]);

  useEffect(() => {
    setLessonForm(getLessonForm(selectedLesson));
  }, [selectedLesson]);

  const updateCreateForm = (updates: Partial<CourseForm>) => setCreateForm((current) => ({ ...current, ...updates }));
  const updateCourseForm = (updates: Partial<CourseForm>) => setCourseForm((current) => ({ ...current, ...updates }));

  const createCourse = () => run(async () => {
    const created = await apiRequest<Course>("/courses", token, {
      method: "POST",
      body: JSON.stringify(getCoursePayload(createForm)),
    });

    setCourseList((current) => [created, ...current.filter((course) => course.id !== created.id)]);
    setSelectedCourseId(created.id);
    setSelectedCourse(created);
    setCourseForm(getCourseForm(created));
    setQuizQuestions(created.quizQuestions || []);
    setLessons([]);
    setSelectedLessonId("");
    setCreateForm(getCourseForm(null));
    setIsCreatingCourse(false);
    setActiveTab("details");
  }, "Course created and selected.");

  const saveCourse = () => {
    if (!selectedCourseId) return;

    run(async () => {
      const saved = await apiRequest<Course>(`/courses/${encodeURIComponent(selectedCourseId)}`, token, {
        method: "PATCH",
        body: JSON.stringify(getCoursePayload(courseForm, quizQuestions)),
      });

      setSelectedCourse(saved);
      setCourseForm(getCourseForm(saved));
      setQuizQuestions(saved.quizQuestions || quizQuestions);
      setCourseList((current) => current.map((course) => (course.id === saved.id ? saved : course)));
    }, "Course updated.");
  };

  const deleteCourse = () => {
    if (!selectedCourseId) return;

    run(async () => {
      await apiRequest(`/courses/${encodeURIComponent(selectedCourseId)}`, token, { method: "DELETE" });
      const remaining = courseList.filter((course) => course.id !== selectedCourseId);
      const nextCourse = remaining[0] || null;
      setCourseList(remaining);
      setSelectedCourseId(nextCourse?.id || "");
      setSelectedCourse(nextCourse);
      setCourseForm(getCourseForm(nextCourse));
      setQuizQuestions(nextCourse?.quizQuestions || []);
      setLessons([]);
      setSelectedLessonId("");
      setIsCreatingCourse(remaining.length === 0);
      setPendingDelete(null);
    }, "Course deleted.");
  };

  const createLesson = () => run(async () => {
    if (!selectedCourseId) return;

    await apiRequest("/lessons", token, {
      method: "POST",
      body: JSON.stringify({
        courseId: selectedCourseId,
        title: newLessonForm.title,
        description: newLessonForm.description,
        order: Number(newLessonForm.order || 1),
        videoUrl: newLessonForm.videoUrl,
        duration: Number(newLessonForm.duration || 0),
        transcript: newLessonForm.transcript,
        isPublished: newLessonForm.isPublished,
      }),
    });

    const courseLessons = await apiRequest<Lesson[]>(`/lessons/manage/course/${encodeURIComponent(selectedCourseId)}`, token);
    const nextLesson = courseLessons[courseLessons.length - 1] || courseLessons[0];
    setLessons(courseLessons);
    setSelectedLessonId(nextLesson?._id || "");
    setNewLessonForm(getLessonForm());
  }, "Lesson created.");

  const saveLesson = () => {
    if (!selectedLessonId) return;

    run(async () => {
      const saved = await apiRequest<Lesson>(`/lessons/${encodeURIComponent(selectedLessonId)}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          ...lessonForm,
          order: Number(lessonForm.order || 0),
          duration: Number(lessonForm.duration || 0),
        }),
      });

      setLessons((current) => current.map((lesson) => (lesson._id === saved._id ? saved : lesson)));
    }, "Lesson updated.");
  };

  const deleteLesson = () => {
    if (!selectedLessonId) return;

    run(async () => {
      await apiRequest(`/lessons/${encodeURIComponent(selectedLessonId)}`, token, { method: "DELETE" });
      const courseLessons = selectedCourseId
        ? await apiRequest<Lesson[]>(`/lessons/manage/course/${encodeURIComponent(selectedCourseId)}`, token)
        : [];
      setLessons(courseLessons);
      setSelectedLessonId(courseLessons[0]?._id || "");
      setPendingDelete(null);
    }, "Lesson deleted.");
  };

  const renderMultiSelect = (
    label: string,
    value: string[],
    options: string[],
    onChange: (value: string[]) => void
  ) => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        multiple
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
        className={`${fieldClass("mt-2")} min-h-[9rem]`}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.replace(/-/g, " ")}</option>
        ))}
      </select>
    </label>
  );

  const renderSdgSelect = (value: number[], onChange: (value: number[]) => void) => (
    <label className="block text-sm font-semibold text-slate-700">
      SDGs
      <select
        value={value.map(String)}
        multiple
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => Number(option.value)))}
        className={`${fieldClass("mt-2")} min-h-[9rem]`}
      >
        {sdgOptions.map((goal) => (
          <option key={goal} value={goal}>Goal {goal}</option>
        ))}
      </select>
    </label>
  );

  const renderCategorySelect = (value: string, onChange: (value: string) => void) => (
    <label className="block text-sm font-semibold text-slate-700">
      Category
      {categories.length > 0 ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} required className={fieldClass("mt-2")}>
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} required placeholder="Category slug" className={fieldClass("mt-2")} />
      )}
    </label>
  );

  return (
    <div className="content-manager-forms space-y-5">
      {(status || error) && (
        <StatusBanner variant={error ? "error" : "success"} title={error || status} />
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <AdminSidebar className="min-w-0 md:w-auto">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Courses</h2>
              <p className="text-xs font-bold text-slate-500">{courseList.length} total</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreatingCourse(true);
                setActiveTab("details");
              }}
              className="rounded-md bg-forest px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              New
            </button>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses"
            className={fieldClass("mt-4")}
          />

          <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto pr-1">
            {filteredCourses.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-500">
                No courses match this search.
              </p>
            ) : filteredCourses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => {
                  setSelectedCourseId(course.id);
                  setIsCreatingCourse(false);
                }}
                className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                  selectedCourseId === course.id && !isCreatingCourse
                    ? "border-forest bg-emerald-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="block truncate text-sm font-black text-slate-950">{course.title}</span>
                <span className="mt-1 block truncate text-xs font-bold text-slate-500">
                  {course.category || "Uncategorized"} / {course.lessonsCount || 0} lessons
                </span>
              </button>
            ))}
          </div>
        </AdminSidebar>

        <DashboardCard className="min-w-0 p-5 sm:p-6">
          {isCreatingCourse ? (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                createCourse();
              }}
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Create course</h2>
                  <p className="text-sm font-semibold text-slate-500">Start with the fields learners need to find the course.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setIsCreatingCourse(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">
                    Cancel
                  </button>
                  <button disabled={isPending} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                    Create
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Title
                  <input value={createForm.title} onChange={(event) => updateCreateForm({ title: event.target.value })} required className={fieldClass("mt-2")} />
                </label>
                {renderCategorySelect(createForm.category, (category) => updateCreateForm({ category }))}
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Description
                <textarea value={createForm.description} onChange={(event) => updateCreateForm({ description: event.target.value })} required rows={3} className={fieldClass("mt-2")} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={createForm.instructorName} onChange={(event) => updateCreateForm({ instructorName: event.target.value })} placeholder="Instructor name" className={fieldClass()} />
                <input value={createForm.duration} onChange={(event) => updateCreateForm({ duration: event.target.value })} placeholder="Duration" className={fieldClass()} />
                <input value={createForm.thumbnail} onChange={(event) => updateCreateForm({ thumbnail: event.target.value })} placeholder="Thumbnail URL" className={fieldClass()} />
                <input value={createForm.price} onChange={(event) => updateCreateForm({ price: Number(event.target.value) })} type="number" min="0" placeholder="Price" className={fieldClass()} />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {renderSdgSelect(createForm.sdgGoals, (sdgGoals) => updateCreateForm({ sdgGoals }))}
                {renderMultiSelect("Topics", createForm.topics, topicOptions.length > 0 ? topicOptions : ["mea-introductory", "human-rights", "gender"], (topics) => updateCreateForm({ topics }))}
                {renderMultiSelect("Sections", createForm.sections, sectionOptions.length > 0 ? sectionOptions : ["CBD", "UNFCCC", "BRS", "UNCLOS", "CITES", "UNCCD"], (sections) => updateCreateForm({ sections }))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={createForm.syllabusUrl} onChange={(event) => updateCreateForm({ syllabusUrl: event.target.value })} placeholder="Syllabus URL" className={fieldClass()} />
                <input value={createForm.externalUrl} onChange={(event) => updateCreateForm({ externalUrl: event.target.value })} placeholder="External URL" className={fieldClass()} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-700">
                <label className="flex items-center gap-2">
                  <input checked={createForm.isDiploma} onChange={(event) => updateCreateForm({ isDiploma: event.target.checked })} type="checkbox" /> Diploma track
                </label>
                <label className="flex items-center gap-2">
                  <input checked={createForm.isExternal} onChange={(event) => updateCreateForm({ isExternal: event.target.checked })} type="checkbox" /> External course
                </label>
              </div>
              {createForm.isDiploma && (
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Diploma required courses</p>
                  {createRequiredCourseOptions.length === 0 ? (
                    <p className="mt-2 text-sm font-semibold text-slate-500">Create regular courses before linking diploma requirements.</p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {createRequiredCourseOptions.map((course) => (
                        <label key={course.id} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <input
                            checked={createForm.diplomaRequiredCourseIds.includes(course.id)}
                            onChange={(event) => {
                              const nextIds = event.target.checked
                                ? [...createForm.diplomaRequiredCourseIds, course.id]
                                : createForm.diplomaRequiredCourseIds.filter((id) => id !== course.id);
                              updateCreateForm({ diplomaRequiredCourseIds: nextIds });
                            }}
                            type="checkbox"
                          /> {course.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          ) : selectedCourse ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-forest">Selected course</p>
                  <h2 className="mt-1 truncate text-xl font-black text-slate-950">{selectedCourse.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{lessons.length} lessons / {selectedCourse.category}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveCourse} disabled={isPending || !selectedCourseId} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                    Save
                  </button>
                  <button type="button" onClick={() => setPendingDelete("course")} disabled={isPending || !selectedCourseId} className="rounded-md border border-red-200 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-60">
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2" role="tablist" aria-label="Course editor sections">
                {[
                  ["details", "Details"],
                  ["lessons", "Lessons"],
                  ["quiz", "Quiz"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => setActiveTab(tab as WorkspaceTab)}
                    className={`rounded-md px-4 py-2 text-sm font-black ${activeTab === tab ? "bg-forest text-white" : "border border-slate-300 text-slate-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "details" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Title
                      <input value={courseForm.title} onChange={(event) => updateCourseForm({ title: event.target.value })} className={fieldClass("mt-2")} />
                    </label>
                    {renderCategorySelect(courseForm.category, (category) => updateCourseForm({ category }))}
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Description
                    <textarea value={courseForm.description} onChange={(event) => updateCourseForm({ description: event.target.value })} rows={3} className={fieldClass("mt-2")} />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={courseForm.instructorName} onChange={(event) => updateCourseForm({ instructorName: event.target.value })} placeholder="Instructor name" className={fieldClass()} />
                    <input value={courseForm.duration} onChange={(event) => updateCourseForm({ duration: event.target.value })} placeholder="Duration label" className={fieldClass()} />
                    <input value={courseForm.thumbnail} onChange={(event) => updateCourseForm({ thumbnail: event.target.value })} placeholder="Thumbnail URL" className={fieldClass()} />
                    <input value={courseForm.price} onChange={(event) => updateCourseForm({ price: Number(event.target.value) })} type="number" min="0" placeholder="Price" className={fieldClass()} />
                    <input value={courseForm.syllabusUrl} onChange={(event) => updateCourseForm({ syllabusUrl: event.target.value })} placeholder="Syllabus URL" className={fieldClass()} />
                    <input value={courseForm.externalUrl} onChange={(event) => updateCourseForm({ externalUrl: event.target.value })} placeholder="External URL" className={fieldClass()} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {renderSdgSelect(courseForm.sdgGoals, (sdgGoals) => updateCourseForm({ sdgGoals }))}
                    {renderMultiSelect("Topics", courseForm.topics, topicOptions.length > 0 ? topicOptions : ["mea-introductory", "human-rights", "gender"], (topics) => updateCourseForm({ topics }))}
                    {renderMultiSelect("Sections", courseForm.sections, sectionOptions.length > 0 ? sectionOptions : ["CBD", "UNFCCC", "BRS", "UNCLOS", "CITES", "UNCCD"], (sections) => updateCourseForm({ sections }))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-700">
                    <label className="flex items-center gap-2">
                      <input checked={courseForm.isDiploma} onChange={(event) => updateCourseForm({ isDiploma: event.target.checked })} type="checkbox" /> Diploma track
                    </label>
                    <label className="flex items-center gap-2">
                      <input checked={courseForm.isExternal} onChange={(event) => updateCourseForm({ isExternal: event.target.checked })} type="checkbox" /> External course
                    </label>
                  </div>
                  {courseForm.isDiploma && (
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Diploma required courses</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {requiredCourseOptions.map((course) => (
                          <label key={course.id} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <input
                              checked={courseForm.diplomaRequiredCourseIds.includes(course.id)}
                              onChange={(event) => {
                                const nextIds = event.target.checked
                                  ? [...courseForm.diplomaRequiredCourseIds, course.id]
                                  : courseForm.diplomaRequiredCourseIds.filter((id) => id !== course.id);
                                updateCourseForm({ diplomaRequiredCourseIds: nextIds });
                              }}
                              type="checkbox"
                            /> {course.title}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "lessons" && (
                <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Lesson list</h3>
                    {lessons.length === 0 ? (
                      <p className="rounded-md bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-500">No lessons yet.</p>
                    ) : lessons.map((lesson) => (
                      <button
                        key={lesson._id}
                        type="button"
                        onClick={() => setSelectedLessonId(lesson._id)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm font-bold ${selectedLessonId === lesson._id ? "border-forest bg-emerald-50 text-slate-950" : "border-slate-200 text-slate-700"}`}
                      >
                        {lesson.order}. {lesson.title}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-6">
                    <form
                      className="space-y-3 rounded-md bg-slate-50 p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        createLesson();
                      }}
                    >
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Add lesson</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={newLessonForm.title} onChange={(event) => setNewLessonForm({ ...newLessonForm, title: event.target.value })} required placeholder="Lesson title" className={fieldClass()} />
                        <input value={newLessonForm.order} onChange={(event) => setNewLessonForm({ ...newLessonForm, order: Number(event.target.value) })} required type="number" min="0" className={fieldClass()} />
                        <input value={newLessonForm.duration} onChange={(event) => setNewLessonForm({ ...newLessonForm, duration: Number(event.target.value) })} type="number" min="0" placeholder="Duration seconds" className={fieldClass()} />
                      </div>
                      <textarea value={newLessonForm.description} onChange={(event) => setNewLessonForm({ ...newLessonForm, description: event.target.value })} rows={2} placeholder="Description" className={fieldClass()} />
                      <input value={newLessonForm.videoUrl} onChange={(event) => setNewLessonForm({ ...newLessonForm, videoUrl: event.target.value })} required placeholder="/uploads/videos/example.mp4 or https://youtu.be/..." className={fieldClass()} />
                      <textarea value={newLessonForm.transcript} onChange={(event) => setNewLessonForm({ ...newLessonForm, transcript: event.target.value })} rows={3} placeholder="Transcript" className={fieldClass()} />
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input checked={newLessonForm.isPublished} onChange={(event) => setNewLessonForm({ ...newLessonForm, isPublished: event.target.checked })} type="checkbox" /> Published
                      </label>
                      <button disabled={isPending || !selectedCourseId} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                        Add lesson
                      </button>
                    </form>

                    <div className="space-y-3">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Edit selected lesson</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} disabled={!selectedLessonId} placeholder="Lesson title" className={fieldClass()} />
                        <input value={lessonForm.order} onChange={(event) => setLessonForm({ ...lessonForm, order: Number(event.target.value) })} disabled={!selectedLessonId} type="number" min="0" className={fieldClass()} />
                        <input value={lessonForm.videoUrl} onChange={(event) => setLessonForm({ ...lessonForm, videoUrl: event.target.value })} disabled={!selectedLessonId} placeholder="/uploads/videos/example.mp4 or https://youtu.be/..." className={fieldClass()} />
                        <input value={lessonForm.duration} onChange={(event) => setLessonForm({ ...lessonForm, duration: Number(event.target.value) })} disabled={!selectedLessonId} type="number" min="0" className={fieldClass()} />
                      </div>
                      <textarea value={lessonForm.description} onChange={(event) => setLessonForm({ ...lessonForm, description: event.target.value })} disabled={!selectedLessonId} rows={2} placeholder="Description" className={fieldClass()} />
                      <textarea value={lessonForm.transcript} onChange={(event) => setLessonForm({ ...lessonForm, transcript: event.target.value })} disabled={!selectedLessonId} rows={4} placeholder="Transcript" className={fieldClass()} />
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input checked={lessonForm.isPublished} onChange={(event) => setLessonForm({ ...lessonForm, isPublished: event.target.checked })} disabled={!selectedLessonId} type="checkbox" /> Published
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={saveLesson} disabled={isPending || !selectedLessonId} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                          Save lesson
                        </button>
                        <button type="button" onClick={() => setLessonForm({ ...lessonForm, videoUrl: "", duration: 0 })} disabled={isPending || !selectedLessonId} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-60">
                          Clear video
                        </button>
                        <button type="button" onClick={() => setPendingDelete("lesson")} disabled={isPending || !selectedLessonId} className="rounded-md border border-red-200 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-60">
                          Delete lesson
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "quiz" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="block text-sm font-bold text-slate-700">
                      Passing score
                      <input value={courseForm.quizPassingScore} onChange={(event) => updateCourseForm({ quizPassingScore: Number(event.target.value) })} type="number" min="0" max="100" className={fieldClass("mt-2 max-w-[9rem]")} />
                    </label>
                    <button type="button" onClick={saveCourse} disabled={isPending || !selectedCourseId} className="btn-primary">
                      Save quiz
                    </button>
                  </div>
                  <QuizAuthoringEditor questions={quizQuestions} onChange={setQuizQuestions} disabled={isPending || !selectedCourseId} />
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No course selected"
              description="Create a course or select one from the list."
            />
          )}
        </DashboardCard>
      </div>
      <ConfirmDialog
        open={pendingDelete === "course"}
        title="Delete this course?"
        description="This removes the course, its lessons, and related progress records."
        confirmLabel={isPending ? "Deleting..." : "Delete course"}
        cancelLabel="Cancel"
        onConfirm={deleteCourse}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={pendingDelete === "lesson"}
        title="Delete this lesson?"
        description="This removes the lesson and related progress records."
        confirmLabel={isPending ? "Deleting..." : "Delete lesson"}
        cancelLabel="Cancel"
        onConfirm={deleteLesson}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
