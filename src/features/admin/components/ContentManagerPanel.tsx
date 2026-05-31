"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthoredQuizQuestion, Course, Lesson } from "@/shared/types";
import { fetchTaxonomies } from "@/infrastructure/api/taxonomies";
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

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
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

  return res.status === 204 ? (null as T) : res.json();
}

function parseCsv(value: FormDataEntryValue | string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSdgGoals(value: FormDataEntryValue | string | null) {
  return parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function getCourseForm(course?: Course): CourseForm {
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

function getLessonForm(lesson?: Lesson): LessonForm {
  return {
    title: lesson?.title || "",
    description: lesson?.description || "",
    order: lesson?.order || 0,
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

export default function ContentManagerPanel({ token, courses }: ContentManagerPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || "");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(courses[0] || null);
  const [courseForm, setCourseForm] = useState<CourseForm>(getCourseForm(courses[0]));
  const [quizQuestions, setQuizQuestions] = useState<AuthoredQuizQuestion[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const [sdgOptions, setSdgOptions] = useState<number[]>([1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17]);
  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson._id === selectedLessonId),
    [lessons, selectedLessonId]
  );
  const requiredCourseOptions = courses.filter((course) => course.id !== selectedCourseId && !course.isDiploma);
  const [lessonForm, setLessonForm] = useState<LessonForm>(getLessonForm());

  const run = (action: () => Promise<void>, success: string) => {
    setStatus("");
    setError("");
    startTransition(async () => {
      try {
        await action();
        setStatus(success);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

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
  }, [token]);

  useEffect(() => {
    if (!selectedCourseId) return;

    let active = true;
    setError("");

    Promise.all([
      apiRequest<Course>(`/courses/manage/${selectedCourseId}`, token),
      apiRequest<Lesson[]>(`/lessons/manage/course/${selectedCourseId}`, token),
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

  const createCourse = (formData: FormData) => run(async () => {
    await apiRequest("/courses", token, {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        sdgGoals: formData.getAll("sdgGoals").map((value) => Number(value)).filter((goal) => Number.isInteger(goal) && goal > 0),
        topics: formData.getAll("topics").map(String).map((item) => item.trim()).filter(Boolean),
        sections: formData.getAll("sections").map(String).map((item) => item.trim()).filter(Boolean),
        syllabusUrl: formData.get("syllabusUrl"),
        instructorName: formData.get("instructorName"),
        duration: formData.get("duration"),
        price: Number(formData.get("price") || 0),
        isDiploma: formData.get("isDiploma") === "on",
        isExternal: formData.get("isExternal") === "on",
        externalUrl: formData.get("externalUrl"),
        diplomaRequiredCourseIds: formData.getAll("diplomaRequiredCourseIds").map(String),
      }),
    });
  }, "Course created.");

  const saveCourse = () => {
    if (!selectedCourseId) return;
    run(async () => {
      const saved = await apiRequest<Course>(`/courses/${selectedCourseId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          ...courseForm,
          sdgGoals: courseForm.sdgGoals,
          topics: courseForm.topics,
          sections: courseForm.sections,
          quizPassingScore: Number(courseForm.quizPassingScore || 70),
          price: Number(courseForm.price || 0),
          quizQuestions: cleanQuizQuestions(quizQuestions),
        }),
      });
      setSelectedCourse(saved);
      setQuizQuestions(saved.quizQuestions || quizQuestions);
    }, "Course updated.");
  };

  const deleteCourse = () => {
    if (!selectedCourseId || !confirm("Delete this course or diploma and its lessons/progress?")) return;

    run(async () => {
      await apiRequest(`/courses/${selectedCourseId}`, token, { method: "DELETE" });
      const nextCourse = courses.find((course) => course.id !== selectedCourseId);
      setSelectedCourseId(nextCourse?.id || "");
      setSelectedCourse(nextCourse || null);
      setCourseForm(getCourseForm(nextCourse));
      setQuizQuestions([]);
      setLessons([]);
      setSelectedLessonId("");
    }, "Course deleted.");
  };

  const createLesson = (formData: FormData) => run(async () => {
    if (!selectedCourseId) return;
    await apiRequest("/lessons", token, {
      method: "POST",
      body: JSON.stringify({
        courseId: selectedCourseId,
        title: formData.get("title"),
        description: formData.get("description"),
        order: Number(formData.get("order") || 0),
        videoUrl: formData.get("videoUrl"),
        isPublished: formData.get("isPublished") === "on",
      }),
    });
    const courseLessons = await apiRequest<Lesson[]>(`/lessons/manage/course/${selectedCourseId}`, token);
    setLessons(courseLessons);
  }, "Lesson created.");

  const saveLesson = () => {
    if (!selectedLessonId) return;
    run(async () => {
      const saved = await apiRequest<Lesson>(`/lessons/${selectedLessonId}`, token, {
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

  const clearVideo = () => {
    setLessonForm({
      ...lessonForm,
      videoUrl: "",
      duration: 0,
    });
  };

  const deleteLesson = () => {
    if (!selectedLessonId || !confirm("Delete this lesson and its progress records?")) return;

    run(async () => {
      await apiRequest(`/lessons/${selectedLessonId}`, token, { method: "DELETE" });
      const courseLessons = selectedCourseId
        ? await apiRequest<Lesson[]>(`/lessons/manage/course/${selectedCourseId}`, token)
        : [];
      setLessons(courseLessons);
      setSelectedLessonId(courseLessons[0]?._id || "");
    }, "Lesson deleted.");
  };

  return (
    <div className="space-y-6">
      {(status || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-forest"}`}>
          {error || status}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            createCourse(new FormData(event.currentTarget));
          }}
        >
          <h2 className="text-xl font-black text-slate-950">Create course</h2>
          <input name="title" required placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" required placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.length > 0 ? (
              <label className="block text-sm font-semibold text-slate-700">
                Category
                <select name="category" required className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <input name="category" required placeholder="Category slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            )}
            <label className="block text-sm font-semibold text-slate-700">
              SDGs
              <select name="sdgGoals" multiple className="mt-2 block w-full min-h-[10rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                {sdgOptions.map((goal) => (
                  <option key={goal} value={goal}>Goal {goal}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Topics
              <select name="topics" multiple className="mt-2 block w-full min-h-[10rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                {(topicOptions.length > 0 ? topicOptions : ["mea-introductory", "human-rights", "gender"]).map((topic) => (
                  <option key={topic} value={topic}>{topic.replace(/-/g, " ")}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Sections
              <select name="sections" multiple className="mt-2 block w-full min-h-[10rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                {(sectionOptions.length > 0 ? sectionOptions : ["CBD", "UNFCCC", "BRS", "UNCLOS", "CITES", "UNCCD"]).map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="instructorName" placeholder="Instructor name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="duration" placeholder="Duration" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="price" type="number" min="0" defaultValue="0" placeholder="Price" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="syllabusUrl" placeholder="Syllabus URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="externalUrl" placeholder="External URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="quizPassingScore" type="number" min="0" max="100" defaultValue="70" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-700">
            <label className="flex items-center gap-2">
              <input name="isDiploma" type="checkbox" /> Diploma track
            </label>
            <label className="flex items-center gap-2">
              <input name="isExternal" type="checkbox" /> External course
            </label>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Diploma required courses</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {courses.filter((course) => !course.isDiploma).map((course) => (
                <label key={course.id} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input name="diplomaRequiredCourseIds" type="checkbox" value={course.id} /> {course.title}
                </label>
              ))}
            </div>
          </div>
          <button disabled={isPending} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create course
          </button>
        </form>

        <form
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            createLesson(new FormData(event.currentTarget));
          }}
        >
          <h2 className="text-xl font-black text-slate-950">Create lesson</h2>
          <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input name="title" required placeholder="Lesson title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea name="description" placeholder="Description" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="order" required type="number" min="0" defaultValue="1" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="videoUrl" required placeholder="/uploads/videos/example.mp4" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input name="isPublished" type="checkbox" /> Published
          </label>
          <button disabled={isPending || courses.length === 0} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Create lesson
          </button>
        </form>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Edit course</h2>
            <p className="text-sm font-semibold text-slate-500">{selectedCourse?.title || "Select a course to edit metadata and quiz questions."}</p>
          </div>
          <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={courseForm.category} onChange={(event) => setCourseForm({ ...courseForm, category: event.target.value })} placeholder="Category slug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="block text-sm font-semibold text-slate-700">
            SDGs
            <select value={courseForm.sdgGoals.map(String)} onChange={(event) => setCourseForm({ ...courseForm, sdgGoals: Array.from(event.target.selectedOptions, (option) => Number(option.value)) })} multiple className="mt-2 block w-full min-h-[10rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {sdgOptions.map((goal) => (
                <option key={goal} value={goal}>Goal {goal}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Topics
            <select value={courseForm.topics} onChange={(event) => setCourseForm({ ...courseForm, topics: Array.from(event.target.selectedOptions, (option) => option.value) })} multiple className="mt-2 block w-full min-h-[10rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {(topicOptions.length > 0 ? topicOptions : ["mea-introductory", "human-rights", "gender"]).map((topic) => (
                <option key={topic} value={topic}>{topic.replace(/-/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Sections
            <select value={courseForm.sections} onChange={(event) => setCourseForm({ ...courseForm, sections: Array.from(event.target.selectedOptions, (option) => option.value) })} multiple className="mt-2 block w-full min-h-[10rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {(sectionOptions.length > 0 ? sectionOptions : ["CBD", "UNFCCC", "BRS", "UNCLOS", "CITES", "UNCCD"]).map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </label>
          <input value={courseForm.instructorName} onChange={(event) => setCourseForm({ ...courseForm, instructorName: event.target.value })} placeholder="Instructor name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={courseForm.duration} onChange={(event) => setCourseForm({ ...courseForm, duration: event.target.value })} placeholder="Duration label" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={courseForm.thumbnail} onChange={(event) => setCourseForm({ ...courseForm, thumbnail: event.target.value })} placeholder="Thumbnail URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={courseForm.price} onChange={(event) => setCourseForm({ ...courseForm, price: Number(event.target.value) })} type="number" min="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={courseForm.externalUrl} onChange={(event) => setCourseForm({ ...courseForm, externalUrl: event.target.value })} placeholder="External URL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <textarea value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} rows={3} placeholder="Description" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-700">
          <label className="flex items-center gap-2">
            <input checked={courseForm.isDiploma} onChange={(event) => setCourseForm({ ...courseForm, isDiploma: event.target.checked })} type="checkbox" /> Diploma track
          </label>
          <label className="flex items-center gap-2">
            <input checked={courseForm.isExternal} onChange={(event) => setCourseForm({ ...courseForm, isExternal: event.target.checked })} type="checkbox" /> External course
          </label>
        </div>
        {courseForm.isDiploma && (
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-xs font-black uppercase tracking-wider text-amber-800">Diploma required courses</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {requiredCourseOptions.map((course) => (
                <label key={course.id} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    checked={courseForm.diplomaRequiredCourseIds.includes(course.id)}
                    onChange={(event) => {
                      const nextIds = event.target.checked
                        ? [...courseForm.diplomaRequiredCourseIds, course.id]
                        : courseForm.diplomaRequiredCourseIds.filter((id) => id !== course.id);
                      setCourseForm({ ...courseForm, diplomaRequiredCourseIds: nextIds });
                    }}
                    type="checkbox"
                  /> {course.title}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="block text-sm font-bold text-slate-700">
          Passing score
          <input value={courseForm.quizPassingScore} onChange={(event) => setCourseForm({ ...courseForm, quizPassingScore: Number(event.target.value) })} type="number" min="0" max="100" className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <QuizAuthoringEditor questions={quizQuestions} onChange={setQuizQuestions} disabled={isPending || !selectedCourseId} />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={saveCourse} disabled={isPending || !selectedCourseId} className="rounded-md bg-forest px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Save course
          </button>
          <button type="button" onClick={deleteCourse} disabled={isPending || !selectedCourseId} className="rounded-md border border-red-200 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-60">
            Delete course
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Edit lessons</h2>
            <p className="text-sm font-semibold text-slate-500">{lessons.length} lessons in this course</p>
          </div>
          <select value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {lessons.length === 0 ? (
              <option value="">No lessons yet</option>
            ) : lessons.map((lesson) => (
              <option key={lesson._id} value={lesson._id}>{lesson.order}. {lesson.title}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} placeholder="Lesson title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={lessonForm.order} onChange={(event) => setLessonForm({ ...lessonForm, order: Number(event.target.value) })} type="number" min="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={lessonForm.videoUrl} onChange={(event) => setLessonForm({ ...lessonForm, videoUrl: event.target.value })} placeholder="/uploads/videos/example.mp4" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={lessonForm.duration} onChange={(event) => setLessonForm({ ...lessonForm, duration: Number(event.target.value) })} type="number" min="0" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <textarea value={lessonForm.description} onChange={(event) => setLessonForm({ ...lessonForm, description: event.target.value })} rows={2} placeholder="Description" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <textarea value={lessonForm.transcript} onChange={(event) => setLessonForm({ ...lessonForm, transcript: event.target.value })} rows={4} placeholder="Transcript" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input checked={lessonForm.isPublished} onChange={(event) => setLessonForm({ ...lessonForm, isPublished: event.target.checked })} type="checkbox" /> Published
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={saveLesson} disabled={isPending || !selectedLessonId} className="rounded-md bg-ocean px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            Save lesson
          </button>
          <button type="button" onClick={clearVideo} disabled={isPending || !selectedLessonId} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-60">
            Clear video fields
          </button>
          <button type="button" onClick={deleteLesson} disabled={isPending || !selectedLessonId} className="rounded-md border border-red-200 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-60">
            Delete lesson
          </button>
        </div>
      </section>
    </div>
  );
}
