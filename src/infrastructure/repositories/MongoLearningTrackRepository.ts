import { ILearningTrackRepository } from "../../core/domain/repositories/ILearningTrackRepository";
import { LearningTrack } from "../../core/domain/entities/LearningTrack";
import { LearningTrackModel } from "../database/models/LearningTrackModel";
import { dbConnect } from "../database/mongodb";

export class MongoLearningTrackRepository implements ILearningTrackRepository {
  async findById(id: string): Promise<LearningTrack | null> {
    await dbConnect();
    try {
      const doc = await LearningTrackModel.findById(id).exec();
      if (!doc) return null;
      return doc.toJSON() as LearningTrack;
    } catch (e) {
      console.error(`Error finding learning track ${id}:`, e);
      return null;
    }
  }

  async findAll(): Promise<LearningTrack[]> {
    await dbConnect();
    const docs = await LearningTrackModel.find({}).exec();
    return docs.map((doc) => doc.toJSON() as LearningTrack);
  }

  async create(
    track: Omit<LearningTrack, "id" | "createdAt" | "updatedAt">
  ): Promise<LearningTrack> {
    await dbConnect();
    const doc = new LearningTrackModel(track);
    await doc.save();
    return doc.toJSON() as LearningTrack;
  }
}
