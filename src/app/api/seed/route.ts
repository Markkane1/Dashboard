import { NextResponse } from "next/server";
import { CourseModel } from "@/infrastructure/database/models/CourseModel";
import { LearningTrackModel } from "@/infrastructure/database/models/LearningTrackModel";
import { dbConnect } from "@/infrastructure/database/mongodb";
import mongoose from "mongoose";

const SEED_COURSES = [
  {
    title: "Clean Architecture & DDD Mastery",
    description: "Learn how to design highly scalable, testable, and maintainable software systems using Clean Architecture, Domain-Driven Design (DDD), and SOLID principles in TypeScript. Perfect for developers looking to transition into engineering leaders.",
    instructorId: "inst-101",
    instructorName: "Dr. Elena Vance",
    instructorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=150&auto=format&fit=crop",
    price: 99.99,
    thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop",
    category: "Software Architecture",
    duration: "18.5 hours",
    lessonsCount: 45,
    rating: 4.9,
    enrolledCount: 1240,
    modules: [
      {
        title: "Module 1: Domain-Driven Design (DDD) Foundations",
        description: "Focus on isolating core models and rules from database schemas.",
        chapters: [
          {
            title: "Introduction to DDD and SOLID Principles",
            slug: "intro-ddd-solid",
            contentMarkdown: "### Introduction to DDD\n\nDomain-Driven Design centered around software architecture that models business domains. You will learn the 5 SOLID design tenets and why clean separation is crucial.",
            estimatedMinutes: 25,
          },
          {
            title: "Modeling Plain TypeScript Entities",
            slug: "modeling-ts-entities",
            contentMarkdown: "### Designing Core Entities\n\nEntities are plain TypeScript classes or structures without external dependencies. This guides how to construct enterprise-wide definitions safely.",
            estimatedMinutes: 35,
          },
        ],
      },
      {
        title: "Module 2: Application Interactors & Core Interfacing",
        description: "Deep dive into decoupling interfaces from repository implementations.",
        chapters: [
          {
            title: "Writing Core Use Cases with Dependency Injection",
            slug: "usecases-di",
            contentMarkdown: "### Creating interactor classes\n\nUse cases coordinate database operations. Here we configure clean dependency injections utilizing repository contracts.",
            estimatedMinutes: 40,
          },
        ],
      },
    ],
    quiz: {
      passingScorePercentage: 80,
      questions: [
        {
          text: "Which layer is at the very center of Clean Architecture?",
          options: ["Presentation Layer", "Application Layer", "Domain Layer", "Infrastructure Layer"],
          correctOptionIndex: 2, // "Domain Layer"
        },
        {
          text: "True or False: Domain entities are allowed to import mongoose or external HTTP clients.",
          options: ["True", "False"],
          correctOptionIndex: 1, // "False"
        },
      ],
    },
  },
  {
    title: "Advanced Next.js App Router Masterclass",
    description: "Deep dive into Server Components, Server Actions, Serverless database optimization, streaming, edge runtimes, middleware, dynamic routing patterns, and enterprise performance caching mechanisms.",
    instructorId: "inst-102",
    instructorName: "Marcus Thorne",
    instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop",
    price: 79.99,
    thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop",
    category: "Web Development",
    duration: "12 hours",
    lessonsCount: 32,
    rating: 4.8,
    enrolledCount: 2310,
    modules: [
      {
        title: "Module 1: React Server Components (RSC)",
        description: "Understanding serverless page architectures and caching.",
        chapters: [
          {
            title: "RSC Deep Dive & Server-side Rendering",
            slug: "rsc-deep-dive",
            contentMarkdown: "### Under the Hood of RSC\n\nReact Server Components render exclusively on the server, significantly reducing client browser bundle payloads and boosting FCP.",
            estimatedMinutes: 20,
          },
          {
            title: "Server Actions and Interactive Forms",
            slug: "server-actions-forms",
            contentMarkdown: "### Bypassing API Routes with Actions\n\nServer Actions allow direct database mutations inside form operations, establishing a full, type-safe stack loop.",
            estimatedMinutes: 30,
          },
        ],
      },
    ],
    quiz: {
      passingScorePercentage: 80,
      questions: [
        {
          text: "Which environment do React Server Components render in?",
          options: ["Exclusively in the Client Browser", "Exclusively on the Server Node/Edge runtime", "Both Server and Client equally"],
          correctOptionIndex: 1, // "Exclusively on the Server..."
        },
      ],
    },
  },
  {
    title: "TypeScript Deep Dive & Advanced Types",
    description: "Go beyond basic types. Master complex conditional types, mapped types, template literal types, custom decorators, compilation profiling, and writing typesafe library wrappers from scratch.",
    instructorId: "inst-103",
    instructorName: "Aria Sterling",
    instructorAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&auto=format&fit=crop",
    price: 49.99,
    thumbnail: "https://images.unsplash.com/photo-1516116211223-5c359a36298a?q=80&w=600&auto=format&fit=crop",
    category: "Programming Languages",
    duration: "8.5 hours",
    lessonsCount: 24,
    rating: 4.7,
    enrolledCount: 980,
    modules: [
      {
        title: "Module 1: Deep Type Engineering",
        description: "Master advanced TypeScript compiler declarations.",
        chapters: [
          {
            title: "Conditional and Mapped Types",
            slug: "conditional-mapped-types",
            contentMarkdown: "### Advanced Type Mapping\n\nLearn how to dynamically transform interfaces and build strict helper utilities using `extends` and `keyof`.",
            estimatedMinutes: 28,
          },
        ],
      },
    ],
  },
  {
    title: "Database Engineering with MongoDB",
    description: "Master document schema design (embedding vs referencing patterns), indexing optimization strategies, advanced aggregation pipelines, performance tuning, transaction safety, and sharding configurations.",
    instructorId: "inst-101",
    instructorName: "Dr. Elena Vance",
    instructorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=150&auto=format&fit=crop",
    price: 59.99,
    thumbnail: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=600&auto=format&fit=crop",
    category: "Database Engineering",
    duration: "10.2 hours",
    lessonsCount: 28,
    rating: 4.6,
    enrolledCount: 1450,
  },
  {
    title: "UI/UX Design Systems for Developers",
    description: "A comprehensive developer-first guide to design theories, spacing scales, HSL typography token layouts, accessible color contrasts, glassmorphic styling grids, and creating fluid micro-animations in CSS.",
    instructorId: "inst-104",
    instructorName: "Liam Vance",
    instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop",
    price: 39.99,
    thumbnail: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?q=80&w=600&auto=format&fit=crop",
    category: "Design & UX",
    duration: "7 hours",
    lessonsCount: 18,
    rating: 4.9,
    enrolledCount: 770,
  },
  {
    title: "DevOps, Docker & Containerization",
    description: "Learn how to containerize Next.js/Express, configure production multi-stage Dockerfiles, orchestrate multiple services with Docker Compose, manage environment profiles, and configure automated GitHub CI/CD pipelines.",
    instructorId: "inst-102",
    instructorName: "Marcus Thorne",
    instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop",
    price: 69.99,
    thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=600&auto=format&fit=crop",
    category: "DevOps & Infrastructure",
    duration: "9.5 hours",
    lessonsCount: 22,
    rating: 4.5,
    enrolledCount: 1120,
  },
];

export async function GET() {
  try {
    await dbConnect();
    
    // 1. Clear existing datasets
    await CourseModel.deleteMany({});
    await LearningTrackModel.deleteMany({});

    // 2. Seed Courses
    const created = await CourseModel.create(SEED_COURSES);
    
    // Find spawned courses to add as prerequisite courses
    const cleanArchCourse = created.find((c: any) => c.title.includes("Clean Architecture"));
    const nextJsCourse = created.find((c: any) => c.title.includes("Next.js"));
    
    const requiredCourseIds: string[] = [];
    if (cleanArchCourse) requiredCourseIds.push(cleanArchCourse.id);
    if (nextJsCourse) requiredCourseIds.push(nextJsCourse.id);

    // 3. Seed Learning Track
    await LearningTrackModel.create({
      _id: new mongoose.Types.ObjectId("60d5ec4b868e8e19c0de6969"), // Static valid hex ObjectId for stable testing
      title: "Diploma in Advanced Software Architecture",
      description: "Graduate with honors by mastering modular enterprise designs, domain usecases, serverless MongoDB connections, and Next.js players.",
      pathway: "Diploma",
      requiredCourseIds: requiredCourseIds,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${created.length} premium courses and the Advanced Architecture "Diploma" learning pathway!`,
      data: created,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to seed database" },
      { status: 500 }
    );
  }
}
