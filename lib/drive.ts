import { google } from "googleapis";
import { Readable } from "stream";

export function driveConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_SERVICE_ACCOUNT_FILE) &&
      process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

function getAuth() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (inline) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(inline),
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
  }
  if (file) {
    return new google.auth.GoogleAuth({
      keyFile: file,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
  }
  throw new Error(
    "Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_FILE) and GOOGLE_DRIVE_FOLDER_ID in .env.local — see .env.example."
  );
}

/**
 * Upload a Markdown CV to the configured Drive folder as a Google Doc.
 * Returns the file id and a webViewLink.
 */
export async function uploadCvToDrive(
  name: string,
  markdown: string
): Promise<{ fileId: string; link: string }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      "GOOGLE_DRIVE_FOLDER_ID is not set. Share a Drive folder with the service account and set its ID in .env.local."
    );
  }
  const drive = google.drive({ version: "v3", auth: getAuth() });
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      mimeType: "application/vnd.google-apps.document",
    },
    media: {
      mimeType: "text/markdown",
      body: Readable.from([markdown]),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const fileId = res.data.id!;
  return { fileId, link: res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view` };
}
