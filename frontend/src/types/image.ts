export interface GardenImage {
  imageId: string;
  folderName: string;
  s3Key: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  isThumbnail: boolean;
  thumbKey?: string;
  imageUrl?: string;
  thumbUrl?: string;
  status?: "PENDING" | "READY";
}
