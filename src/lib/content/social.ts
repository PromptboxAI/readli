/** Readli's official social accounts (Kevin, 2026-10-10). Shown in the footer and on /company. */
export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube" | "pinterest" | "linkedin" | "threads" | "x";

export interface SocialAccount {
  platform: SocialPlatform;
  name: string;
  handle: string;
  url: string;
}

export const SOCIAL_ACCOUNTS: readonly SocialAccount[] = [
  { platform: "facebook", name: "Facebook", handle: "@readliai", url: "https://www.facebook.com/readliai" },
  { platform: "instagram", name: "Instagram", handle: "@readliai", url: "https://www.instagram.com/readliai/" },
  { platform: "tiktok", name: "TikTok", handle: "@readliai", url: "https://www.tiktok.com/@readliai" },
  { platform: "youtube", name: "YouTube", handle: "@readliai", url: "https://www.youtube.com/@readliai" },
  { platform: "pinterest", name: "Pinterest", handle: "@readliai", url: "https://www.pinterest.com/readliai/" },
  { platform: "linkedin", name: "LinkedIn", handle: "Readli", url: "https://www.linkedin.com/company/readli/" },
  { platform: "threads", name: "Threads", handle: "@readliai", url: "https://www.threads.com/@readliai" },
  { platform: "x", name: "X (Twitter)", handle: "@readliai", url: "https://x.com/readliai" },
];
