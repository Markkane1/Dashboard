"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Course } from "@/core/domain/entities/Course";
import { User } from "@/core/domain/entities/User";

export default function Home() {
  // State variables
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>(" "); // starts with space to fetch all, or empty
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as "student" | "instructor",
  });

  // Course Details Drawer State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Course Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCourseForm, setNewCourseForm] = useState({
    title: "",
    description: "",
    category: "Web Development",
    price: "",
    duration: "",
    lessonsCount: "",
    thumbnail: "",
  });

  // System Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const categories = [
    "All",
    "Web Development",
    "Software Architecture",
    "Programming Languages",
    "Database Engineering",
    "Design & UX",
    "DevOps & Infrastructure",
  ];

  // Show Toast helper
  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch Courses from API
  const fetchCourses = async (category = "All", search = "") => {
    setIsLoading(true);
    try {
      const cleanSearch = search.trim();
      let url = "/api/courses";
      const params = new URLSearchParams();
      if (category && category !== "All") params.append("category", category);
      if (cleanSearch) params.append("search", cleanSearch);
      
      const queryStr = params.toString();
      if (queryStr) {
        url += `?${queryStr}`;
      }

      const res = await fetch(url);
      const resData = await res.json();
      
      if (resData.success) {
        setCourses(resData.data);
      } else {
        setError(resData.error || "Failed to load courses");
      }
    } catch (e: any) {
      console.error(e);
      setError("Unable to connect to server. Check database status.");
    } finally {
      setIsLoading(false);
    }
  };

  // Diploma Eligibility state
  const [isDiplomaEligible, setIsDiplomaEligible] = useState<boolean>(false);

  const checkDiplomaEligibility = async (userId: string) => {
    try {
      const res = await fetch(`/api/progress/diploma?userId=${userId}&trackId=60d5ec4b868e8e19c0de6969`);
      const data = await res.json();
      if (data.success && data.data) {
        setIsDiplomaEligible(data.data.isEligible);
      }
    } catch (e) {
      console.error("Failed to check diploma eligibility:", e);
    }
  };

  useEffect(() => {
    if (user && user.id) {
      checkDiplomaEligibility(user.id);
    } else {
      setIsDiplomaEligible(false);
    }
  }, [user, courses]);

  // Run on start
  useEffect(() => {
    fetchCourses("All", "");
    // Check if user session mock exists
    const storedUser = localStorage.getItem("epa_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("epa_user");
      }
    }
  }, []);

  // Category filter trigger
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    fetchCourses(cat, searchQuery);
  };

  // Search trigger
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses(selectedCategory, searchQuery);
  };

  // Real-time search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim() === "") {
      fetchCourses(selectedCategory, "");
    }
  };

  // Seed database utility
  const handleSeedDatabase = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seed");
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Database seeded with premium courses!", "success");
        fetchCourses("All", "");
      } else {
        showToast(data.error || "Seeding failed.", "error");
      }
    } catch (e: any) {
      showToast("Seed request failed. Check server log.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Authentication Submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = authTab === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = authTab === "login" 
        ? { email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password, name: authForm.name, role: authForm.role };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        localStorage.setItem("epa_user", JSON.stringify(data.data));
        showToast(
          authTab === "login" 
            ? `Welcome back, ${data.data.name}!` 
            : `Registration successful, welcome ${data.data.name}!`,
          "success"
        );
        setShowAuthModal(false);
        // Reset auth fields
        setAuthForm({ name: "", email: "", password: "", role: "student" });
      } else {
        showToast(data.error || "Authentication failed", "error");
      }
    } catch (e: any) {
      showToast("Authentication server error", "error");
    }
  };

  // Logout utility
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("epa_user");
    showToast("Logged out successfully.", "info");
  };

  // Open syllabus drawer (with dynamic lazy loading of chapters)
  const handleOpenDrawer = async (course: Course) => {
    setIsDrawerOpen(true);
    setSelectedCourse(course); // Set basic catalog data instantly
    try {
      const res = await fetch(`/api/courses?id=${course.id}`);
      const resData = await res.json();
      if (resData.success) {
        setSelectedCourse(resData.data);
      }
    } catch (e) {
      console.error("Failed to lazy load course syllabus details:", e);
    }
  };

  // Close syllabus drawer
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedCourse(null);
  };

  // Enroll dynamic increments
  const handleEnroll = async (courseId?: string) => {
    if (!courseId) return;
    if (!user || !user.id) {
      setAuthTab("register");
      setShowAuthModal(true);
      showToast("Please register or sign in to enroll in this course.", "info");
      return;
    }

    try {
      const res = await fetch("/api/courses/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, courseId }),
      });

      const resData = await res.json();
      if (resData.success) {
        // Sync local user state and storage with updated enrolledCourses list
        const updatedUser = resData.data.user;
        setUser(updatedUser);
        localStorage.setItem("epa_user", JSON.stringify(updatedUser));

        // Update courses list local enrolledCount
        setCourses(prev => prev.map(c => {
          if (c.id === courseId) {
            return { ...c, enrolledCount: (c.enrolledCount || 0) + 1 };
          }
          return c;
        }));

        if (selectedCourse && selectedCourse.id === courseId) {
          setSelectedCourse(prev => prev ? { 
            ...prev, 
            enrolledCount: (prev.enrolledCount || 0) + 1,
          } : null);
        }

        showToast(`Congratulations! You enrolled in "${selectedCourse?.title || 'the course'}".`, "success");
      } else {
        showToast(resData.error || "Enrollment failed.", "error");
      }
    } catch (e: any) {
      console.error(e);
      showToast("Enrollment failed. Server connection error.", "error");
    }
  };

  // Course Creation Submission
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "instructor") {
      showToast("Only instructors can create courses.", "error");
      return;
    }

    try {
      const priceVal = parseFloat(newCourseForm.price);
      const lessonsVal = parseInt(newCourseForm.lessonsCount);

      if (isNaN(priceVal) || priceVal < 0) {
        showToast("Invalid course price", "error");
        return;
      }
      if (isNaN(lessonsVal) || lessonsVal <= 0) {
        showToast("Invalid lessons count", "error");
        return;
      }

      const payload = {
        title: newCourseForm.title,
        description: newCourseForm.description,
        category: newCourseForm.category,
        price: priceVal,
        duration: newCourseForm.duration || "10 hours",
        lessonsCount: lessonsVal,
        thumbnail: newCourseForm.thumbnail || "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=600&auto=format&fit=crop",
        instructorId: user.id || "inst-custom",
        instructorName: user.name,
        instructorAvatar: user.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=150&auto=format&fit=crop",
      };

      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`"${data.data.title}" has been published successfully!`, "success");
        setShowCreateModal(false);
        fetchCourses(selectedCategory, searchQuery);
        setNewCourseForm({
          title: "",
          description: "",
          category: "Web Development",
          price: "",
          duration: "",
          lessonsCount: "",
          thumbnail: "",
        });
      } else {
        showToast(data.error || "Failed to create course", "error");
      }
    } catch {
      showToast("Server error publishing course.", "error");
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Dynamic Slide-in Toast Notifications */}
      {toast && (
        <div className={`toast-box ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === "success" && "✓"}
            {toast.type === "info" && "ℹ"}
            {toast.type === "error" && "✕"}
          </div>
          <div className="toast-text">{toast.message}</div>
        </div>
      )}

      {/* Modern Navigation Header */}
      <header className="main-header">
        <div className="header-container">
          <div className="logo-group">
            <span className="logo-glow"></span>
            <h1 className="logo-text">ELearning<span className="logo-span">EPA</span></h1>
          </div>
          
          <nav className="nav-menu">
            <span className="nav-arch-badge">Clean Architecture MENN</span>
          </nav>

          <div className="auth-group">
            {user ? (
              <div className="user-profile-widget">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.name} className="profile-img" />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="user-details-text">
                  <span className="username">{user.name}</span>
                  <span className="userrole">{user.role === "instructor" ? "Instructor Mode" : "Student"}</span>
                </div>
                {user.role === "instructor" && (
                  <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="btn btn-primary btn-sm"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                  >
                    + Publish Course
                  </button>
                )}
                {isDiplomaEligible && (
                  <a 
                    href={`/api/docs/diploma?userId=${user.id}&trackId=60d5ec4b868e8e19c0de6969`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm pulse-glow"
                    style={{ 
                      padding: "0.4rem 0.8rem", 
                      fontSize: "0.8rem", 
                      background: "linear-gradient(135deg, #fbbf24, #d97706)", 
                      boxShadow: "0 0 15px rgba(251, 191, 36, 0.4)",
                      border: "none"
                    }}
                  >
                    🎓 Download Diploma
                  </a>
                )}
                <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={() => { setAuthTab("login"); setShowAuthModal(true); }} className="btn btn-primary pulse-glow">
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Visual Section */}
      <section className="hero-section">
        <div className="hero-glow-blob1"></div>
        <div className="hero-glow-blob2"></div>
        <div className="hero-content-container">
          <div className="hero-text-area">
            <div className="badge badge-cyan">Next.js 16 + TypeScript + Mongoose</div>
            <h2 className="hero-title">
              Learn the Science of <br />
              <span className="gradient-text">Software Engineering</span>
            </h2>
            <p className="hero-subtitle">
              A high-end, clean architecture educational dashboard built with modular Domain-Driven components, concrete infrastructure adapters, and a gorgeous glassmorphic design system.
            </p>

            <form onSubmit={handleSearchSubmit} className="search-form-group">
              <input
                type="text"
                value={searchQuery === " " ? "" : searchQuery}
                onChange={handleSearchChange}
                placeholder="Search courses (e.g. Clean Architecture, Next.js, Docker)..."
                className="search-input"
              />
              <button type="submit" className="search-btn btn btn-primary">
                Search
              </button>
            </form>

            <div className="hero-cta-quick">
              <span>Database Empty?</span>
              <button onClick={handleSeedDatabase} className="btn-seed">
                ⚡ Seed Database Instantly
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Navigation Area */}
      <main className="catalog-section">
        <div className="catalog-container">
          <div className="filter-header">
            <h3 className="section-title">Course Catalog</h3>
            <span className="courses-count">Showing {courses.length} courses</span>
          </div>

          {/* Categories Tab selectors */}
          <div className="categories-scroller">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Loading Indicator */}
          {isLoading ? (
            <div className="loader-container">
              <div className="spinner"></div>
              <p>Orchestrating domain repositories...</p>
            </div>
          ) : error ? (
            <div className="error-card glass-card">
              <h4>Database Connection Pending</h4>
              <p>Ensure a local MongoDB server is running on port 27017 or define `MONGODB_URI` environment variable.</p>
              <button onClick={handleSeedDatabase} className="btn btn-primary" style={{ marginTop: "1rem" }}>
                Attempt Seeding / Connect
              </button>
            </div>
          ) : courses.length === 0 ? (
            <div className="empty-catalog glass-card">
              <h4>No Courses Found</h4>
              <p>Try searching for another topic, changing filters, or seed the MongoDB database with premium sample data.</p>
              <button onClick={handleSeedDatabase} className="btn btn-primary" style={{ marginTop: "1rem" }}>
                Seed Premium Courses
              </button>
            </div>
          ) : (
            /* Courses Visual Grid */
            <div className="courses-grid">
              {courses.map((course) => (
                <div key={course.id} className="course-card glass-card">
                  <div className="card-thumbnail-area">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={course.thumbnail} 
                      alt={course.title} 
                      className="card-thumbnail-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=600&auto=format&fit=crop";
                      }}
                    />
                    <span className="card-badge">{course.category}</span>
                  </div>
                  
                  <div className="card-info-area">
                    <h4 className="course-card-title">{course.title}</h4>
                    <p className="course-card-desc">{course.description}</p>
                    
                    <div className="instructor-card-row">
                      {course.instructorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={course.instructorAvatar} 
                          alt={course.instructorName} 
                          className="instructor-avatar" 
                        />
                      ) : (
                        <div className="instructor-avatar-placeholder">
                          {course.instructorName.charAt(0)}
                        </div>
                      )}
                      <span className="instructor-name">{course.instructorName}</span>
                    </div>

                    <div className="card-meta-indicators">
                      <div className="meta-indicator">
                        <span className="indicator-icon">⏱</span>
                        <span>{course.duration}</span>
                      </div>
                      <div className="meta-indicator">
                        <span className="indicator-icon">📖</span>
                        <span>{course.lessonsCount} lessons</span>
                      </div>
                      <div className="meta-indicator">
                        <span className="indicator-icon" style={{ color: "#fbbf24" }}>★</span>
                        <span>{course.rating || 4.5}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-footer-action-row">
                    <div className="card-price">${course.price.toFixed(2)}</div>
                    <button onClick={() => handleOpenDrawer(course)} className="btn btn-secondary btn-sm">
                      Syllabus Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dynamic Slide-over Syllabus Details Drawer */}
      {isDrawerOpen && selectedCourse && (
        <div className="drawer-overlay" onClick={handleCloseDrawer}>
          <div className="syllabus-drawer glass-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-drawer-btn" onClick={handleCloseDrawer}>✕</button>
            
            <div className="drawer-scrollable-content">
              <span className="drawer-badge">{selectedCourse.category}</span>
              <h3 className="drawer-title">{selectedCourse.title}</h3>
              
              <div className="drawer-thumbnail-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={selectedCourse.thumbnail} 
                  alt={selectedCourse.title} 
                  className="drawer-thumbnail-img" 
                />
              </div>

              <div className="drawer-instructor-panel">
                {selectedCourse.instructorAvatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedCourse.instructorAvatar} alt={selectedCourse.instructorName} className="drawer-inst-img" />
                )}
                <div>
                  <div className="drawer-inst-label">COURSE INSTRUCTOR</div>
                  <div className="drawer-inst-name">{selectedCourse.instructorName}</div>
                </div>
              </div>

              <h5 className="drawer-subheading">About the Syllabus</h5>
              <p className="drawer-desc">{selectedCourse.description}</p>

              <h5 className="drawer-subheading">Syllabus Curriculum</h5>
              {selectedCourse.modules && selectedCourse.modules.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
                  {selectedCourse.modules.map((mod, modIdx) => (
                    <div key={modIdx} className="timeline-module-block">
                      <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "hsl(var(--secondary))", marginBottom: "0.4rem" }}>
                        {mod.title}
                      </div>
                      {mod.description && <p style={{ fontSize: "0.8rem", color: "hsl(var(--muted))", marginBottom: "0.75rem", lineHeight: "1.4" }}>{mod.description}</p>}
                      <div className="curriculum-timeline" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {mod.chapters.map((chap, chapIdx) => (
                          <div key={chapIdx} className="timeline-node">
                            <div className="node-bullet">{chapIdx + 1}</div>
                            <div className="node-content">
                              <div className="node-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
                                <span>{chap.title}</span>
                                <span style={{ fontSize: "0.72rem", color: "hsl(var(--secondary))", fontWeight: "normal", whiteSpace: "nowrap" }}>⏱ {chap.estimatedMinutes}m</span>
                              </div>
                              <p className="node-p" style={{ fontSize: "0.78rem", color: "hsl(var(--muted))", marginTop: "0.15rem" }}>{chap.contentMarkdown}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="curriculum-timeline">
                  <div className="timeline-node">
                    <div className="node-bullet">1</div>
                    <div className="node-content">
                      <div className="node-title">Syllabus Pending Preparation</div>
                      <p className="node-p">Curriculum topics and chapters are currently being designed by the instructor.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="drawer-meta-grid">
                <div className="drawer-meta-item">
                  <span className="drawer-meta-num">{selectedCourse.lessonsCount}</span>
                  <span className="drawer-meta-label">LECTIONS</span>
                </div>
                <div className="drawer-meta-item">
                  <span className="drawer-meta-num">{selectedCourse.duration}</span>
                  <span className="drawer-meta-label">DURATION</span>
                </div>
                <div className="drawer-meta-item">
                  <span className="drawer-meta-num">{selectedCourse.enrolledCount || 0}</span>
                  <span className="drawer-meta-label">STUDENTS</span>
                </div>
              </div>

              <div className="drawer-checkout-strip">
                <div>
                  <div className="drawer-price-label">TOTAL SYLLABUS PRICE</div>
                  <div className="drawer-price-num">${selectedCourse.price.toFixed(2)}</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <a 
                    href={`/api/docs/handbook/${selectedCourse.id}`}
                    download
                    className="btn btn-secondary btn-sm"
                    style={{ 
                      display: "inline-flex", 
                      alignItems: "center", 
                      gap: "0.35rem", 
                      padding: "0.6rem 0.85rem",
                      fontSize: "0.85rem",
                      textDecoration: "none"
                    }}
                  >
                    📥 Handbook
                  </a>
                  {user && user.enrolledCourses?.includes(selectedCourse.id || "") ? (
                    <Link 
                      href={`/courses/${selectedCourse.id}/player`} 
                      className="btn btn-primary pulse-glow"
                      style={{ 
                        padding: "0.6rem 1.15rem",
                        fontSize: "0.85rem",
                        textDecoration: "none"
                      }}
                    >
                      Enter Player →
                    </Link>
                  ) : (
                    <button 
                      onClick={() => handleEnroll(selectedCourse.id)} 
                      className="btn btn-primary pulse-glow"
                      style={{ 
                        padding: "0.6rem 1.15rem",
                        fontSize: "0.85rem"
                      }}
                    >
                      Enroll in Syllabus
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Authentication Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal glass-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setShowAuthModal(false)}>✕</button>
            
            <div className="modal-tabs">
              <button 
                onClick={() => setAuthTab("login")} 
                className={`modal-tab ${authTab === "login" ? "active" : ""}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => setAuthTab("register")} 
                className={`modal-tab ${authTab === "register" ? "active" : ""}`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="modal-form">
              {authTab === "register" && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authForm.name}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="name@university.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="form-input"
                />
              </div>

              {authTab === "register" && (
                <div className="form-group">
                  <label className="form-label">Are you registering as a student or instructor?</label>
                  <select
                    value={authForm.role}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, role: e.target.value as "student" | "instructor" }))}
                    className="form-input"
                    style={{ background: "#0a0c16", border: "1px solid var(--glass-border)" }}
                  >
                    <option value="student">Student (Explore & Enroll)</option>
                    <option value="instructor">Instructor (Publish Syllabus)</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }}>
                {authTab === "login" ? "Sign In to ELearningEPA" : "Create Developer Profile"}
              </button>
              
              <div className="modal-auth-helper-msg">
                {authTab === "login" ? (
                  <p>
                    No account?{" "}
                    <span onClick={() => setAuthTab("register")} className="auth-toggle-link">
                      Create one
                    </span>
                  </p>
                ) : (
                  <p>
                    Already registered?{" "}
                    <span onClick={() => setAuthTab("login")} className="auth-toggle-link">
                      Sign in
                    </span>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Course Creation Modal */}
      {showCreateModal && user && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="auth-modal glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <button className="close-modal-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            
            <h3 className="modal-title" style={{ padding: "0 1rem", marginTop: "1rem" }}>Publish New Course Syllabus</h3>
            
            <form onSubmit={handleCreateCourse} className="modal-form" style={{ padding: "1.5rem 1rem 1rem 1rem" }}>
              <div className="form-group">
                <label className="form-label">Course Title</label>
                <input
                  type="text"
                  required
                  value={newCourseForm.title}
                  onChange={(e) => setNewCourseForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Advanced Solid Principles"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description & Syllabus</label>
                <textarea
                  required
                  value={newCourseForm.description}
                  onChange={(e) => setNewCourseForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your course syllabus and student expectations..."
                  className="form-input"
                  rows={3}
                  style={{ resize: "none" }}
                />
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%" }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={newCourseForm.category}
                    onChange={(e) => setNewCourseForm(prev => ({ ...prev, category: e.target.value }))}
                    className="form-input"
                    style={{ background: "#0a0c16" }}
                  >
                    <option value="Web Development">Web Development</option>
                    <option value="Software Architecture">Software Architecture</option>
                    <option value="Programming Languages">Programming Languages</option>
                    <option value="Database Engineering">Database Engineering</option>
                    <option value="Design & UX">Design & UX</option>
                    <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCourseForm.price}
                    onChange={(e) => setNewCourseForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="49.99"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%" }}>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <input
                    type="text"
                    required
                    value={newCourseForm.duration}
                    onChange={(e) => setNewCourseForm(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g. 14 hours"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Lessons Count</label>
                  <input
                    type="number"
                    required
                    value={newCourseForm.lessonsCount}
                    onChange={(e) => setNewCourseForm(prev => ({ ...prev, lessonsCount: e.target.value }))}
                    placeholder="28"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Thumbnail URL (Optional)</label>
                <input
                  type="text"
                  value={newCourseForm.thumbnail}
                  onChange={(e) => setNewCourseForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="form-input"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }}>
                Publish to Course List
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Styled Footer */}
      <footer className="main-footer">
        <div className="footer-container">
          <p>© 2026 ELearningEPA. All Rights Reserved.</p>
          <div className="footer-links">
            <span>Domain-Driven Design</span>
            <span>•</span>
            <span>Clean Architecture</span>
            <span>•</span>
            <span>Next.js + MongoDB</span>
          </div>
        </div>
      </footer>

      {/* Embed local styling scope specifically for premium structural animations and custom layout grids */}
      <style jsx global>{`
        /* Local layout styling scopes complementing variables in globals.css */
        
        .main-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(8, 10, 18, 0.7);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.25rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .logo-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        .logo-glow {
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: hsl(var(--primary));
          filter: blur(12px);
          opacity: 0.6;
          z-index: -1;
          left: -8px;
        }
        
        .logo-text {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        
        .logo-span {
          color: hsl(var(--secondary));
        }
        
        .nav-arch-badge {
          background: rgba(139, 92, 246, 0.1);
          color: hsl(var(--primary));
          border: 1px solid rgba(139, 92, 246, 0.2);
          padding: 0.35rem 0.85rem;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.03em;
        }
        
        .user-profile-widget {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: var(--radius-md);
        }
        
        .profile-img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid hsl(var(--primary));
          object-fit: cover;
        }
        
        .profile-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.85rem;
        }
        
        .user-details-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }
        
        .username {
          font-size: 0.85rem;
          font-weight: 600;
        }
        
        .userrole {
          font-size: 0.7rem;
          color: hsl(var(--secondary));
          font-weight: 500;
        }
        
        /* Hero Visual section styling */
        .hero-section {
          position: relative;
          padding: 7rem 2rem 4rem 2rem;
          overflow: hidden;
          background: radial-gradient(circle at 50% 10%, rgba(139, 92, 246, 0.06), transparent 60%);
        }
        
        .hero-glow-blob1 {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: hsla(var(--primary), 0.04);
          filter: blur(80px);
          top: -100px;
          left: 10%;
          z-index: -1;
        }
        
        .hero-glow-blob2 {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: hsla(var(--secondary), 0.03);
          filter: blur(80px);
          bottom: 0px;
          right: 10%;
          z-index: -1;
        }
        
        .hero-content-container {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }
        
        .hero-title {
          font-size: 3.25rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 1.5rem 0 1rem 0;
          line-height: 1.15;
        }
        
        .hero-subtitle {
          font-size: 1.125rem;
          color: hsl(var(--muted));
          margin-bottom: 2.5rem;
          line-height: 1.6;
        }
        
        .search-form-group {
          display: flex;
          gap: 0.5rem;
          background: rgba(10, 12, 22, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          padding: 0.5rem;
          backdrop-filter: blur(8px);
          box-shadow: var(--shadow-md);
          max-width: 650px;
          margin: 0 auto 1.5rem auto;
          transition: all var(--transition-normal);
        }
        
        .search-form-group:focus-within {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 20px 0 hsla(var(--primary) / 0.15);
        }
        
        .search-input {
          flex: 1;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          color: hsl(var(--foreground));
          font-size: 0.95rem;
        }
        
        .search-btn {
          font-size: 0.9rem;
          padding: 0.5rem 1.5rem;
        }
        
        .hero-cta-quick {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          font-size: 0.85rem;
          color: hsl(var(--muted));
        }
        
        .btn-seed {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0.35rem 0.85rem;
          border-radius: var(--radius-md);
          color: hsl(var(--foreground));
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .btn-seed:hover {
          background: hsla(var(--primary) / 0.1);
          border-color: hsla(var(--primary) / 0.3);
          transform: translateY(-1px);
        }
        
        /* Catalog layout section */
        .catalog-section {
          padding: 2rem 2rem 6rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
        
        .filter-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.75rem;
        }
        
        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
        }
        
        .courses-count {
          font-size: 0.85rem;
          color: hsl(var(--muted));
        }
        
        .categories-scroller {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .categories-scroller::-webkit-scrollbar {
          height: 4px;
        }
        
        .category-pill {
          white-space: nowrap;
          padding: 0.5rem 1.15rem;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: hsl(var(--muted));
          cursor: pointer;
          transition: all var(--transition-normal);
        }
        
        .category-pill:hover {
          background: rgba(255, 255, 255, 0.05);
          color: hsl(var(--foreground));
        }
        
        .category-pill.active {
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8));
          border-color: transparent;
          color: #ffffff;
          box-shadow: 0 4px 12px 0 hsla(var(--primary) / 0.25);
        }
        
        /* Courses visual grid */
        .courses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 2rem;
        }
        
        .course-card {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 440px;
        }
        
        .card-thumbnail-area {
          position: relative;
          height: 180px;
          width: 100%;
          background: #0d0f19;
          overflow: hidden;
        }
        
        .card-thumbnail-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--transition-slow);
        }
        
        .course-card:hover .card-thumbnail-img {
          transform: scale(1.05);
        }
        
        .card-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(10, 12, 22, 0.75);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: hsl(var(--secondary));
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.25rem 0.65rem;
          border-radius: var(--radius-sm);
        }
        
        .card-info-area {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        
        .course-card-title {
          font-size: 1.15rem;
          font-weight: 700;
          line-height: 1.3;
          margin-bottom: 0.6rem;
          min-height: 2.6rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .course-card-desc {
          font-size: 0.85rem;
          color: hsl(var(--muted));
          line-height: 1.5;
          margin-bottom: 1.25rem;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .instructor-card-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-top: auto;
          margin-bottom: 1.25rem;
        }
        
        .instructor-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid hsla(var(--primary) / 0.5);
        }
        
        .instructor-avatar-placeholder {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: hsl(var(--accent));
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
        }
        
        .instructor-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: hsl(var(--foreground) / 0.9);
        }
        
        .card-meta-indicators {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: 0.85rem;
          font-size: 0.75rem;
          color: hsl(var(--muted));
        }
        
        .meta-indicator {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        
        .indicator-icon {
          font-size: 0.85rem;
        }
        
        .card-footer-action-row {
          padding: 1rem 1.5rem 1.5rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.01);
        }
        
        .card-price {
          font-size: 1.35rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
        }
        
        /* Spinner Loader */
        .loader-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5rem 0;
          color: hsl(var(--muted));
          gap: 1rem;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(139, 92, 246, 0.1);
          border-radius: 50%;
          border-top-color: hsl(var(--primary));
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Error Card */
        .error-card {
          max-width: 500px;
          margin: 3rem auto;
          padding: 2.5rem;
          text-align: center;
        }
        
        .error-card h4 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
          color: hsl(var(--primary));
        }
        
        .error-card p {
          font-size: 0.9rem;
          color: hsl(var(--muted));
        }
        
        /* Empty Catalog */
        .empty-catalog {
          max-width: 500px;
          margin: 3rem auto;
          padding: 2.5rem;
          text-align: center;
        }
        
        .empty-catalog h4 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }
        
        .empty-catalog p {
          font-size: 0.9rem;
          color: hsl(var(--muted));
        }
        
        /* Drawer Slide-over Panel overlay */
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.25s ease;
        }
        
        .syllabus-drawer {
          width: 100%;
          max-width: 460px;
          height: 100%;
          border-radius: 0;
          border-left: 1px solid var(--glass-border);
          border-top: none;
          border-right: none;
          border-bottom: none;
          background: rgba(8, 10, 19, 0.95);
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
          animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        
        .drawer-scrollable-content {
          padding: 3rem 2rem 2rem 2rem;
          height: 100%;
          overflow-y: auto;
        }
        
        .close-drawer-btn {
          position: absolute;
          top: 16px;
          left: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all var(--transition-fast);
        }
        
        .close-drawer-btn:hover {
          background: hsl(var(--primary));
          border-color: transparent;
        }
        
        .drawer-badge {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          color: hsl(var(--secondary));
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          letter-spacing: 0.05em;
        }
        
        .drawer-title {
          font-size: 1.65rem;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 1.5rem;
        }
        
        .drawer-thumbnail-box {
          height: 200px;
          width: 100%;
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .drawer-thumbnail-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .drawer-instructor-panel {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md);
          margin-bottom: 1.75rem;
        }
        
        .drawer-inst-img {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid hsl(var(--primary));
        }
        
        .drawer-inst-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: hsl(var(--muted));
          letter-spacing: 0.06em;
        }
        
        .drawer-inst-name {
          font-size: 0.9rem;
          font-weight: 600;
        }
        
        .drawer-subheading {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          color: hsl(var(--foreground));
        }
        
        .drawer-desc {
          font-size: 0.9rem;
          color: hsl(var(--muted));
          line-height: 1.6;
          margin-bottom: 2rem;
        }
        
        /* Timeline curriculums */
        .curriculum-timeline {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 2rem;
          position: relative;
          padding-left: 1rem;
        }
        
        .curriculum-timeline::before {
          content: '';
          position: absolute;
          left: 19px;
          top: 10px;
          bottom: 10px;
          width: 1px;
          background: rgba(255, 255, 255, 0.08);
        }
        
        .timeline-node {
          display: flex;
          gap: 1.25rem;
          position: relative;
        }
        
        .node-bullet {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: hsl(var(--accent));
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: bold;
          z-index: 2;
        }
        
        .timeline-node:hover .node-bullet {
          background: hsl(var(--primary));
          border-color: transparent;
        }
        
        .node-content {
          flex: 1;
        }
        
        .node-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin-bottom: 0.2rem;
        }
        
        .node-p {
          font-size: 0.75rem;
          color: hsl(var(--muted));
          line-height: 1.4;
        }
        
        .drawer-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-bottom: 6rem;
        }
        
        .drawer-meta-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-md);
          padding: 0.75rem;
          text-align: center;
        }
        
        .drawer-meta-num {
          display: block;
          font-size: 1.15rem;
          font-weight: 800;
          color: hsl(var(--secondary));
        }
        
        .drawer-meta-label {
          font-size: 0.6rem;
          color: hsl(var(--muted));
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        
        .drawer-checkout-strip {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(10, 12, 22, 0.9);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1.25rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 5;
        }
        
        .drawer-price-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: hsl(var(--muted));
          letter-spacing: 0.06em;
        }
        
        .drawer-price-num {
          font-size: 1.45rem;
          font-weight: 900;
          color: #ffffff;
        }
        
        /* Modal overlays */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(6px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
          padding: 1rem;
        }
        
        .auth-modal {
          width: 100%;
          max-width: 440px;
          background: rgba(10, 13, 24, 0.95);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          position: relative;
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .close-modal-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .close-modal-btn:hover {
          background: hsl(var(--primary));
          border-color: transparent;
        }
        
        .modal-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 1rem 1.5rem 0 1.5rem;
        }
        
        .modal-tab {
          flex: 1;
          text-align: center;
          padding: 0.85rem 0;
          font-weight: 600;
          font-size: 0.9rem;
          color: hsl(var(--muted));
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all var(--transition-fast);
        }
        
        .modal-tab:hover {
          color: hsl(var(--foreground));
        }
        
        .modal-tab.active {
          color: #ffffff;
          border-bottom-color: hsl(var(--primary));
        }
        
        .modal-form {
          padding: 2rem 1.5rem;
        }
        
        .modal-auth-helper-msg {
          text-align: center;
          margin-top: 1.25rem;
          font-size: 0.85rem;
          color: hsl(var(--muted));
        }
        
        .auth-toggle-link {
          color: hsl(var(--secondary));
          cursor: pointer;
          font-weight: 600;
          text-decoration: underline;
        }
        
        .auth-toggle-link:hover {
          color: #ffffff;
        }
        
        /* Toast layout box */
        .toast-box {
          position: fixed;
          bottom: 24px;
          left: 24px;
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          background: rgba(10, 13, 24, 0.9);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(12px);
          padding: 0.85rem 1.5rem;
          border-radius: var(--radius-md);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          animation: slideUpIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 380px;
        }
        
        .toast-box.success {
          border-left: 4px solid #10b981;
        }
        
        .toast-box.info {
          border-left: 4px solid hsl(var(--secondary));
        }
        
        .toast-box.error {
          border-left: 4px solid hsl(var(--destructive));
        }
        
        .toast-icon {
          font-weight: bold;
          font-size: 1.1rem;
        }
        
        .toast-box.success .toast-icon { color: #10b981; }
        .toast-box.info .toast-icon { color: hsl(var(--secondary)); }
        .toast-box.error .toast-icon { color: hsl(var(--destructive)); }
        
        .toast-text {
          font-size: 0.875rem;
          font-weight: 500;
          color: #ffffff;
        }
        
        /* Footer Styling */
        .main-footer {
          margin-top: auto;
          background: rgba(6, 8, 14, 0.9);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 2.5rem 2rem;
          font-size: 0.85rem;
          color: hsl(var(--muted));
        }
        
        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .footer-links {
          display: flex;
          gap: 0.5rem;
          font-weight: 500;
        }
        
        /* Animations Keyframes */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        @keyframes slideUpIn {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
