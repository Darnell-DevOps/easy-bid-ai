import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Swaps the browser tab's favicon to the page-owner's custom favicon for
 * client-facing routes (portal, lead form, proposal, contract, onboarding, booking).
 *
 * Falls back silently to the app default when the owner hasn't uploaded one.
 * Updates <title> when a business name is set so the tab reads like the owner's brand.
 */
export default function DynamicFavicon({
  userId,
  appendTitle = false,
}: {
  userId?: string | null;
  appendTitle?: boolean;
}) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let previousFaviconHref: string | null = null;
    let injectedLink: HTMLLinkElement | null = null;
    let previousTitle: string | null = null;

    (async () => {
      const { data, error } = await supabase.rpc("get_public_branding", {
        p_user_id: userId,
      });
      if (cancelled || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      const faviconUrl: string | null = row?.favicon_url || null;
      const businessName: string | null = row?.business_name || null;

      if (faviconUrl) {
        // Remove any existing icon links and inject ours so the swap is clean.
        const existing = document.head.querySelectorAll<HTMLLinkElement>(
          'link[rel~="icon"], link[rel="shortcut icon"]'
        );
        if (existing.length > 0) {
          previousFaviconHref = existing[0].href;
          existing.forEach((el) => el.remove());
        }
        injectedLink = document.createElement("link");
        injectedLink.rel = "icon";
        injectedLink.href = faviconUrl;
        document.head.appendChild(injectedLink);
      }

      if (appendTitle && businessName) {
        previousTitle = document.title;
        document.title = businessName;
      }
    })();

    return () => {
      cancelled = true;
      if (injectedLink && injectedLink.parentNode) injectedLink.parentNode.removeChild(injectedLink);
      if (previousFaviconHref) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = previousFaviconHref;
        document.head.appendChild(link);
      }
      if (previousTitle !== null) document.title = previousTitle;
    };
  }, [userId, appendTitle]);

  return null;
}
