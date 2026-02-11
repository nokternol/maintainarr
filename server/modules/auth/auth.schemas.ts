import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  plexUsername: z.string().nullable(),
  plexId: z.number().nullable(),
  avatar: z.string().nullable(),
  userType: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const authSchemas = {
  plexLogin: {
    body: z.object({
      authToken: z.string().min(1, 'Auth token required'),
    }),
    response: userSchema,
  },

  getMe: {
    response: userSchema,
  },

  logout: {
    response: z.object({
      success: z.boolean(),
    }),
  },
};

export type UserResponse = z.infer<typeof userSchema>;
