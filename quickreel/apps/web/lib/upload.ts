import { api, type ProjectImageSummary } from "./api";

function readImageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    img.src = url;
  });
}

/** presign -> direct PUT to storage -> complete. Works identically against the local-disk passthrough and real R2 presigned URLs. */
export async function uploadProjectImage(
  token: string,
  projectId: string,
  file: File,
): Promise<ProjectImageSummary> {
  const { storageKey, upload } = await api.presignImage(token, projectId, {
    filename: file.name,
    contentType: file.type,
  });

  const putResponse = await fetch(upload.url, {
    method: upload.method,
    headers: {
      ...upload.headers,
      "Content-Type": file.type,
      ...(upload.url.includes("/local-storage/") ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error(`Upload failed for "${file.name}" (${putResponse.status})`);
  }

  const dimensions = await readImageDimensions(file);
  return api.completeImage(token, projectId, {
    storageKey,
    originalFilename: file.name,
    width: dimensions?.width,
    height: dimensions?.height,
  });
}
