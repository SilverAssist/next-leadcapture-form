// NOTE: no "use client" here, deliberately. This page is a Server Component
// that imports the package -- if `LeadCaptureForm` shipped without its own
// "use client" directive, `next build` would fail right here, a defect no
// unit test can see.
import LeadCaptureForm from "@silverassist/leadcapture-form";

export default function Page() {
  return (
    <main>
      <h1>leadcapture-form fixture</h1>
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={{ desktop: "TEST-TOKEN" }}
        usageContext="modal"
        isModalOpen={false}
      />
    </main>
  );
}
