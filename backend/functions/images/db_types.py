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


class FolderItem(TypedDict):
    """Folder metadata item stored in GardenClubFolders table.

    Maintained incrementally (upload/complete, delete_image, delete_folder,
    update_folder_name) so folder listing is O(folders), not a scan of every
    image. `imageCount` tracks READY images only.
    """
    folderName: str
    imageCount: int
    thumbnailKey: NotRequired[str]


class FolderMetadata(TypedDict):
    """Folder info returned in get_all_folders"""
    folderName: str
    thumbnailUrl: NotRequired[str]
    imageCount: int
