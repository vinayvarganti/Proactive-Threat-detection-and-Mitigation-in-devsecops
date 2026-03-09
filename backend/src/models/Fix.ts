import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFix extends Document {
  vulnerabilityId: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'manual' | 'ai';
  originalCode: string;
  fixedCode: string;
  aiProposal?: {
    explanation: string;
    confidence: number;
    model: string;
  };
  appliedAt: Date;
  commitSha?: string;
}

const FixSchema: Schema = new Schema({
  vulnerabilityId: {
    type: Schema.Types.ObjectId,
    ref: 'Vulnerability',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['manual', 'ai'],
    required: true
  },
  originalCode: {
    type: String,
    required: true
  },
  fixedCode: {
    type: String,
    required: true
  },
  aiProposal: {
    explanation: { type: String },
    confidence: { type: Number },
    model: { type: String }
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  commitSha: {
    type: String
  }
});

export default mongoose.model<IFix>('Fix', FixSchema);
