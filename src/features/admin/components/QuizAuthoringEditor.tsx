"use client";

import React from "react";
import { AuthoredQuizQuestion } from "@/shared/types";

type QuizAuthoringEditorProps = {
  questions: AuthoredQuizQuestion[];
  onChange: (questions: AuthoredQuizQuestion[]) => void;
  disabled?: boolean;
};

const emptyQuestion = (index: number): AuthoredQuizQuestion => ({
  id: `question-${index + 1}`,
  prompt: "",
  options: ["", "", "", ""],
  correctAnswerIndex: 0,
  explanation: "",
});

export default function QuizAuthoringEditor({ questions, onChange, disabled }: QuizAuthoringEditorProps) {
  const updateQuestion = (index: number, updates: Partial<AuthoredQuizQuestion>) => {
    onChange(questions.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...updates } : question
    )));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = questions[questionIndex];
    updateQuestion(questionIndex, {
      options: question.options.map((option, index) => index === optionIndex ? value : option),
    });
  };

  const addQuestion = () => onChange([...questions, emptyQuestion(questions.length)]);
  const removeQuestion = (index: number) => onChange(questions.filter((_, questionIndex) => questionIndex !== index));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Final quiz</h3>
        <button
          type="button"
          disabled={disabled}
          onClick={addQuestion}
          className="rounded-md border border-forest px-3 py-1.5 text-xs font-black text-forest disabled:opacity-60"
        >
          Add question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
          No authored questions yet. Learners will see the default fallback quiz until questions are added.
        </p>
      )}

      {questions.map((question, questionIndex) => (
        <div key={`${question.id}-${questionIndex}`} className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <label className="block flex-1 text-xs font-black uppercase tracking-wider text-slate-500">
              Question {questionIndex + 1}
              <textarea
                value={question.prompt}
                disabled={disabled}
                onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900"
                placeholder="What should learners know?"
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeQuestion(questionIndex)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-black text-red-600 disabled:opacity-60"
            >
              Remove
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => (
              <label key={optionIndex} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                <input
                  type="radio"
                  name={`correct-${questionIndex}`}
                  checked={question.correctAnswerIndex === optionIndex}
                  disabled={disabled}
                  onChange={() => updateQuestion(questionIndex, { correctAnswerIndex: optionIndex })}
                />
                <input
                  value={option}
                  disabled={disabled}
                  onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                  className="min-w-0 flex-1 border-0 text-sm font-semibold outline-none disabled:bg-transparent"
                  placeholder={`Answer ${optionIndex + 1}`}
                />
              </label>
            ))}
          </div>

          <input
            value={question.explanation || ""}
            disabled={disabled}
            onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Optional explanation shown in authoring context"
          />
        </div>
      ))}
    </div>
  );
}
