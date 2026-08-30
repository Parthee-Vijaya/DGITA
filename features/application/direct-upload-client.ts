export async function sha256File(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function isAllowedVercelBlobUploadUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ((url.hostname === "vercel.com" &&
        (url.pathname === "/api/blob" || url.pathname.startsWith("/api/blob/"))) ||
        url.hostname === "blob.vercel-storage.com" ||
        url.hostname.endsWith(".blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

export function isAllowedPrivateBlobUrl(value: string) {
  try {
    const url = new URL(value);
    const storeId = url.hostname.slice(
      0,
      -".private.blob.vercel-storage.com".length,
    );
    return (
      url.protocol === "https:" &&
      /^[a-z0-9-]+$/iu.test(storeId) &&
      url.hostname === `${storeId}.private.blob.vercel-storage.com` &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}
