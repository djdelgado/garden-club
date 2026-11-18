import { renderHook, waitFor } from "@testing-library/react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

jest.mock("aws-amplify/auth", () => ({ fetchAuthSession: jest.fn() }));
const mockSession = fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>;

/** A session whose ID token carries the given `cognito:groups` claim. */
function sessionWithGroups(groups: unknown) {
  const payload = groups === undefined ? {} : { "cognito:groups": groups };
  return { tokens: { idToken: { payload } } } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>;
}

async function settle() {
  const hook = renderHook(() => useIsAdmin());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook.result.current;
}

describe("useIsAdmin", () => {
  beforeEach(() => mockSession.mockReset());

  it("starts not-admin and loading, so admin UI never flashes", () => {
    mockSession.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toEqual({ isAdmin: false, loading: true });
  });

  it("is true when cognito:groups contains Admins", async () => {
    mockSession.mockResolvedValue(sessionWithGroups(["Members", "Admins"]));
    expect((await settle()).isAdmin).toBe(true);
  });

  it.each([
    ["another group only", ["Members"]],
    ["an empty list", []],
    ["no groups claim", undefined],
    // Amplify decodes the claim to an array; a bracketed string (the API
    // Gateway form) must not be mistaken for membership.
    ["the API Gateway bracketed string", "[Admins]"],
    ["a case-mismatched name", ["admins"]],
  ])("is false for %s", async (_label, groups) => {
    mockSession.mockResolvedValue(sessionWithGroups(groups));
    expect((await settle()).isAdmin).toBe(false);
  });

  it("is false when there is no ID token (signed out)", async () => {
    mockSession.mockResolvedValue({ tokens: undefined } as Awaited<ReturnType<typeof fetchAuthSession>>);
    expect((await settle()).isAdmin).toBe(false);
  });

  it("is false (not an error) when the session lookup throws", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSession.mockRejectedValue(new Error("network"));
    expect((await settle()).isAdmin).toBe(false);
    spy.mockRestore();
  });
});
