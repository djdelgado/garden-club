from typing import NotRequired, TypedDict


class ImageItem(TypedDict):
    """Image metadata stored in GardenClubImages table"""
    imageId: str
    folderName: str
    s3Key: str
    thumbKey: NotRequired[str]
    fileName: str
    uploadedAt: str
    uploadedBy: str
    isThumbnail: bool
    status: str
    # Epoch seconds; set on PENDING items so DynamoDB TTL reaps abandoned
    # uploads. Removed when the upload is completed (marked READY).
    ttl: NotRequired[int]


class PresignedUploadResult(TypedDict):
    """Response item for presigned upload URLs"""
    fileName: str
    imageId: str
    uploadUrl: str
    imageKey: str
    thumbUploadUrl: str
    thumbKey: str
    isThumbnail: bool
