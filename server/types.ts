// Session type extensions for Express Session
declare module 'express-session' {
  interface SessionData {
    csrfSecret?: string;
  }
}

export {};