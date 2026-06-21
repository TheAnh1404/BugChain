import { UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: UserRole;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
};
