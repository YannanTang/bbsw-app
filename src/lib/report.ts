// "I believe I'm registered" link shown when an email isn't on the registration list.
// Opens the person's own mail app with a prefilled note to the tech team; nothing is sent automatically.
export const REPORT_TO = "bbswtech@bbsw.org";

export function reportHref(feature: string, name: string, email: string): string {
  const subject = `BBSW 2026 app: registration not found (${feature})`;
  const body = [
    "Hi BBSW tech team,",
    "",
    `The app couldn't find my email on the registration list when I tried the ${feature}, but I believe I'm registered.`,
    "",
    `Name: ${name}`,
    `Email I entered: ${email}`,
    "",
    "Other details (for example, another email I might have registered with, or my company if a colleague registered me):",
    "",
  ].join("\n");
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
