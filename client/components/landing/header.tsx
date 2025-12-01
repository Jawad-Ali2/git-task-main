import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function LandingHeader() {
  return (
    <header className="fixed top-0 w-full z-50 bg-background border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
          <span className="font-bold text-xl">GitTask</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing">
            Pricing
          </Link>
          <Link href="/login">
            <Button variant="default" size="sm">Sign In</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
