import Link from 'next/link';
import { ArrowRight, Github, Sparkles, TrendingUp, Zap, Users, BarChart, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LandingHeader from '@/components/landing/header';
import LandingFooter from '@/components/landing/footer';
import { Squares } from '@/components/landing';

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <LandingHeader />

      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Squares
            speed={0.3}
            squareSize={40}
            direction='up'
            borderColor='#fff'
            hoverFillColor='#48C351'
          />
        </div>
        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 glass-hover">
            <Sparkles className="w-4 h-4 mr-2" />
            Transform your codebase TODOs into insights
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 pb-3">
            Transform TODOs into
            <br />
            Actionable Intelligence
          </h1>
          <p className="text-xl text-foreground max-w-2xl mx-auto mb-10">
            Automatically extract, track, and analyze TODO comments from your GitHub repositories.
            Get AI-powered insights and never let technical debt slip through the cracks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button
                size="default"
                className="text-lg px-8 h-12 glow-primary"
              >
                <Github className="mr-2 h-5 w-5" />
                Get Started with GitHub
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            {/* TODO: Can add later */}
            {/* <Button size="lg" variant="outline" className="text-lg px-8 h-14">
              View Demo
            </Button> */}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[minmax(200px,auto)]">

            {/* Large Feature - Automated Scanning */}
            <Card className="md:col-span-6 lg:col-span-7 lg:row-span-2 rounded-2xl p-8 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="relative z-10">
                <h3 className="text-3xl font-bold mb-4">Automated Repository Scanning</h3>
                <p className="text-lg text-foreground mb-8 max-w-md">
                  Connect your GitHub repositories and let AI automatically discover and categorize every TODO, FIXME, and HACK comment in seconds.
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/5 rounded-tl-[100px] group-hover:scale-110 transition-transform duration-500">
                <div className="absolute inset-8 rounded-tl-[80px] border-2 border-primary/20 flex items-center justify-center">
                  <div className="space-y-3 w-full px-8">
                    <div className="h-3 bg-primary/30 rounded-full w-3/4 group-hover:w-full transition-all duration-500"></div>
                    <div className="h-3 bg-primary/20 rounded-full w-full"></div>
                    <div className="h-3 bg-primary/30 rounded-full w-2/3 group-hover:w-5/6 transition-all duration-500"></div>
                    <div className="h-3 bg-primary/20 rounded-full w-4/5 group-hover:w-full transition-all duration-500"></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Medium Feature - AI Insights */}
            <Card className="md:col-span-3 lg:col-span-5 bg-white rounded-2xl p-8 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3">AI-Powered Insights</h3>
                <p className="text-foreground mb-4">
                  Get intelligent summaries and smart prioritization for every task discovered in your codebase.
                </p>
                <div className="mt-6 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-700"></div>
                    <span>Smart categorization</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-700"></div>
                    <span>Priority scoring</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-700"></div>
                    <span>Context awareness</span>
                  </div>
                </div>
              </div>

              {/* Neural network visualization - bottom right corner */}
              <div className="absolute bottom-4 right-4 w-24 h-24">
                <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-green-500"></div>
                <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-green-600"></div>
                <div className="absolute bottom-4 left-6 w-2 h-2 rounded-full bg-green-500"></div>
                <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-green-700"></div>
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <line x1="20%" y1="20%" x2="70%" y2="40%" stroke="rgb(1, 102, 48)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                  <line x1="20%" y1="20%" x2="40%" y2="70%" stroke="rgb(1, 102, 48)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                  <line x1="70%" y1="40%" x2="80%" y2="80%" stroke="rgb(1, 102, 48)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                  <line x1="40%" y1="70%" x2="80%" y2="80%" stroke="rgb(1, 102, 48)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                </svg>
              </div>
            </Card>

            {/* Medium Feature - Analytics */}
            <Card className="md:col-span-3 lg:col-span-5 rounded-2xl p-8 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3">Advanced Analytics</h3>
                <p className="text-foreground mb-6">
                  Track technical debt trends, resolution times, and team productivity with beautiful dashboards.
                </p>
                <div className="flex gap-2 items-end h-24">
                  <div className="flex-1 bg-green-500/20 rounded-t-lg h-3/4 group-hover:h-full transition-all duration-300"></div>
                  <div className="flex-1 bg-green-500/30 rounded-t-lg h-2/3 group-hover:h-5/6 transition-all duration-300"></div>
                  <div className="flex-1 bg-green-500/40 rounded-t-lg h-full"></div>
                  <div className="flex-1 bg-green-500/30 rounded-t-lg h-1/2 group-hover:h-4/5 transition-all duration-300"></div>
                  <div className="flex-1 bg-green-500/20 rounded-t-lg h-2/5 group-hover:h-3/5 transition-all duration-300"></div>
                </div>
              </div>
            </Card>

            {/* Small Feature - GitHub Integration */}
            <Card className="md:col-span-2 lg:col-span-4 bg-white rounded-2xl p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">GitHub Native</h3>
                <p className="text-sm text-foreground">
                  Seamlessly integrates with your existing workflow
                </p>
              </div>

              {/* Git branch visualization - bottom right corner */}
              <div className="absolute bottom-2 right-2 w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Top left node */}
                  <circle cx="20" cy="20" r="8" fill="rgb(1, 150, 48)" />
                  {/* Top right node */}
                  <circle cx="80" cy="20" r="8" fill="rgb(1, 150, 48)" />
                  {/* Bottom node */}
                  <circle cx="20" cy="80" r="8" fill="rgb(1, 150, 48)" />

                  {/* Vertical line from top left to middle */}
                  <line x1="20" y1="28" x2="20" y2="50" stroke="rgb(1, 150, 48)" strokeWidth="3" />
                  {/* Branch line from top right to middle */}
                  <path d="M 80 28 C 80 50, 40 50, 20 50" stroke="rgb(1, 150, 48)" strokeWidth="3" fill="none" />
                  {/* Vertical line from middle to bottom */}
                  <line x1="20" y1="50" x2="20" y2="72" stroke="rgb(1, 150, 48)" strokeWidth="3" />
                </svg>
              </div>
            </Card>

            {/* Small Feature - Team Collaboration */}
            <Card className="md:col-span-2 lg:col-span-4 bg-white rounded-2xl p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Team Sync</h3>
                <p className="text-sm text-foreground">
                  Collaborate and assign tasks across your entire team
                </p>
              </div>

              {/* Three connected users visualization - centered */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-end justify-center">
                {/* User 1 - Left (smaller) */}
                <div className="flex flex-col items-center group-hover:scale-110 transition-transform">
                  <div className="w-5 h-5 rounded-full bg-gray-300 mb-1"></div>
                  <div className="w-8 h-6 bg-green-500/30 rounded-t-full"></div>
                </div>

                {/* User 2 - Center (larger) */}
                <div className="flex flex-col items-center group-hover:scale-110 transition-transform delay-75 z-10">
                  <div className="w-6 h-6 rounded-full bg-gray-300 mb-1"></div>
                  <div className="w-10 h-8 bg-green-400 rounded-t-full"></div>
                </div>

                {/* User 3 - Right (smaller) */}
                <div className="flex flex-col items-center group-hover:scale-110 transition-transform delay-150">
                  <div className="w-5 h-5 rounded-full bg-gray-300 mb-1"></div>
                  <div className="w-8 h-6 bg-green-500/20 rounded-t-full"></div>
                </div>
              </div>
            </Card>

            {/* Small Feature - Real-time Updates */}
            <Card className="md:col-span-2 lg:col-span-4 rounded-2xl p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              {/* Pulse wave visualization */}
              <div className="absolute bottom-4 right-0 w-full h-20 ">
                <svg viewBox="0 0 200 50" className="w-full h-full" preserveAspectRatio="none">
                  <polyline
                    points="0,25 20,25 25,5 30,45 35,15 40,35 45,25 200,25"
                    fill="none"
                    strokeWidth="2"
                    className="group-hover:stroke-green-800 transition-all duration-300 stroke-gray-300"
                  />
                </svg>
              </div>

              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Real-time Tracking</h3>
                <p className="text-sm text-foreground">
                  Monitor progress and debt reduction in real-time
                </p>
              </div>
            </Card>

          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to take control of your technical debt?</h2>
          <p className="text-xl text-foreground mb-8">
            Join thousands of developers who are transforming how they manage code quality.
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className="text-lg px-8 h-12 glow-primary"
            >
              <Github className="mr-2 h-5 w-5" />
              Start with Github
            </Button>
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
