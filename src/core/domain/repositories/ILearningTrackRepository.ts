import { LearningTrack } from "../entities/LearningTrack";

export interface ILearningTrackRepository {
  findById(id: string): Promise<LearningTrack | null>;
  findAll(): Promise<LearningTrack[]>;
  create(
    track: Omit<LearningTrack, "id" | "createdAt" | "updatedAt">
  ): Promise<LearningTrack>;
}
