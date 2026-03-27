export interface GardenImage {
  imageId: string;
  eventId: string;
  s3Key: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  tags?: string[];
}
