from typing import TypedDict


class MemberItem(TypedDict, total=False):
    """Member data stored in GardenClubMembers table.

    The table is the source of truth for the directory; Cognito owns credentials.
    ``phone`` and ``address`` are deliberately kept in DynamoDB only (they map to
    Cognito standard attributes ``phone_number``/``address`` — syncing them into
    Cognito would trigger SMS/verification behaviour we don't want).
    """
    memberId: str            # PK, uuid4
    cognitoSub: str          # Immutable join key from AdminCreateUser
    cognitoUsername: str     # Immutable Cognito username (diverges from email after an edit)
    email: str               # Display email (admin-editable)
    emailLower: str          # Normalized, EmailIndex GSI key for duplicate checks
    name: str                # Source of truth; seeded once at first sign-in
    nameSyncedAt: str        # Set once the seed happens — after this, the table wins
    phone: str               # Member-entered
    address: str             # Member-entered
    photoKey: str            # S3 key (not a URL)
    status: str              # INVITED | ACTIVE
    role: str                # MEMBER | ADMIN (mirrors Cognito group)
    createdAt: str           # ISO
    updatedAt: str           # ISO
    lastInviteSentAt: str    # Drives the resend-invite UX
