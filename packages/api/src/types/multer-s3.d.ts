// Minimal typings for multer-s3 v3 (ships no bundled .d.ts).
declare module "multer-s3" {
  import type { StorageEngine } from "multer";
  import type { Request } from "express";

  type KeyCallback = (error: unknown, key?: string) => void;
  type ValueCallback = (error: unknown, value?: string) => void;

  interface MulterS3Options {
    s3: unknown;
    bucket: string | ((req: Request, file: Express.Multer.File, cb: ValueCallback) => void);
    key?: (req: Request, file: Express.Multer.File, cb: KeyCallback) => void;
    contentType?: unknown;
    acl?: string;
    metadata?: (req: Request, file: Express.Multer.File, cb: (error: unknown, metadata?: Record<string, string>) => void) => void;
  }

  interface MulterS3 {
    (options: MulterS3Options): StorageEngine;
    AUTO_CONTENT_TYPE: unknown;
    DEFAULT_CONTENT_TYPE: unknown;
  }

  const multerS3: MulterS3;
  export = multerS3;
}
