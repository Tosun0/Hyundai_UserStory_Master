type AccessRequest = {
  method?: string;
  body?: unknown;
};

type AccessResponse = {
  status: (code: number) => AccessResponse;
  setHeader: (name: string, value: string) => AccessResponse;
  send: (body: string) => void;
};

type AccessGroup = "ALL" | "H" | "GN8";

const ACCESS_CODE_ENV_BY_GROUP: Record<AccessGroup, string> = {
  ALL: "ACCESS_CODES_ALL",
  H: "ACCESS_CODES_H",
  GN8: "ACCESS_CODES_GN8",
};

function getConfiguredCodes(group: AccessGroup) {
  return (process.env[ACCESS_CODE_ENV_BY_GROUP[group]] ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

function sendJson(response: AccessResponse, status: number, body: Record<string, unknown>) {
  response
    .status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "no-store")
    .send(JSON.stringify(body));
}

function parseBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as { code?: unknown };
    } catch {
      return null;
    }
  }

  return body && typeof body === "object" ? (body as { code?: unknown }) : null;
}

export default function handler(request: AccessRequest, response: AccessResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = parseBody(request.body);
  const submittedCode = typeof body?.code === "string" ? body.code.trim() : "";

  if (!submittedCode || submittedCode.length > 128) {
    sendJson(response, 400, { error: "Invalid access code" });
    return;
  }

  const group = (["ALL", "H", "GN8"] as const).find((candidate) =>
    getConfiguredCodes(candidate).includes(submittedCode),
  );

  if (!group) {
    sendJson(response, 401, { error: "Invalid access code" });
    return;
  }

  sendJson(response, 200, { group });
}
