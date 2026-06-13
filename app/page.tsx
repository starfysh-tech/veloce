// app/page.tsx — root redirect. Auth state decides destination via the
// app-group layout; sending everyone to /rfqs lets that layout gate.
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/rfqs');
}
