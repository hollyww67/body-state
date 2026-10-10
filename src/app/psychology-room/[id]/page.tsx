import { redirect } from 'next/navigation';
export default async function LegacyRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect('/psychology/room?id='+encodeURIComponent(id));
}
