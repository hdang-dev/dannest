import Link from "next/link";
import Avatar from "./Avatar";
import ThemeToggle from "./ThemeToggle";
import { currentUser } from "@/lib/mock";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
        >
          Dan<span className="text-teal-600 dark:text-teal-400">Nest</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Avatar name={currentUser.name} from={currentUser.from} to={currentUser.to} size={34} />
        </div>
      </div>
    </header>
  );
}
