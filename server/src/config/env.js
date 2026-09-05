import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional().default(''),
  REALTIME_MODEL: z.string().optional().default('gpt-4o-realtime-preview'),
  OMI_WEBHOOK_SECRET: z.string().optional().default(''),
  OMI_APP_ID: z.string().optional().default(''),
  OMI_APP_SECRET: z.string().optional().default(''),
  PUBLIC_SERVER_URL: z.string().url().default('https://ai-printshop-workflow-server.vercel.app'),
  CLIENT_ORIGINS: z
    .string()
    .default(
      [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'https://ai-printshop-workflow-admin.vercel.app',
        'https://ai-printshop-workflow-staff.vercel.app',
        'https://ai-printshop-workflow-worker.vercel.app',
      ].join(',')
    ),
});

const parsedResult = envSchema.safeParse(process.env);
if (!parsedResult.success) {
  const missing = parsedResult.error.issues.map((issue) => issue.path.join('.') || issue.message).join(', ');
  throw new Error(`Server env is incomplete (${missing}). Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.`);
}
const parsed = parsedResult.data;

export const env = {
  ...parsed,
  clientOrigins: parsed.CLIENT_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
