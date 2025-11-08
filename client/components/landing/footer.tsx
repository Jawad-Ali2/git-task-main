import Link from 'next/link';
import Image from 'next/image';

export default function LandingFooter() {
  return (
    <footer className="py-8 md:py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
            <span className="font-bold text-base md:text-lg">GitTask</span>
          </Link>
          <p className="text-xs md:text-sm text-muted-foreground text-center">
            © 2025 GitTask. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
