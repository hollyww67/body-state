import RoomContent from "./RoomContent";
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Онлайн-консультация', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function RoomPage() {
  return <RoomContent />;
}
