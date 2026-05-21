from typing import TypedDict, NotRequired


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


class FolderMetadata(TypedDict):
    """Folder info returned in get_all_folders"""
    folderName: str
    thumbnailUrl: NotRequired[str]
    imageCount: int
