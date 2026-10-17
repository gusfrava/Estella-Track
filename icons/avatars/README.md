# Account avatars

Approved artwork from the original six-avatar concept. Web assets are static 384 × 384 WebP files; original PNGs are preserved locally in `design/avatar-originals/` (the design folder is ignored by Git).

| File | Collection | Cost |
| --- | --- | --- |
| release-estella.webp | Launch: Estella | Free |
| release-diego.webp | Launch: Diego | Free |
| release-dog.webp | Launch: dog with headband | Free |
| halloween-estella.webp | Halloween: flying witch | 100 points |
| halloween-diego.webp | Halloween: vampire | 100 points |
| halloween-dog.webp | Halloween: ghost | 100 points |

Web implementation only. Account → Your avatar opens the picker. Locked artwork is grey; purchase requires confirmation. These account icons do not change the onboarding character.

Server deployment prerequisite: deploy `functions:chooseAvatar` before publishing the web changes. Ownership, selected avatar and point deduction are stored atomically in the existing server-owned wallet. Existing rules already deny client writes to that wallet; no rule changes are needed. Purchases are permanent and idempotent. No seasonal expiry has been configured.
