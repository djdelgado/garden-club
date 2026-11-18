import { memberInitials } from "@/components/members/MemberCard";
import { Member } from "@/types/member";

const member = (name: string, email = "zed@example.org") => ({ name, email }) as Member;

describe("memberInitials", () => {
  it.each([
    ["Jane Public", "JP"],
    ["Jane Q. Public", "JQ"], // capped at two letters
    ["  cher  ", "C"],
  ])("%j -> %s", (name, expected) => {
    expect(memberInitials(member(name))).toBe(expected);
  });

  it("falls back to the email's first letter when there's no name", () => {
    expect(memberInitials(member(""))).toBe("Z");
  });
});
