export default function DashboardPage() {
  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-background aspect-video rounded-md border" />
        <div className="bg-background aspect-video rounded-md border" />
        <div className="bg-background aspect-video rounded-md border" />
      </div>
      <div className="bg-background min-h-screen flex-1 rounded-md border md:min-h-min" />
    </>
  );
}
