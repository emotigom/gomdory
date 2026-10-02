import WebsiteStudioStarterClient from "./WebsiteStudioStarterClient";

export default function WebsiteStudioStarterPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_20%_-10%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#030712_46%,#020617_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <WebsiteStudioStarterClient />
    </main>
  );
}
