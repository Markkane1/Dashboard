"use client";

import React, { useState } from "react";
import { DashboardCard, FormPanel, PageHeader, PageShell } from "@/shared/components/ui/DesignSystem";

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTimeout(() => {
      setIsSubmitted(true);
      setFormState({ name: "", email: "", subject: "", message: "" });
    }, 300);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({
      ...formState,
      [event.target.name]: event.target.value,
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Contact our team"
        description="Ask about courses, certificates, account support, or platform operations."
      />

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          {[
            ["General inquiries", "info@epa-elearning.org"],
            ["Technical support", "support@epa-elearning.org"],
            ["Location", "UNEP, United Nations Avenue, Nairobi, Kenya"],
          ].map(([label, value]) => (
            <DashboardCard key={label} className="p-4">
              <h2 className="text-sm font-black text-slate-950">{label}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{value}</p>
            </DashboardCard>
          ))}
        </aside>

        <FormPanel title="Send a message" className="p-6">
          <p className="text-sm font-semibold text-slate-600">Complete the form and the team will follow up.</p>

          {isSubmitted ? (
            <div className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-700">
              <h3 className="text-sm font-black text-teal-800">Message sent</h3>
              <p className="mt-1 text-sm font-semibold text-teal-700">Thank you. We received your inquiry.</p>
              <button onClick={() => setIsSubmitted(false)} className="btn-secondary mt-4">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Full name
                  <input required type="text" name="name" value={formState.name} onChange={handleChange} placeholder="Enter your name" className="control w-full" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Email address
                  <input required type="email" name="email" value={formState.email} onChange={handleChange} placeholder="you@example.com" className="control w-full" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Subject
                <input required type="text" name="subject" value={formState.subject} onChange={handleChange} placeholder="What is this inquiry about?" className="control w-full" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Message
                <textarea required rows={5} name="message" value={formState.message} onChange={handleChange} placeholder="Tell us details about your request" className="control w-full" />
              </label>
              <button type="submit" className="btn-primary w-fit">
                Send message
              </button>
            </form>
          )}
        </FormPanel>
      </div>
    </PageShell>
  );
}
