import { z } from "zod";

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    email: z.string().trim().email("Please enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export const createPostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(500, "Posts must be 500 characters or less.")
      .optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
    image: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.content && !data.image) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Post content or an image is required.",
        path: ["content"],
      });
    }
  });

export const commentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty.").max(500),
  postId: z.string().trim().min(1, "Post is required."),
});

export const replySchema = z.object({
  content: z.string().trim().min(1, "Reply cannot be empty.").max(500),
  commentId: z.string().trim().min(1, "Comment is required."),
});

export const likeSchema = z.object({
  entityType: z.enum(["post", "comment", "reply"]),
  entityId: z.string().trim().min(1, "Entity id is required."),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").optional(),
  lastName: z.string().trim().min(1, "Last name is required.").optional(),
  image: z.any().optional(),
});
