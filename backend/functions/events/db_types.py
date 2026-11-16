from typing import TypedDict, NotRequired, Set


class EventItem(TypedDict):
    """Event data stored in GardenClubEvents table"""
    eventId: str
    title: str
    description: str
    startTime: str
    endTime: str
    createdAt: str
    createdBy: str
    headerImageKey: NotRequired[str]
    # DynamoDB string set of attending memberIds (ADD/DELETE atomically). Absent
    # when nobody is attending — string sets can't be empty, so the attribute is
    # dropped when the last RSVP is removed.
    rsvps: NotRequired[Set[str]]


class MemberItem(TypedDict, total=False):
    """Subset of the GardenClubMembers row this handler reads to resolve RSVP
    attendees. The members function owns the full schema."""
    memberId: str
    cognitoSub: str
    name: str
