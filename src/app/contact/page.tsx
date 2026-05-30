"use client";

import React, { useState } from "react";

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API submission
    setTimeout(() => {
      setIsSubmitted(true);
      setFormState({ name: "", email: "", subject: "", message: "" });
    }, 600);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-wide text-forest">Get in touch</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl">Contact our team</h1>
        <p className="mt-4 mx-auto max-w-2xl text-lg text-slate-600">
          Have questions about our multilateral environmental agreement courses or need technical support? We're here to help.
        </p>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-3">
        {/* Contact info details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-forest text-base font-bold">💬</span>
              General Inquiries
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              For questions regarding the course catalog, syllabus specifications, or partner integrations.
            </p>
            <p className="mt-4 text-sm font-black text-forest">info@epa-elearning.org</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-forest text-base font-bold">🛠️</span>
              Technical Support
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Encountered a bug? Need certificate recovery or account reset? Our support staff is online.
            </p>
            <p className="mt-4 text-sm font-black text-forest">support@epa-elearning.org</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-forest text-base font-bold">📍</span>
              Secretariat Location
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              United Nations Environment Programme (UNEP)<br />
              United Nations Avenue, Gigiri<br />
              P.O. Box 30552, 00100<br />
              Nairobi, Kenya
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2 rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black text-slate-950">Send us a message</h2>
          <p className="mt-2 text-sm text-slate-600">Complete the form below and an expert will reply within 24 hours.</p>

          {isSubmitted ? (
            <div className="mt-8 rounded-lg bg-emerald-50 border border-emerald-200 p-6 text-center">
              <span className="text-3xl">✅</span>
              <h3 className="mt-2 text-lg font-bold text-slate-950">Message Sent Successfully!</h3>
              <p className="mt-2 text-sm text-slate-600">
                Thank you for reaching out. We have received your inquiry and will contact you shortly.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="mt-4 rounded-md bg-forest px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Full name
                  <input
                    required
                    type="text"
                    name="name"
                    value={formState.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Email address
                  <input
                    required
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Subject
                <input
                  required
                  type="text"
                  name="subject"
                  value={formState.subject}
                  onChange={handleChange}
                  placeholder="What is this inquiry about?"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Message
                <textarea
                  required
                  rows={5}
                  name="message"
                  value={formState.message}
                  onChange={handleChange}
                  placeholder="Tell us details about your request..."
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-forest focus:ring-1 focus:ring-forest outline-none resize-none"
                />
              </label>

              <button
                type="submit"
                className="mt-2 rounded-md bg-forest px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 transition-colors shadow-sm self-start"
              >
                Send message
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
