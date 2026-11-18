import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DirectoryPage from "../page";
import { DirectoryService } from "@/services/directoryService";
import { MemberService } from "@/services/memberService";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { DirectoryEntry } from "@/types/directory";

jest.mock("aws-amplify/auth", () => ({ fetchAuthSession: jest.fn(), signOut: jest.fn() }));
jest.mock("@/services/directoryService", () => ({
  DirectoryService: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), importRows: jest.fn() },
}));
jest.mock("@/services/memberService", () => ({
  ...jest.requireActual("@/services/memberService"),
  MemberService: { createMember: jest.fn() },
}));
jest.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: jest.fn() }));

const list = DirectoryService.list as jest.Mock;
const createMember = MemberService.createMember as jest.Mock;
const isAdmin = (value: boolean) => (useIsAdmin as jest.Mock).mockReturnValue({ isAdmin: value, loading: false });

const entry = (entryId: string, name: string, extra: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  entryId, name, createdAt: "t", updatedAt: "t", ...extra,
});

const ENTRIES = [
  entry("1", "Ann Smith", { email: "ann@x.org", linkedMember: { memberId: "m1", status: "ACTIVE" } }),
  entry("2", "Bob Jones", { email: "bob@x.org" }),
  entry("3", "Annette Rivera"),
];

async function renderPage() {
  render(<DirectoryPage />);
  await screen.findByText("Bob Jones");
}

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue(ENTRIES);
  isAdmin(false);
});

describe("Directory page search", () => {
  it("filters by name, case-insensitively, as you type", async () => {
    await renderPage();
    const search = screen.getByRole("textbox", { name: /search the directory/i });

    await userEvent.type(search, "ANN");
    expect(screen.getByText("Ann Smith")).toBeInTheDocument();
    expect(screen.getByText("Annette Rivera")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();

    await userEvent.clear(search);
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("matches on name only, not email", async () => {
    await renderPage();
    await userEvent.type(screen.getByRole("textbox", { name: /search/i }), "bob@x.org");
    expect(screen.getByText(/No one matches/)).toBeInTheDocument();
  });

  it("shows a no-match message with the search term", async () => {
    await renderPage();
    await userEvent.type(screen.getByRole("textbox", { name: /search/i }), "zzz");
    expect(screen.getByText(/No one matches .zzz./)).toBeInTheDocument();
  });
});

describe("Directory page states", () => {
  it("shows an error when the directory fails to load", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    list.mockRejectedValue(new Error("500"));
    render(<DirectoryPage />);
    expect(await screen.findByText("Failed to load the directory")).toBeInTheDocument();
  });

  it("tells members the directory is empty, and admins how to fill it", async () => {
    list.mockResolvedValue([]);
    const { unmount } = render(<DirectoryPage />);
    expect(await screen.findByText("The directory is empty")).toBeInTheDocument();
    unmount();

    isAdmin(true);
    render(<DirectoryPage />);
    expect(await screen.findByText(/import the club roster/i)).toBeInTheDocument();
  });
});

describe("Directory page admin controls", () => {
  it("are hidden from regular members", async () => {
    await renderPage();
    expect(screen.queryByRole("button", { name: /add entry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import spreadsheet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("are shown to admins, and 'Invite all' counts only unlinked entries with an email", async () => {
    isAdmin(true);
    await renderPage();
    expect(screen.getByRole("button", { name: /add entry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import spreadsheet/i })).toBeInTheDocument();
    // Ann is linked and Annette has no email, so only Bob is invitable.
    expect(screen.getByRole("button", { name: /invite all not yet members \(1\)/i })).toBeEnabled();
  });

  it("bulk-invites the invitable entries and reports the result", async () => {
    isAdmin(true);
    createMember.mockResolvedValue({ linkedExistingAccount: false });
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: /invite all not yet members/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Bob Jones \(bob@x.org\)/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /send 1 invite/i }));

    await waitFor(() => expect(within(dialog).getByText(/Done: 1 invited/)).toBeInTheDocument());
    expect(createMember).toHaveBeenCalledTimes(1);
    expect(createMember).toHaveBeenCalledWith({ name: "Bob Jones", email: "bob@x.org" });
    expect(list).toHaveBeenCalledTimes(2); // refetched so chips update
  });
});
