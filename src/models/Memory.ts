import mongoose, { Document, Schema } from 'mongoose';

export interface IMemory extends Document {
  agentId: string;
  text: string;
  embedding: number[];
  source: 'audio' | 'video' | 'document' | 'website' | 'youtube';
  sourceUrl?: string;
  chunkIndex: number; // Position of this chunk in the original document
  contentHash: string; // SHA256 hash of the text content for deduplication
  contentVersion: number; // Version number for content updates
  chunkMetadata: {
    totalChunks: number; // Total number of chunks in the original document
    chunkSize: number; // Size of this chunk in characters
    startPosition?: number; // Approximate start position in original text
    endPosition?: number; // Approximate end position in original text
    fileName?: string; // For file-based sources
    pageNumber?: number; // For PDF documents
    timestamp?: string; // For audio/video sources
    section?: string; // Section or chapter information
    [key: string]: any; // Allow additional metadata
  };
  sourceMetadata?: {
    title?: string;
    author?: string;
    duration?: number;
    timestamp?: string;
    [key: string]: any;
  };
}

const MemorySchema = new Schema<IMemory>({
  agentId: { type: String, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true }, // Vector index should be created in MongoDB Atlas
  source: { 
    type: String, 
    enum: ["audio", "video", "document", "website", "youtube"],
    required: true,
    default: "document" // Default source for backward compatibility
  },
  sourceUrl: { type: String, required: false },
  chunkIndex: { type: Number, required: true, default: 0 }, // Position of chunk in original document
  contentHash: { type: String, required: true }, // SHA256 hash for deduplication
  contentVersion: { type: Number, required: true, default: 1 }, // Version number
  chunkMetadata: { 
    type: Schema.Types.Mixed, 
    required: true,
    default: {
      totalChunks: 1,
      chunkSize: 0
    }
  },
  sourceMetadata: { 
    type: Schema.Types.Mixed, 
    required: false,
    default: {}
  }
});

// Create indexes for better query performance
MemorySchema.index({ agentId: 1, source: 1 });
MemorySchema.index({ agentId: 1, sourceUrl: 1 });
MemorySchema.index({ agentId: 1, chunkIndex: 1 });
MemorySchema.index({ agentId: 1, 'chunkMetadata.totalChunks': 1 });
MemorySchema.index({ agentId: 1, contentHash: 1 }); // For deduplication lookups
MemorySchema.index({ agentId: 1, contentVersion: 1 }); // For versioning

// NOTE: Create the vector index on 'embedding' in MongoDB Atlas, not in Mongoose.

export default mongoose.model<IMemory>('Memory', MemorySchema); 