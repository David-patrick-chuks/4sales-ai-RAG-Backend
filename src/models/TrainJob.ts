import mongoose, { Document, Schema } from 'mongoose';

export interface ITrainJob extends Document {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error: any;
  result: any;
  createdAt: Date;
  updatedAt: Date;
  agentId: string;
  fileNames: string[];
  usedFiles: boolean;
  chunksProcessed?: number;
  totalChunks?: number;
  successCount?: number;
  errorCount?: number;
  skippedCount?: number;
}

const TrainJobSchema = new Schema<ITrainJob>({
  jobId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], required: true },
  progress: { type: Number, default: 0 },
  error: { type: Schema.Types.Mixed, default: null },
  result: { type: Schema.Types.Mixed, default: null },
  agentId: { type: String, required: true },
  fileNames: { type: [String], default: [] },
  usedFiles: { type: Boolean, default: false },
  chunksProcessed: { type: Number, default: 0 },
  totalChunks: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model<ITrainJob>('TrainJob', TrainJobSchema); 