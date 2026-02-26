import Link from 'next/link';
import { ArrowRight, Github, Sparkles, Zap, Shield, Clock, Users, Code2, GitBranch, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import LandingHeader from '@/components/landing/header';
import LandingFooter from '@/components/landing/footer';
import { Squares } from '@/components/landing';

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <LandingHeader />

      {/* Hero Section */}
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
        
        {/* Gradient orbs for visual interest */}
        {/* <div className="absolute top-20 left-1/4 w-72 h-72 bg-green-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl animate-pulse delay-1000" /> */}
        
        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 glass-hover border border-primary/20">
            <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
            Transform your codebase TODOs into insights
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 pb-3">
            From Comment
            <br />
            <span className="text-green-600">
              To Clarity
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Automatically extract, track, and analyze TODO comments from your GitHub repositories.
            Get AI-powered insights and never let technical debt slip through the cracks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button
                size="lg"
                className="text-lg px-8 h-14 glow-primary group"
              >
                <Github className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                Get Started with GitHub
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
          
          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-600" />
              <span>99.9% Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <span>10,000+ Developers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y border-border bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '500K+', label: 'TODOs Tracked', icon: Code2 },
              { value: '10K+', label: 'Repositories', icon: GitBranch },
              { value: '98%', label: 'User Satisfaction', icon: CheckCircle },
              { value: '<2min', label: 'Avg Scan Time', icon: Clock },
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <stat.icon className="h-6 w-6 mx-auto mb-2 text-green-600 group-hover:scale-110 transition-transform" />
                <div className="text-3xl md:text-4xl font-bold mb-1 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to manage
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent"> technical debt</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to help teams stay on top of code quality
            </p>
          </div>
          
          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[minmax(200px,auto)]">

            {/* Large Feature - Automated Scanning */}
            <Card className="md:col-span-6 lg:col-span-7 lg:row-span-2 rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500 border-2 border-transparent hover:border-green-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/10 text-green-700 text-xs font-medium mb-4">
                  <Zap className="w-3 h-3 mr-1" />
                  Core Feature
                </div>
                <h3 className="text-3xl font-bold mb-4">Automated Repository Scanning</h3>
                <p className="text-lg text-muted-foreground mb-8 max-w-md">
                  Connect your GitHub repositories and let AI automatically discover and categorize every TODO, FIXME, and HACK comment in seconds.
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-[100px] group-hover:scale-110 transition-transform duration-500">
                <div className="absolute inset-8 rounded-tl-[80px] border-2 border-green-500/20 flex items-center justify-center">
                  <div className="space-y-3 w-full px-8">
                    <div className="h-3 bg-gray-500/30 rounded-full w-3/4 group-hover:w-full transition-all duration-500"></div>
                    <div className="h-3 bg-gray-500/20 rounded-full w-full"></div>
                    <div className="h-3 bg-gray-500/30 rounded-full w-2/3 group-hover:w-5/6 transition-all duration-500"></div>
                    <div className="h-3 bg-gray-500/20 rounded-full w-4/5 group-hover:w-full transition-all duration-500"></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Medium Feature - AI Insights */}
            <Card className="md:col-span-3 lg:col-span-5 bg-white rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500 border-2 border-transparent hover:border-green-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3">AI-Powered Insights</h3>
                <p className="text-muted-foreground mb-4">
                  Get intelligent summaries and smart prioritization for every task discovered in your codebase.
                </p>
                <div className="mt-6 space-y-2">
                  {['Smart categorization', 'Priority scoring', 'Context awareness'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm group/item">
                      <div className="w-2 h-2 rounded-full bg-green-600 group-hover/item:scale-125 transition-transform"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Neural network visualization */}
              <div className="absolute bottom-4 right-4 w-24 h-24 opacity-50 group-hover:opacity-100 transition-opacity">
                <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-green-600 animate-pulse delay-100"></div>
                <div className="absolute bottom-4 left-6 w-2 h-2 rounded-full bg-green-500 animate-pulse delay-200"></div>
                <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-green-700 animate-pulse delay-300"></div>
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <line x1="20%" y1="20%" x2="70%" y2="40%" stroke="rgb(34, 197, 94)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                  <line x1="20%" y1="20%" x2="40%" y2="70%" stroke="rgb(34, 197, 94)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                  <line x1="70%" y1="40%" x2="80%" y2="80%" stroke="rgb(34, 197, 94)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                  <line x1="40%" y1="70%" x2="80%" y2="80%" stroke="rgb(34, 197, 94)" strokeWidth="1" className="group-hover:stroke-2 transition-all" />
                </svg>
              </div>
            </Card>

            {/* Medium Feature - Analytics */}
            <Card className="md:col-span-3 lg:col-span-5 rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500 border-2 border-transparent hover:border-green-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3">Advanced Analytics</h3>
                <p className="text-muted-foreground mb-6">
                  Track technical debt trends, resolution times, and team productivity with beautiful dashboards.
                </p>
                <div className="flex gap-2 items-end h-24">
                  {[75, 66, 100, 50, 40].map((h, i) => (
                    <div 
                      key={i}
                      className="flex-1 bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg transition-all duration-500 group-hover:opacity-100 opacity-70"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </Card>

            {/* Small Feature - GitHub Integration */}
            <Card className="md:col-span-2 lg:col-span-4 bg-white rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500 border-2 border-transparent hover:border-green-500/20">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">GitHub Native</h3>
                <p className="text-sm text-muted-foreground">
                  Seamlessly integrates with your existing workflow
                </p>
              </div>

              {/* Git branch visualization */}
              <div className="absolute bottom-2 right-2 w-24 h-24 opacity-60 group-hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="20" cy="20" r="8" fill="rgb(34, 197, 94)" />
                  <circle cx="80" cy="20" r="8" fill="rgb(34, 197, 94)" />
                  <circle cx="20" cy="80" r="8" fill="rgb(34, 197, 94)" />
                  <line x1="20" y1="28" x2="20" y2="50" stroke="rgb(34, 197, 94)" strokeWidth="3" />
                  <path d="M 80 28 C 80 50, 40 50, 20 50" stroke="rgb(34, 197, 94)" strokeWidth="3" fill="none" />
                  <line x1="20" y1="50" x2="20" y2="72" stroke="rgb(34, 197, 94)" strokeWidth="3" />
                </svg>
              </div>
            </Card>

            {/* Small Feature - Team Collaboration */}
            <Card className="md:col-span-2 lg:col-span-4 bg-white rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500 border-2 border-transparent hover:border-green-500/20">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Team Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Collaborate and assign tasks across your entire team
                </p>
              </div>

              {/* Three connected users visualization */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-end justify-center gap-1">
                <div className="flex flex-col items-center group-hover:scale-110 transition-transform">
                  <div className="w-5 h-5 rounded-full bg-gray-300 mb-1"></div>
                  <div className="w-8 h-6 bg-green-500/30 rounded-t-full"></div>
                </div>
                <div className="flex flex-col items-center group-hover:scale-110 transition-transform delay-75 z-10">
                  <div className="w-6 h-6 rounded-full bg-gray-300 mb-1"></div>
                  <div className="w-10 h-8 bg-green-500 rounded-t-full"></div>
                </div>
                <div className="flex flex-col items-center group-hover:scale-110 transition-transform delay-150">
                  <div className="w-5 h-5 rounded-full bg-gray-300 mb-1"></div>
                  <div className="w-8 h-6 bg-green-500/20 rounded-t-full"></div>
                </div>
              </div>
            </Card>

            {/* Small Feature - Real-time Updates */}
            <Card className="md:col-span-2 lg:col-span-4 rounded-2xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-green-500/5 transition-all duration-500 border-2 border-transparent hover:border-green-500/20">
              {/* Pulse wave visualization */}
              <div className="absolute bottom-4 right-0 w-full h-20 opacity-50 group-hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 200 50" className="w-full h-full" preserveAspectRatio="none">
                  <polyline
                    points="0,25 20,25 25,5 30,45 35,15 40,35 45,25 200,25"
                    fill="none"
                    strokeWidth="2"
                    className="stroke-green-500 group-hover:stroke-green-600 transition-all duration-300"
                  />
                </svg>
              </div>

              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Real-time Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor progress and debt reduction in real-time
                </p>
              </div>
            </Card>

          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get started in <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">3 simple steps</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              From connection to insights in under 2 minutes
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Connect GitHub', desc: 'Authorize GitTask with your GitHub account in one click' },
              { step: '02', title: 'Select Repos', desc: 'Choose which repositories to scan for TODOs and tasks' },
              { step: '03', title: 'Get Insights', desc: 'View AI-powered summaries and start managing debt' },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="text-6xl font-bold text-green-500/10 absolute -top-4 -left-2 group-hover:text-green-500/20 transition-colors">
                  {item.step}
                </div>
                <div className="relative pt-8 pl-4">
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
                {i < 2 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-green-500/30 h-8 w-8" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-green-500/5" />
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <h2 className="text-4xl font-bold mb-6">Ready to take control of your technical debt?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of developers who are transforming how they manage code quality.
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className="text-lg px-8 h-14 glow-primary group"
            >
              <Github className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
              Start Free with GitHub
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Free for public repos
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
