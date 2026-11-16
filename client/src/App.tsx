import { ToastProvider } from './components/ui/Toaster';
import { usePathname } from './lib/router';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';

const ROOM_PATH = /^\/r\/([^/]+)\/?$/;

/** Two routes: "/" and "/r/:code". Anything else shows the home page. */
export function App() {
  const pathname = usePathname();
  const match = ROOM_PATH.exec(pathname);
  return <ToastProvider>{match ? <RoomPage rawCode={safeDecode(match[1]!)} /> : <HomePage />}</ToastProvider>;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
