import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectoryCard } from "@/components/directory/DirectoryCard";
import { DirectoryEntry } from "@/types/directory";

const base: DirectoryEntry = {
  entryId: "e1",
  name: "Jane Q. Public",
  email: "jane@example.org",
  phone: "(504) 555-0123",
  address: "1 Elm St",
  createdAt: "t",
  updatedAt: "t",
};

describe("DirectoryCard", () => {
  it("renders mailto: and digits-only tel: links", () => {
    render(<DirectoryCard entry={base} />);
    expect(screen.getByRole("link", { name: "jane@example.org" })).toHaveAttribute(
      "href",
      "mailto:jane@example.org"
    );
    expect(screen.getByRole("link", { name: "(504) 555-0123" })).toHaveAttribute("href", "tel:5045550123");
    expect(screen.getByText("1 Elm St")).toBeInTheDocument();
  });

  it("falls back to two-letter initials when there's no linked photo", () => {
    render(<DirectoryCard entry={base} />);
    expect(screen.getByText("JQ")).toBeInTheDocument();
  });

  it("hides contact rows that are blank", () => {
    render(<DirectoryCard entry={{ ...base, email: undefined, phone: undefined, address: undefined }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    ["ACTIVE", "App member"],
    ["INVITED", "Invited"],
  ] as const)("shows the %s linked-member chip", (status, label) => {
    render(<DirectoryCard entry={{ ...base, linkedMember: { memberId: "m1", status } }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows no admin actions without handlers (regular members)", () => {
    render(<DirectoryCard entry={base} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("wires edit, delete and invite for admins", async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onInvite = jest.fn();
    render(<DirectoryCard entry={base} onEdit={onEdit} onDelete={onDelete} onInvite={onInvite} />);

    await userEvent.click(screen.getByRole("button", { name: /invite jane/i }));
    await userEvent.click(screen.getByRole("button", { name: /edit jane/i }));
    await userEvent.click(screen.getByRole("button", { name: /remove jane/i }));
    expect(onInvite).toHaveBeenCalledWith(base);
    expect(onEdit).toHaveBeenCalledWith(base);
    expect(onDelete).toHaveBeenCalledWith(base);
  });

  it.each([
    ["already linked", { linkedMember: { memberId: "m1", status: "ACTIVE" as const } }],
    ["no email", { email: undefined }],
  ])("offers no invite when %s", (_label, override) => {
    render(<DirectoryCard entry={{ ...base, ...override }} onInvite={jest.fn()} onEdit={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
});
