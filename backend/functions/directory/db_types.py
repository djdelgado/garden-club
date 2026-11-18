from typing import TypedDict


class DirectoryEntryItem(TypedDict, total=False):
    """A row in GardenClubDirectory: the club's roster, maintained by admins.

    Independent of app accounts (GardenClubMembers / Cognito). An entry is
    *linked* to an app member at read time when their emails match; no link is
    stored, so it can't go stale when members come and go.

    Optional attributes are omitted rather than stored as "" — ``emailLower`` is
    the EmailIndex GSI key, and DynamoDB rejects an empty string there.
    """
    entryId: str        # PK, uuid4
    name: str           # Required
    nameLower: str      # Matches no-email rows on re-import
    email: str          # Optional
    emailLower: str     # Optional; EmailIndex (sparse) for de-dupe + linking
    phone: str          # Optional
    address: str        # Optional
    createdAt: str      # ISO
    updatedAt: str      # ISO
