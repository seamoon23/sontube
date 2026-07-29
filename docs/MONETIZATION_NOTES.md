# SonTube Monetization Notes

## Product Positioning

The target buyer is the parent. The app is not positioned as a Kids Category app; it is a parent-managed family service with a restricted viewing client for children.

## Current MVP Decision

- Free trial is 14 days from app key creation.
- Child-facing app has no ads.
- Admin web may show a simple bottom ad/sponsor slot.
- Payment is not implemented in the MVP.
- App screens should not link directly to an external checkout until store policy is reviewed for the target distribution channel.

## Payment Direction To Evaluate

A practical later model is:

1. Parent creates or logs into a web admin account.
2. Parent pays on the web admin site if the distribution channel allows it.
3. The server stores entitlement on the account/app key, such as `paidUntil`.
4. The app sync API returns only entitlement state and approved catalog data.
5. The child-facing app never shows checkout UI.

## Store Policy Watchpoints

- Google Play generally requires Google Play Billing for in-app digital features and subscriptions in apps distributed through Play, unless a specific policy exception or enrolled alternative billing program applies.
- Apple generally requires In-App Purchase to unlock app features, with limited exceptions for some companion or multiplatform service cases.
- For parent-targeted distribution, avoid Kids Category claims unless the app is intentionally designed and reviewed under those requirements.
- Even outside Kids Category, avoid collecting child personal data and avoid ad/tracking SDKs in the child-facing client.

References:

- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play payments explanation: https://support.google.com/googleplay/android-developer/answer/10281818
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Kids guidance: https://developer.apple.com/kids/
