import { Brand } from "@/components/Brand";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 text-center">
          <Mascot size={140} className="mx-auto" />
          <h1 className="mt-2 font-display text-[1.6rem] font-bold text-brand-ink">
            This page went missing
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[0.9rem] leading-relaxed text-muted-foreground">
            The link may have moved, or it never existed. Head back to your dashboard
            and pick up where you left off.
          </p>
          <Button asChild className="mt-6 h-11 px-6">
            <Link to="/dashboard">Back to home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
