import { ImageService } from "@/services/imageService";
import { Button } from "@mui/material";

export function DeleteAlbumBtn(props: {
  folderName: string;
  onDeleted?: () => void;
}) {
  const { folderName, onDeleted } = props;
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this album?")) {
      ImageService.deleteFolder(folderName)
        .then(() => {
          onDeleted?.();
        })
        .catch(() => {
          alert("Failed to delete album. Please try again.");
        });
    }
  };

  return (
    <Button
      className="delete-album-btn"
      variant="outlined"
      color="error"
      onClick={handleDelete}
    >
      Delete Album
    </Button>
  );
}
