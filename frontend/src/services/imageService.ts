import { ImageFolder } from '@/types/gallery';
import { GardenImage } from '@/types/image';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const IMAGE_PATH = "/images";
const UPLOAD_PATH = "/upload";

// Simple in-memory cache for the browsing session so back-navigation
// (album -> back -> album) is instant. The API returns 1 h presigned URLs,
// so entries are comfortably fresh within a session; any mutation
// (upload, rename, delete) clears the cache to avoid stale data.
let foldersCache: ImageFolder[] | null = null;
const imagesByFolder = new Map<string, GardenImage[]>();

function clearCache() {
  foldersCache = null;
  imagesByFolder.clear();
}

export const ImageService = {

  getImageFolders: async () => {
    if (foldersCache) return foldersCache;
    const response = await apiGet<{ folders: ImageFolder[] }>(`${IMAGE_PATH}/folders`);
    foldersCache = response?.folders || [];
    return foldersCache;
  },

  getImagesbyFolderName: async (folderName: string) => {
    const cached = imagesByFolder.get(folderName);
    if (cached) return cached;
    const response = await apiGet<{ images: GardenImage[] }>(`${IMAGE_PATH}?folderName=${encodeURIComponent(folderName)}`);
    const images = response?.images || [];
    imagesByFolder.set(folderName, images);
    return images;
  },

  updateFolder: async (folderName: string, newFolderName: string) => {
    await apiPut(`${IMAGE_PATH}/folders/${encodeURIComponent(folderName)}`, {
      folderName,
      newFolderName,
    });
    clearCache();
  },

  deleteFolder: async (folderName: string) => {
    await apiDelete(`${IMAGE_PATH}/folders/${encodeURIComponent(folderName)}`);
    clearCache();
  },

  deleteImage: async (imageId: string) => {
    await apiDelete(`${IMAGE_PATH}/${encodeURIComponent(imageId)}`);
    clearCache();
  },

  presignUpload: async (folderName: string, files: { fileName: string; contentType?: string }[]) => {
    const response = await apiPost<{
      uploads: {
        uploadUrl: string;
        imageKey: string;
        thumbUploadUrl: string;
        thumbKey: string;
        fileName: string;
        imageId: string;
      }[];
    }>(`${UPLOAD_PATH}/presign`, { folderName, files });
    return response.uploads;
  },


  completeUpload: async (imageIds: string[]) => {
		await apiPost(`${UPLOAD_PATH}/complete`, { imageIds });
		clearCache();
	},
    
	uploadToS3: async (uploadUrl: string, file: Blob, contentType?: string) => {
		// fetch only rejects on network errors, so a 403 (expired URL) or 5xx
		// resolves normally. Check res.ok so the caller can detect failures and
		// avoid marking a never-uploaded object READY.
		const res = await fetch(uploadUrl, {
			method: "PUT",
			body: file,
			// The presigned PUT signs Cache-Control (see backend upload handler), so
			// this value must match IMAGE_CACHE_CONTROL exactly or S3 rejects the PUT.
			headers: {
				"Cache-Control": "public, max-age=31536000, immutable",
				...(contentType ? { "Content-Type": contentType } : {}),
			},
		});
		if (!res.ok) {
			throw new Error(`Upload failed (${res.status})`);
		}
	},
};
