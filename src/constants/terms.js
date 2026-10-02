// src/constants/terms.js
// SmartFactory Terms of Use shown on the Signup screen.
// English only. Displayed in a scrollable modal; acceptance is required to register.

export const TERMS_UPDATED = "October 2026";

export const TERMS_SECTIONS = Object.freeze([
  {
    title: "1. Acceptance",
    body: "By creating a SmartFactory account you agree to these Terms of Use. If you use SmartFactory on behalf of a company or plant, you confirm you are authorized to accept them for that organization.",
  },
  {
    title: "2. Your account",
    body: "You must provide accurate first name, last name and email address, and keep your password confidential. You are responsible for all activity under your account. New accounts start with the Operator role and must verify their email address before signing in; roles are managed by administrators.",
  },
  {
    title: "3. Acceptable use",
    body: "Use SmartFactory only for supervising the industrial equipment you are authorized to monitor. You must not attempt to access other accounts, zones or machines outside your permissions, interfere with the platform or connected devices, extract data in bulk without authorization, or upload malicious content or instructions.",
  },
  {
    title: "4. Industrial data and safety",
    body: "SmartFactory displays sensor measurements, alerts, health scores and AI recommendations as decision aids. They do not replace professional judgment, on-site verification, or your plant's safety procedures. Always confirm critical readings and alerts through your established safety processes before acting on them.",
  },
  {
    title: "5. Roles and permissions",
    body: "Features are gated by role (Administrator, Operator, Technician, Responsable Industriel). Interface-level gating is a convenience; enforced access control happens on the server. Request any role change through your administrator.",
  },
  {
    title: "6. Availability",
    body: "We aim for continuous availability but do not guarantee uninterrupted service. Maintenance windows, backend upgrades and connectivity issues may temporarily limit monitoring, history or notifications. Plan critical supervision accordingly.",
  },
  {
    title: "7. Liability",
    body: "To the maximum extent permitted by law, SmartFactory is provided as-is and its operators are not liable for production losses, equipment damage or safety incidents resulting from reliance on displayed data, delayed notifications, or service interruptions.",
  },
  {
    title: "8. Changes to these terms",
    body: "We may update these terms as the platform evolves. Material changes will be announced in the application; continued use after an update constitutes acceptance of the revised terms.",
  },
  {
    title: "9. Contact",
    body: "Questions about these terms or your account: contact your plant administrator or the SmartFactory team at the support channel provided by your organization.",
  },
]);
