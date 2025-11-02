import Link from 'next/link';
import { ArrowRight, Github, Sparkles, TrendingUp, Zap, Users, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Squares from '@/components/squares-bg';

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="fixed top-0 w-full glass z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
            <span className="font-bold text-xl">GitTask</span>
          </div>
          <Link href="/login">
            <Button variant="default" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

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
                size="lg"
                className="text-lg px-8 h-14 glow-primary"
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

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Automated Extraction',
                description: 'Automatically scan your repositories and extract TODO, FIXME, and other comment markers in real-time.',
              },
              {
                icon: Sparkles,
                title: 'AI-Powered Insights',
                description: 'Get intelligent summaries and prioritization suggestions powered by advanced AI analysis.',
              },
              {
                icon: TrendingUp,
                title: 'Technical Debt Tracking',
                description: 'Visualize trends, track resolution times, and measure your technical debt over time.',
              },
              {
                icon: Github,
                title: 'GitHub Integration',
                description: 'Seamlessly integrates with your GitHub workflow. Track TODOs across all your repositories.',
              },
              {
                icon: Users,
                title: 'Team Collaboration',
                description: 'Assign tasks, track progress, and keep your entire team aligned on technical debt.',
              },
              {
                icon: BarChart,
                title: 'Advanced Analytics',
                description: 'Comprehensive dashboards showing task distribution, resolution trends, and team productivity.',
              },
            ].map((feature, index) => (
              <Card key={index} className="glass glass-hover shadow-none border-none">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
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
              className="text-lg px-8 h-14 glow-primary"
            >
              <Github className="mr-2 h-5 w-5" />
              Start with Github
            </Button>
          </Link>
        </div>
      </section>

      {/* <footer className="py-12 px-4 border-t border-border"> */}
      <footer className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Image src="/logo.png" alt="GitTask Logo" width={20} height={20} />
              <span className="font-bold text-lg">GitTask</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 GitTask. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
