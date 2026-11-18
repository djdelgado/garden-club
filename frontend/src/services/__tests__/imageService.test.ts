import { ImageService } from "@/services/imageService";

// imageService imports lib/api, which imports Amplify; keep it inert.
jest.mock("aws-amplify/auth", () => ({ fetchAuthSession: jest.fn(), signOut: jest.fn() }));

describe("ImageService.uploadToS3", () => {
  const fetchMock = jest.fn();
  const file = new Blob(["img"], { type: "image/png" });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("PUTs the file with the signed Cache-Control and the content type", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await ImageService.uploadToS3("https://s3.example/put?sig", file, "image/png");

    expect(fetchMock).toHaveBeenCalledWith("https://s3.example/put?sig", {
      method: "PUT",
      body: file,
      headers: {
        // Must match IMAGE_CACHE_CONTROL in the upload handler: it is part of
        // the presigned signature, so any drift makes S3 reject the PUT.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/png",
      },
    });
  });

  it("omits Content-Type when none is given", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await ImageService.uploadToS3("https://s3.example/put", file);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
  });

  it.each([403, 500])("throws on a non-2xx response (%i)", async (status) => {
    // fetch resolves (doesn't reject) on HTTP errors; an expired presigned URL
    // is a 403 that must not be treated as a successful upload.
    fetchMock.mockResolvedValue({ ok: false, status });
    await expect(ImageService.uploadToS3("https://s3.example/put", file)).rejects.toThrow(
      `Upload failed (${status})`
    );
  });

  it("propagates network errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(ImageService.uploadToS3("https://s3.example/put", file)).rejects.toThrow("Failed to fetch");
  });
});
