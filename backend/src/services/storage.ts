import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export interface StorageService {
  uploadFile(file: Express.Multer.File): Promise<string>;
}

class FirebaseStorageService implements StorageService {
  private bucket: any;
  private bucketName?: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName;
  }

  private getBucket() {
    if (!this.bucket) {
      this.bucket = this.bucketName
        ? admin.storage().bucket(this.bucketName)
        : admin.storage().bucket();
    }
    return this.bucket;
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const bucket = this.getBucket();
    const fileExtension = path.extname(file.originalname) || '.bin';
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
        try {
          await fileUpload.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
          resolve(publicUrl);
        } catch (e) {
          console.error('Failed to make public:', e);
          reject(e);
        }
      });

      blobStream.end(file.buffer);
    });
  }
}

class LocalStorageService implements StorageService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const fileExtension = path.extname(file.originalname) || '.bin';
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    // Served by express static in non-production
    return `/uploads/${fileName}`;
  }
}

const bucketName =
  (admin.apps.length && (admin.app().options as any)?.storageBucket) ||
  process.env.STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET;

export const storageService: StorageService = bucketName
  ? new FirebaseStorageService(bucketName as string)
  : new LocalStorageService();
