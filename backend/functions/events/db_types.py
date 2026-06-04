from typing import TypedDict, NotRequired


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
