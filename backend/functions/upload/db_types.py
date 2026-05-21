from typing import TypedDict


class ImageItem(TypedDict):
    """Image metadata stored in GardenClubImages table"""
    imageId: str
    folderName: str
    s3Key: str
    fileName: str
    uploadedAt: str
    uploadedBy: str
    isThumbnail: bool
    status: str


class PresignedUploadResult(TypedDict):
    """Response item for presigned upload URLs"""
    fileName: str
    imageId: str
    uploadUrl: str
    imageKey: str
    isThumbnail: bool
