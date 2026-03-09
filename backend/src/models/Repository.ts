import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRepository extends Document {
  userId: Types.ObjectId;
  githubRepoId: string;
  name: string;
  fullName: string;
  visibility: 'public' | 'private';
  defaultBranch: string;
  lastScannedAt: Date | null;
  createdAt: Date;
}

const RepositorySchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  githubRepoId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    required: true
  },
  defaultBranch: {
    type: String,
    required: true,
    default: 'main'
  },
  lastScannedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IRepository>('Repository', RepositorySchema);
