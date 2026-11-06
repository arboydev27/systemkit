// Set NEXT_PUBLIC_SITE_URL once a custom domain exists. On Vercel the production domain is detected.
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL
  ?? (vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000")).replace(/\/$/, "");
export const SITE_NAME = "SystemKit";
export const REPO_URL = "https://github.com/arboydev27/systemkit";
