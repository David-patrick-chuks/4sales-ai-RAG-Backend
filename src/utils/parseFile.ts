import csvParser from 'csv-parser';
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import { Readable } from 'stream';
import textract from 'textract';

export async function parseFile(fileBuffer: Buffer, fileType: string): Promise<string | { error: string; source: 'document' }> {
  try {
    // Validate inputs
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error('fileBuffer must be a valid Buffer');
    }
    if (!fileType || typeof fileType !== 'string' || fileType.trim() === '') {
      throw new Error('fileType must be a non-empty string');
    }

    const normalizedFileType = fileType.toLowerCase();
    let content = '';

    if (normalizedFileType === 'pdf') {
      try {
        const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
        const maxPages = pdf.numPages;
        let text = '';

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          text += pageText + '\n';
        }

        content = text;
      } catch (error: any) {
        throw new Error(`Failed to parse PDF: ${error.message}`);
      }
    } else if (normalizedFileType === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        content = result.value;
      } catch (error: any) {
        throw new Error(`Failed to parse DOCX: ${error.message}`);
      }
    } else if (normalizedFileType === 'doc') {
      try {
        content = await new Promise<string>((resolve, reject) => {
          textract.fromBufferWithMime(
            'application/msword',
            fileBuffer,
            (error: any, text: string) => {
              if (error) reject(error);
              else resolve(text);
            }
          );
        });
      } catch (error: any) {
        throw new Error(`Failed to parse DOC: ${error.message}`);
      }
    } else if (normalizedFileType === 'csv') {
      try {
        content = await new Promise<string>((resolve, reject) => {
          const results: string[] = [];
          Readable.from(fileBuffer)
            .pipe(csvParser())
            .on('data', (data) => results.push(JSON.stringify(data)))
            .on('end', () => resolve(results.join('\n')))
            .on('error', (err) => reject(err));
        });
      } catch (error: any) {
        throw new Error(`Failed to parse CSV: ${error.message}`);
      }
    } else if (normalizedFileType === 'txt') {
      try {
        content = fileBuffer.toString('utf8');
      } catch (error: any) {
        throw new Error(`Failed to parse TXT: ${error.message}`);
      }
    } else {
      throw new Error(`Unsupported file type: ${normalizedFileType}`);
    }

    if (!content || content.trim() === '') {
      throw new Error('Parsed content is empty or invalid');
    }

    console.log(`Successfully parsed ${normalizedFileType} file`);
    return content;
  } catch (error: any) {
    console.error(`Error parsing ${fileType} file: ${error.message}`);
    return { error: error.message, source: 'document' };
  }
} 