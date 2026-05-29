export type PathwayType = "Diploma" | "Certificate" | "Degree";

export interface LearningTrack {
  id?: string;
  title: string;
  description?: string;
  pathway: PathwayType; // e.g. "Diploma" as required by the contract
  requiredCourseIds: string[]; // List of course IDs needed to complete the track
  createdAt?: Date;
  updatedAt?: Date;
}
