import { render, screen } from "@testing-library/react";
import { EventCard } from "@/components/events/EventCard";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { Event } from "@/types/event";

jest.mock("aws-amplify/auth", () => ({ fetchAuthSession: jest.fn() }));
jest.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: false, loading: false }) }));

const BANNER = "https://cdn.example.net/event-banners/abc/banner.jpg";

const base: Event = {
  eventId: "evt-1",
  title: "Spring Planting",
  description: "Bring gloves",
  startTime: "2027-04-12T14:00:00Z",
  endTime: "2027-04-12T15:00:00Z",
  createdAt: "t",
  createdBy: "u",
  rsvpCount: 0,
  isAttending: false,
};

// Emotion inserts the sx styles as CSSOM rules (and keeps them between tests).
// Pull out just the rules for this element's generated class, as text, so the
// assertion doesn't depend on jsdom's partial computed-style support.
function cssFor(el: HTMLElement): string {
  const cls = Array.from(el.classList).find((c) => c.startsWith("css-"));
  if (!cls) return "";
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText))
    .filter((text) => text.includes(`.${cls} `) || text.includes(`.${cls}{`))
    .join("\n");
}

describe("event banner", () => {
  it("puts the banner behind the date on the event card", () => {
    render(<EventCard event={{ ...base, headerImageUrl: BANNER }} onClick={jest.fn()} />);
    expect(cssFor(screen.getByTestId("event-date"))).toContain(`url("${BANNER}")`);
  });

  it("keeps the plain date block when there's no banner", () => {
    render(<EventCard event={base} onClick={jest.fn()} />);
    const css = cssFor(screen.getByTestId("event-date"));
    expect(css).not.toBe("");
    expect(css).not.toContain("url(");
  });

  it("shows the banner at the top of the detail modal", () => {
    render(<EventDetailModal event={{ ...base, headerImageUrl: BANNER }} onClose={jest.fn()} />);
    // next/image may wrap the src in its loader URL under Jest; decode to compare.
    const src = screen.getByRole("img", { name: "Spring Planting" }).getAttribute("src") ?? "";
    expect(decodeURIComponent(src)).toContain(BANNER);
  });

  it("shows no banner image in the modal without one", () => {
    render(<EventDetailModal event={base} onClose={jest.fn()} />);
    expect(screen.queryByRole("img", { name: "Spring Planting" })).not.toBeInTheDocument();
  });
});
