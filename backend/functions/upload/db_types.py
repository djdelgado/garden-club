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


class FolderItem(TypedDict):
    """Folder metadata item stored in GardenClubFolders table.

    Kept in sync with the copy in functions/images/db_types.py. `imageCount`
    tracks READY images only and is incremented here in upload/complete.
    """
    folderName: str
    imageCount: int
    thumbnailKey: NotRequired[str]


class PresignedUploadResult(TypedDict):
    """Response item for presigned upload URLs"""
    fileName: str
    imageId: str
    uploadUrl: str
    imageKey: str
    thumbUploadUrl: str
    thumbKey: str
    isThumbnail: bool
