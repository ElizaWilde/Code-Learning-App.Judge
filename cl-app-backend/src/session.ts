import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { findUserByUsername } from "./db";
import { MODULE_PERMISSIONS, UserRole } from "./roles";
import { UserType } from "./db";

type SessionRecord = {
  token: string;
  username: string;
  createdAt: string;
};

type AuthenticatedUser = {
  id: number;
  username: string;
  role: UserRole;
  userType: UserType;
};

const sessions = new Map<string, SessionRecord>();

export type AuthedRequest = Request & {
  authUser?: AuthenticatedUser;
};

export function createSession(username: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, {
    token,
    username,
    createdAt: new Date().toISOString()
  });
  return token;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export function getRequestToken(req: Request): string | null {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function resolveSessionUser(token: string): AuthenticatedUser | null {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  const user = findUserByUsername(session.username);
  if (!user) {
    sessions.delete(token);
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    userType: user.user_type
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getRequestToken(req);
  if (!token) {
    res.status(401).json({ message: "missing bearer token" });
    return;
  }

  const user = resolveSessionUser(token);
  if (!user) {
    res.status(401).json({ message: "invalid or expired token" });
    return;
  }

  req.authUser = user;
  next();
}

export function getModulePermissions(role: UserRole): string[] {
  return MODULE_PERMISSIONS[role];
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
        res.status(403).json({
          message: "forbidden"
        });
        return;
      }

      next();
    });
  };
}
