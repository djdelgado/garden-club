export interface GardenImage {
  imageId: string;
  folderName: string;
  s3Key: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  isThumbnail: boolean;
}
