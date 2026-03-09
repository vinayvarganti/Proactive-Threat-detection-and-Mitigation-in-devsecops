import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScanReport extends Document {
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  timestamp: Date;
  vulnerabilities: Types.ObjectId[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byStatus: {
      pending: number;
      in_progress: number;
      fixed: number;
      verified: number;
    };
  };
  scanDuration: number;
  scannerResults: {
    semgrep: { success: boolean; count: number; error?: string };
    trivy: { success: boolean; count: number; error?: string };
    gitleaks: { success: boolean; count: number; error?: string };
  };
}

const ScanReportSchema: Schema = new Schema({
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
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  vulnerabilities: [{
    type: Schema.Types.ObjectId,
    ref: 'Vulnerability'
  }],
  summary: {
    total: {
      type: Number,
      required: true,
      default: 0
    },
    bySeverity: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 }
    },
    byStatus: {
      pending: { type: Number, default: 0 },
      in_progress: { type: Number, default: 0 },
      fixed: { type: Number, default: 0 },
      verified: { type: Number, default: 0 }
    }
  },
  scanDuration: {
    type: Number,
    required: true
  },
  scannerResults: {
    semgrep: {
      success: { type: Boolean, required: true },
      count: { type: Number, required: true },
      error: { type: String }
    },
    trivy: {
      success: { type: Boolean, required: true },
      count: { type: Number, required: true },
      error: { type: String }
    },
    gitleaks: {
      success: { type: Boolean, required: true },
      count: { type: Number, required: true },
      error: { type: String }
    }
  }
});

export default mongoose.model<IScanReport>('ScanReport', ScanReportSchema);
