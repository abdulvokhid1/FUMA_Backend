import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { Request } from 'express';
import * as fs from 'fs';

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const paymentsUploadOptions = {
  storage: diskStorage({
    destination: (req: Request, file, cb) => {
      const dest = join(process.cwd(), 'uploads', 'payments');
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const id = uuid();
      const ext = extname(file.originalname || '');
      cb(null, `pay_${id}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: any) => {
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'application/pdf';
    if (!ok) {
      return cb(new Error('Only JPG, PNG, or PDF files are allowed.'));
    }
    cb(null, true);
  },
};
