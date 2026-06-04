import { ImageFolder } from '@/types/gallery';
import { GardenImage } from '@/types/image';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const IMAGE_PATH = "/images";
const UPLOAD_PATH = "/upload";

export const ImageService = {

  getImageFolders: async () => {
    const response = await apiGet<{ folders: ImageFolder[] }>(`${IMAGE_PATH}/folders`);
    return response?.folders || [];
  },

  getImagesbyFolderName: async (folderName: string) => {
    const response = await apiGet<{ images: GardenImage[] }>(`${IMAGE_PATH}?folderName=${encodeURIComponent(folderName)}`);
    return response?.images || [];
  },

  updateFolder: async (folderName: string, newFolderName: string) => {
    await apiPut(`${IMAGE_PATH}/folders/${encodeURIComponent(folderName)}`, {
      folderName,
      newFolderName,
    });
  },

  deleteFolder: async (folderName: string) => {
    await apiDelete(`${IMAGE_PATH}/folders/${encodeURIComponent(folderName)}`);
  },

  presignUpload: async (folderName: string, files: { fileName: string; contentType?: string }[]) => {
    const response = await apiPost<{
      uploads: { uploadUrl: string; imageKey: string; fileName: string; imageId: string }[];
    }>(`${UPLOAD_PATH}/presign`, { folderName, files });
    return response.uploads;
  },

  
  completeUpload: async (imageIds: string[]) => {
		await apiPost(`${UPLOAD_PATH}/complete`, { imageIds });
	},
    
	uploadToS3: async (uploadUrl: string, file: File, contentType?: string) => {
		await fetch(uploadUrl, {
			method: "PUT",
			body: file,
			headers: contentType ? { "Content-Type": contentType } : undefined,
			});
	},
};
