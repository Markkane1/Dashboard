declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email?: string;
      role?: string;
      name?: string;
      [key: string]: unknown;
    };
    contentManager?: unknown;
  }
}
