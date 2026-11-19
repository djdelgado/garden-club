import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { ImageService } from "@/services/imageService";
import { EventService } from "@/services/eventService";

jest.mock("aws-amplify/auth", () => ({ fetchAuthSession: jest.fn() }));
jest.mock("@/services/imageService", () => ({
  ImageService: { presignUpload: jest.fn(), uploadToS3: jest.fn() },
}));
jest.mock("@/services/eventService", () => ({
  EventService: { createEvent: jest.fn(), updateEvent: jest.fn() },
}));

// MUI's DateTimePicker is a sectioned field that's impractical to type into
// under jsdom. Swap in a plain input that speaks the same value/onChange
// contract (Date | null), keyed by label, so the modal's own logic is what's
// under test. Values round-trip as epoch milliseconds.
jest.mock("@mui/x-date-pickers/DateTimePicker", () => ({
  DateTimePicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | null;
    onChange: (v: Date | null) => void;
  }) => (
    <input
      aria-label={label}
      value={value ? String(value.getTime()) : ""}
      onChange={(e) => onChange(e.target.value ? new Date(Number(e.target.value)) : null)}
    />
  ),
}));

const presignUpload = ImageService.presignUpload as jest.Mock;
const uploadToS3 = ImageService.uploadToS3 as jest.Mock;
const createEvent = EventService.createEvent as jest.Mock;

const HOUR = 60 * 60 * 1000;

function renderModal() {
  const onEventSaved = jest.fn();
  render(<CreateEventModal open onClose={jest.fn()} onEventSaved={onEventSaved} />);
  return { onEventSaved };
}

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});

describe("CreateEventModal times", () => {
  it("defaults to the next whole hour, one hour long", () => {
    renderModal();
    const start = Number((screen.getByLabelText("Start Time") as HTMLInputElement).value);
    const end = Number((screen.getByLabelText("End Time") as HTMLInputElement).value);
    expect(new Date(start).getMinutes()).toBe(0);
    expect(start).toBeGreaterThan(Date.now());
    expect(end - start).toBe(HOUR);
  });

  it("moves the end time to one hour after a newly picked start time", () => {
    renderModal();
    const picked = new Date(2027, 3, 12, 14, 30).getTime();
    fireEvent.change(screen.getByLabelText("Start Time"), { target: { value: String(picked) } });
    expect(screen.getByLabelText("End Time")).toHaveValue(String(picked + HOUR));
  });

  it("still lets the end time be changed by hand afterwards", () => {
    renderModal();
    const picked = new Date(2027, 3, 12, 14, 0).getTime();
    fireEvent.change(screen.getByLabelText("Start Time"), { target: { value: String(picked) } });
    fireEvent.change(screen.getByLabelText("End Time"), { target: { value: String(picked + 3 * HOUR) } });
    expect(screen.getByLabelText("End Time")).toHaveValue(String(picked + 3 * HOUR));
  });

  it("rejects an end time that isn't after the start", async () => {
    renderModal();
    const picked = new Date(2027, 3, 12, 14, 0).getTime();
    await userEvent.type(screen.getByLabelText("Event Title"), "Seed swap");
    await userEvent.type(screen.getByLabelText("Description"), "Bring seeds");
    fireEvent.change(screen.getByLabelText("Start Time"), { target: { value: String(picked) } });
    fireEvent.change(screen.getByLabelText("End Time"), { target: { value: String(picked - HOUR) } });
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));
    expect(await screen.findByText("End time must be after the start time")).toBeInTheDocument();
    expect(createEvent).not.toHaveBeenCalled();
  });
});

describe("CreateEventModal banner upload", () => {
  const file = new File(["png-bytes"], "banner.png", { type: "image/png" });

  function pickFile(f: File) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [f] } });
  }

  it("presigns and uploads with the file's content type, then saves the key", async () => {
    presignUpload.mockResolvedValue([
      { uploadUrl: "https://s3.example/put", imageKey: "event-banners/id/banner.png" },
    ]);
    uploadToS3.mockResolvedValue(undefined);
    createEvent.mockResolvedValue(undefined);
    const { onEventSaved } = renderModal();

    pickFile(file);

    expect(await screen.findByText("Uploaded")).toBeInTheDocument();
    expect(presignUpload).toHaveBeenCalledWith("event-banners", [
      { fileName: "banner.png", contentType: "image/png" },
    ]);
    expect(uploadToS3).toHaveBeenCalledWith("https://s3.example/put", file, "image/png");
    expect(screen.getByAltText("Banner preview")).toHaveAttribute("src", "blob:preview");

    await userEvent.type(screen.getByLabelText("Event Title"), "Seed swap");
    await userEvent.type(screen.getByLabelText("Description"), "Bring seeds");
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(onEventSaved).toHaveBeenCalled());
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ headerImageKey: "event-banners/id/banner.png" })
    );
  });

  it("shows an error and keeps no key when the upload fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    presignUpload.mockResolvedValue([{ uploadUrl: "https://s3.example/put", imageKey: "k" }]);
    uploadToS3.mockRejectedValue(new Error("Upload failed (403)"));
    renderModal();

    pickFile(file);

    expect(await screen.findByText("Failed to upload banner image")).toBeInTheDocument();
    expect(screen.queryByText("Uploaded")).not.toBeInTheDocument();
    expect(screen.queryByAltText("Banner preview")).not.toBeInTheDocument();
  });

  it("refuses non-image files without calling the API", async () => {
    renderModal();
    pickFile(new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByText("Please choose an image file for the banner")).toBeInTheDocument();
    expect(presignUpload).not.toHaveBeenCalled();
  });
});
