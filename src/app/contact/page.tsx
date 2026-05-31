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
        <h1 className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl font-sora">Contact our team</h1>
        <p className="mt-4 mx-auto max-w-2xl text-lg text-slate-650 font-medium">
          Have questions about our multilateral environmental agreement courses or need technical support? We're here to help.
        </p>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-3">
        {/* Contact info details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 border-white/20 bg-white/50 backdrop-blur-sm shadow-sm hover:scale-[1.02] transition-transform duration-300">
            <h3 className="text-lg font-black text-slate-950 flex items-center gap-3 font-sora">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#b0f0d6]/40 text-[#003527] text-base font-bold">💬</span>
              General Inquiries
            </h3>
            <p className="mt-3 text-sm text-slate-605 leading-relaxed font-semibold">
              For questions regarding the course catalog, syllabus specifications, or partner integrations.
            </p>
            <p className="mt-4 text-sm font-black text-forest">info@epa-elearning.org</p>
          </div>

          <div className="glass-card p-6 border-white/20 bg-white/50 backdrop-blur-sm shadow-sm hover:scale-[1.02] transition-transform duration-300">
            <h3 className="text-lg font-black text-slate-950 flex items-center gap-3 font-sora">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#b0f0d6]/40 text-[#003527] text-base font-bold">🛠️</span>
              Technical Support
            </h3>
            <p className="mt-3 text-sm text-slate-605 leading-relaxed font-semibold">
              Encountered a bug? Need certificate recovery or account reset? Our support staff is online.
            </p>
            <p className="mt-4 text-sm font-black text-forest">support@epa-elearning.org</p>
          </div>

          <div className="glass-card p-6 border-white/20 bg-white/50 backdrop-blur-sm shadow-sm hover:scale-[1.02] transition-transform duration-300">
            <h3 className="text-lg font-black text-slate-950 flex items-center gap-3 font-sora">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#b0f0d6]/40 text-[#003527] text-base font-bold">📍</span>
              Secretariat Location
            </h3>
            <p className="mt-3 text-sm text-slate-605 leading-relaxed font-semibold">
              United Nations Environment Programme (UNEP)<br />
              United Nations Avenue, Gigiri<br />
              P.O. Box 30552, 00100<br />
              Nairobi, Kenya
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2 glass-card p-8 border-white/20 bg-white/50 backdrop-blur-sm">
          <h2 className="text-2xl font-black text-slate-950 font-sora">Send us a message</h2>
          <p className="mt-2 text-sm text-slate-600 font-semibold">Complete the form below and an expert will reply within 24 hours.</p>

          {isSubmitted ? (
            <div className="mt-8 rounded-2xl bg-[#b0f0d6]/20 border border-[#95d3ba]/30 p-6 text-center">
              <span className="text-3xl">✅</span>
              <h3 className="mt-2 text-lg font-bold text-slate-950 font-sora">Message Sent Successfully!</h3>
              <p className="mt-2 text-sm text-slate-600 font-semibold">
                Thank you for reaching out. We have received your inquiry and will contact you shortly.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="mt-4 rounded-full bg-forest px-5 py-2 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] transition-all"
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
                    className="rounded-full border border-white/30 bg-white/60 px-4 py-2.5 text-sm text-slate-900 focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none transition-all"
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
                    className="rounded-full border border-white/30 bg-white/60 px-4 py-2.5 text-sm text-slate-900 focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none transition-all"
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
                  className="rounded-full border border-white/30 bg-white/60 px-4 py-2.5 text-sm text-slate-900 focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none transition-all"
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
                  className="rounded-3xl border border-white/30 bg-white/60 px-4 py-3 text-sm text-slate-900 focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none resize-none transition-all"
                />
              </label>

              <button
                type="submit"
                className="mt-2 rounded-full bg-forest px-6 py-3 text-sm font-black text-white hover:bg-[#b0f0d6] hover:text-[#003527] transition-all shadow-md shadow-forest/10 hover:scale-[1.02] self-start"
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
