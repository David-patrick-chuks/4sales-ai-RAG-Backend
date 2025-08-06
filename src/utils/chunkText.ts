import crypto from 'crypto';
import Memory from '../models/Memory.js';

export interface ChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  startPosition?: number;
  endPosition?: number;
  section?: string;
}

export interface ChunkWithMetadata {
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Generate SHA256 hash of text content for deduplication
 */
export function generateContentHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Check if content has changed and determine new version
 */
export async function getContentVersion(agentId: string, contentHash: string, sourceUrl?: string): Promise<number> {
  try {
    // Find existing content with same hash
    const existing = await Memory.findOne({ 
      agentId, 
      contentHash,
      ...(sourceUrl && { sourceUrl }) // Only check same source URL if provided
    });
    
    if (existing) {
      return existing.contentVersion; // Return existing version
    }
    
    // Find highest version for this agent and source
    const highestVersion = await Memory.findOne({ 
      agentId,
      ...(sourceUrl && { sourceUrl })
    }).sort({ contentVersion: -1 });
    
    return (highestVersion?.contentVersion || 0) + 1;
  } catch (error) {
    console.error('Error getting content version:', error);
    return 1; // Default to version 1
  }
}

export function chunkText(text: string, maxLength: number = 2000, overlap: number = 400): ChunkWithMetadata[] {
    try {
        console.log(`[DEBUG] chunkText received text of type: ${typeof text} and length: ${text?.length || 0}`);
        if (typeof text !== 'string' || text.trim().length === 0) {
            console.error('[DEBUG] chunkText received invalid input. Returning empty array.');
            return [];
        }
        if (!Number.isFinite(maxLength) || maxLength <= 0) maxLength = 2000;
        if (!Number.isFinite(overlap) || overlap < 0) overlap = 400;
        
        // Split by paragraphs first to preserve natural breaks
        const paragraphs = text.split(/\n\s*\n/);
        let chunks: ChunkWithMetadata[] = [];
        let currentPosition = 0;
        let chunkIndex = 0;
        
        for (const paragraph of paragraphs) {
            try {
                if (paragraph.trim().length === 0) {
                    currentPosition += paragraph.length + 2; // +2 for \n\n
                    continue;
                }
                
                // If paragraph is short enough, keep it as one chunk
                if (paragraph.length <= maxLength) {
                    const chunkText = paragraph.trim();
                    chunks.push({
                        text: chunkText,
                        metadata: {
                            chunkIndex: chunkIndex++,
                            totalChunks: 0, // Will be set later
                            chunkSize: chunkText.length,
                            startPosition: currentPosition,
                            endPosition: currentPosition + chunkText.length,
                            section: `paragraph_${chunkIndex}`
                        }
                    });
                    currentPosition += paragraph.length + 2; // +2 for \n\n
                    continue;
                }
                
                // For longer paragraphs, try to preserve story context
                // Split by sentences but try to keep related content together
                const sentences = paragraph.split(/(?<=[.?!])\s+/);
                let current = '';
                let i = 0;
                let sentenceStartPosition = currentPosition;
                
                while (i < sentences.length) {
                    current = '';
                    let j = i;
                    
                    // Try to group sentences that form a complete thought or story segment
                    while (j < sentences.length && (current + sentences[j]).length <= maxLength) {
                        current += sentences[j] + ' ';
                        j++;
                    }
                    
                    // If we couldn't add any sentences, force at least one
                    if (i === j) {
                        const chunkText = sentences[i].trim();
                        chunks.push({
                            text: chunkText,
                            metadata: {
                                chunkIndex: chunkIndex++,
                                totalChunks: 0, // Will be set later
                                chunkSize: chunkText.length,
                                startPosition: sentenceStartPosition,
                                endPosition: sentenceStartPosition + chunkText.length,
                                section: `sentence_${chunkIndex}`
                            }
                        });
                        sentenceStartPosition += sentences[i].length + 1;
                        i++;
                        continue;
                    }

                    const chunkText = current.trim();
                    chunks.push({
                        text: chunkText,
                        metadata: {
                            chunkIndex: chunkIndex++,
                            totalChunks: 0, // Will be set later
                            chunkSize: chunkText.length,
                            startPosition: sentenceStartPosition,
                            endPosition: sentenceStartPosition + chunkText.length,
                            section: `paragraph_${chunkIndex}`
                        }
                    });
                    
                    // Overlap: step back by enough sentences to cover the overlap
                    // For story content, we want more overlap to preserve context
                    let overlapLen = 0;
                    let k = j - 1;

                    // Ensure k doesn't go past i
                    while (k > i && overlapLen < overlap) {
                        overlapLen += sentences[k].length + 1;
                        k--;
                    }
                    // Ensure i always moves forward
                    i = Math.max(i + 1, k);
                    sentenceStartPosition += chunkText.length + 1;
                }
                
                currentPosition += paragraph.length + 2; // +2 for \n\n
            } catch (innerErr) {
                console.error('[DEBUG] Error processing a paragraph in chunkText:', innerErr);
                // Continue with the next paragraph
                currentPosition += paragraph.length + 2;
            }
        }
        
        // Ensure we don't have empty chunks and set totalChunks
        const finalChunks = chunks.filter(chunk => chunk.text.trim().length > 0);
        const totalChunks = finalChunks.length;
        
        // Update totalChunks in metadata
        finalChunks.forEach(chunk => {
            chunk.metadata.totalChunks = totalChunks;
        });
        
        console.log(`[DEBUG] Text chunked. Number of chunks: ${finalChunks.length}`);
        
        // Debug: Show first few chunks
        if (finalChunks.length > 0) {
            console.log(`[DEBUG] First 3 chunks preview:`);
            finalChunks.slice(0, 3).forEach((chunk, index) => {
                console.log(`[DEBUG] Chunk ${index + 1} (${chunk.text.length} chars): "${chunk.text.substring(0, 150)}..."`);
            });
        }
        
        return finalChunks;
    } catch (err) {
        console.error('[DEBUG] chunkText error:', err);
        return [];
    }
}