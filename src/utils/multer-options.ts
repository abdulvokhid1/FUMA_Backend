import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = './uploads/payment_proofs';

export const multerOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      // Ensure the directory exists
      if (!existsSync(UPLOAD_DIR)) {
        mkdirSync(UPLOAD_DIR, { recursive: true });
      }
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = extname(file.originalname);
      const safeName = file.originalname
        .replace(ext, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 20); // limit length
      cb(null, `${safeName}-${timestamp}${ext}`);
    },
  }),
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(
        new BadRequestException('이미지 파일만 업로드 가능합니다.'),
        false,
      );
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
};
