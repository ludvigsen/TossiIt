import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StorageService {
  uploadFile(file: Express.Multer.File): Promise<string>;
}

export class LocalStorageService implements StorageService {
  private uploadDir: string;

  constructor(uploadDir: string = 'uploads') {
    this.uploadDir = path.resolve(process.cwd(), uploadDir);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(this.uploadDir, fileName);

    await fs.promises.writeFile(filePath, file.buffer);
    
    // Return a relative URL or path
    return `/uploads/${fileName}`;
  }
}

// Placeholder for Supabase/S3
export class CloudStorageService implements StorageService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    throw new Error('Method not implemented.');
  }
}

export const storageService = new LocalStorageService();

