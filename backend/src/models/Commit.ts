import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICommit extends Document {
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  commitSha: string;
  message: string;
  branch: string;
  fixedVulnerabilities: Types.ObjectId[];
  timestamp: Date;
  success: boolean;
  conflicts: {
    filePath: string;
    reason: string;
  }[];
}

const CommitSchema: Schema = new Schema({
  repositoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  commitSha: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  branch: {
    type: String,
    required: true
  },
  fixedVulnerabilities: [{
    type: Schema.Types.ObjectId,
    ref: 'Vulnerability'
  }],
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  success: {
    type: Boolean,
    required: true
  },
  conflicts: [{
    filePath: { type: String, required: true },
    reason: { type: String, required: true }
  }]
});

export default mongoose.model<ICommit>('Commit', CommitSchema);
