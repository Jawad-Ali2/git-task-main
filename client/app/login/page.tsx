import { LoginForm } from "@/components/login-form"
import Image from 'next/image';

export default function LoginPagee() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
            GitTask
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/login-bg.jpg"
          alt="Image of grass with a zigzag pattern"
          className="absolute inset-0 h-full w-full grayscale object-cover dark:brightness-[0.2]"
        />
      </div>
    </div>
  )
}
