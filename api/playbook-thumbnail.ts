type ThumbnailRequest = {
  query?: Record<string, string | string[] | undefined>;
};

type ThumbnailResponse = {
  status: (code: number) => ThumbnailResponse;
  setHeader: (name: string, value: string) => ThumbnailResponse;
  send: (body: Buffer | string) => void;
};

const ALLOWED_HOSTS = new Set([
  "hyundai-user-story-17px.vercel.app",
  "hyundai-user-story-16px.vercel.app",
  "hyundai-user-story-20px.vercel.app",
  "playbook-test-game.vercel.app",
  "userstorygn803.vercel.app",
  "userstorygn804.vercel.app",
  "userstorygn802.vercel.app",
  "userstorygn801.vercel.app",
]);

function getAttribute(tag: string, attributeName: string) {
  const match = tag.match(new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function findOpenGraphImage(html: string, pageUrl: URL) {
  const metaTags = html.match(/<meta\\b[^>]*>/gi) ?? [];

  for (const metaTag of metaTags) {
    const property = getAttribute(metaTag, "property") ?? getAttribute(metaTag, "name");
    if (property?.toLowerCase() !== "og:image" && property?.toLowerCase() !== "twitter:image") {
      continue;
    }

    const content = getAttribute(metaTag, "content");
    if (!content) {
      continue;
    }

    try {
      const imageUrl = new URL(content, pageUrl);
      if (imageUrl.protocol === "https:" || imageUrl.protocol === "http:") {
        return imageUrl;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function sendError(response: ThumbnailResponse, status: number, message: string) {
  response
    .status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .send(JSON.stringify({ error: message }));
}

export default async function handler(request: ThumbnailRequest, response: ThumbnailResponse) {
  const queryUrl = request.query?.url;
  const sourceUrl = Array.isArray(queryUrl) ? queryUrl[0] : queryUrl;

  if (!sourceUrl) {
    sendError(response, 400, "Missing playbook URL");
    return;
  }

  let pageUrl: URL;
  try {
    pageUrl = new URL(sourceUrl);
  } catch {
    sendError(response, 400, "Invalid playbook URL");
    return;
  }

  if (pageUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(pageUrl.hostname)) {
    sendError(response, 403, "Playbook URL is not allowed");
    return;
  }

  try {
    const pageResponse = await fetch(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "HyundaiUserStoryMaster/1.0",
      },
    });

    if (!pageResponse.ok) {
      sendError(response, 502, "Playbook page could not be loaded");
      return;
    }

    const imageUrl = findOpenGraphImage(await pageResponse.text(), pageUrl);
    if (!imageUrl) {
      sendError(response, 404, "Playbook thumbnail was not found");
      return;
    }

    const imageResponse = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "HyundaiUserStoryMaster/1.0",
      },
    });

    if (!imageResponse.ok || !imageResponse.body) {
      sendError(response, 502, "Playbook thumbnail could not be loaded");
      return;
    }

    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    response
      .status(200)
      .setHeader("Content-Type", contentType)
      .setHeader("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800")
      .send(imageBuffer);
  } catch {
    sendError(response, 502, "Playbook thumbnail request failed");
  }
}
