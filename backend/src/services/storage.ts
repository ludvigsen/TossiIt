import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface StorageService {
  uploadFile(file: Express.Multer.File): Promise<string>;
}

export class FirebaseStorageService implements StorageService {
  private bucket: any;

  constructor() {
    // Lazy load bucket to ensure admin.initializeApp() has run
    // this.bucket = admin.storage().bucket(); 
  }

  private getBucket() {
    if (!this.bucket) {
        this.bucket = admin.storage().bucket();
    }
    return this.bucket;
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const bucket = this.getBucket();
    const fileExtension = path.extname(file.originalname);
    const fileName = `dumps/${uuidv4()}${fileExtension}`;
    const fileUpload = bucket.file(fileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (error: any) => {
        console.error('Upload error:', error);
        reject(error);
      });

      blobStream.on('finish', async () => {
        // Make the file public (optional, or generate signed URL)
        // For simplicity in this demo, we'll make it public. 
        // In a real app, strict rules or signed URLs are better.
        try {
            await fileUpload.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            resolve(publicUrl);
        } catch (e) {
             console.error("Failed to make public:", e);
             // Fallback or re-throw
             reject(e);
        }
      });

      blobStream.end(file.buffer);
    });
  }
}

// Switch implementation based on env
// But for this "Cloud Ready" version, we prefer FirebaseStorage if available
export const storageService = new FirebaseStorageService();
