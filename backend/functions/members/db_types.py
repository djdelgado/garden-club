from typing import TypedDict


class MemberItem(TypedDict):
    """Member data stored in GardenClubMembers table"""
    memberId: str
    email: str
    name: str
    createdAt: str
