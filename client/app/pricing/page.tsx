"use client";

import Link from 'next/link';
import { Check, X, ArrowRight, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import LandingHeader from '@/components/landing/header';
import LandingFooter from '@/components/landing/footer';

export default function PricingPage() {
  const pricingPlans = [
    {
      name: 'Free',
      subtitle: 'Open Source Core',
      price: '$0',
      period: '/month',
      description: 'Perfect for personal use and open-source projects',
      features: [
        'Public repositories only',
        'Basic TODO/FIXME extraction',
        'Task dashboard with filters',
        'Basic AI summaries (10/month)',
        'Read-only JIRA & Trello integrations',
      ],
      cta: 'Get Started Free',
      ctaVariant: 'outline' as const,
      popular: false,
    },
    {
      name: 'Team Plan',
      subtitle: 'For Growing Teams',
      price: '$15',
      period: '/developer/month',
      description: 'Everything you need to manage team productivity',
      features: [
        'Everything in Free, plus:',
        'Private repositories',
        'Unlimited AI summaries',
        'Team collaboration tools',
        'Full JIRA, Trello, Linear integrations',
        'Productivity analytics dashboard',
        'Priority support',
      ],
      cta: 'Start Team Trial',
      ctaVariant: 'default' as const,
      popular: true,
    },
    {
      name: 'Enterprise Plan',
      subtitle: 'For Large Organizations',
      price: 'Custom',
      period: '',
      description: 'Advanced features with enterprise-grade security',
      features: [
        'Everything in Team, plus:',
        'Advanced security & compliance',
        'Dedicated account manager',
        'Custom API integrations',
        'SLA guarantees',
      ],
      cta: 'Contact Sales',
      ctaVariant: 'outline' as const,
      popular: false,
    },
  ];

  const comparisonFeatures = [
    { name: 'Public repos', free: true, team: true, enterprise: true },
    { name: 'Private repos', free: false, team: true, enterprise: true },
    { name: 'AI summaries/month', free: '10', team: 'Unlimited', enterprise: 'Unlimited' },
    { name: 'Team collaboration', free: false, team: true, enterprise: true },
    { name: 'JIRA, Trello, Linear', free: 'Read-only', team: 'Full', enterprise: 'Full' },
    { name: 'Security & compliance', free: false, team: false, enterprise: true },
    { name: 'Support', free: 'Community', team: 'Priority', enterprise: 'Dedicated' },
  ];

  const faqs = [
    {
      question: 'What counts as a "developer" for billing?',
      answer: 'A developer is anyone with write access to private repositories in your organization. Read-only users and external contributors to public repos don\'t count toward your billing.',
    },
    {
      question: 'Can I use GitTask for open-source projects?',
      answer: 'Absolutely! GitTask is completely free for public repositories. We believe in supporting the open-source community and want to help maintain code quality across all projects.',
    },
    {
      question: 'How does the AI summarization work?',
      answer: 'Our AI analyzes your TODO comments, commit history, and code context to generate intelligent summaries and prioritization suggestions. It helps identify critical technical debt and provides actionable insights.',
    },
    {
      question: 'What integrations are supported?',
      answer: 'We support JIRA, Trello and Linear for project management. Enterprise plans also include custom API integrations for your specific toolchain.',
    },
    // {
    //   question: 'Is my code or data safe?',
    //   answer: 'We take security seriously. We only read TODO comments and metadata—never your actual source code. All data is encrypted in transit and at rest. Enterprise plans include SOC 2 compliance and custom data retention policies.',
    // },
  ];

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <LandingHeader />

      {/* Hero Section */}
      <section className="pt-24 md:pt-44 pb-12 md:pb-16 px-4 md:px-6 relative overflow-hidden">
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-3 md:mb-4 px-2">
            Simple, Transparent Pricing for Every Team
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-6 md:mb-8 px-4">
            Start free. Upgrade as your team grows.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4">
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="text-base md:text-lg px-6 md:px-8 w-full sm:w-auto">
                <Github className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                Get Started Free
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-base md:text-lg px-6 md:px-8 w-full sm:w-auto"
              onClick={() => {
                document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Compare Plans
              <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 md:py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {pricingPlans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative flex flex-col ${
                  plan.popular 
                    ? 'border-primary shadow-lg md:scale-105' 
                    : 'border-none'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-primary text-primary-foreground px-3 md:px-4 py-1 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl md:text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-xs md:text-sm font-medium">
                    {plan.subtitle}
                  </CardDescription>
                  <div className="pt-3 md:pt-4">
                    <span className="text-3xl md:text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-xs md:text-sm ml-1 wrap-break-word">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground pt-1 md:pt-2">
                    {plan.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4 flex-1 flex flex-col">
                  <ul className="space-y-2 md:space-y-3 flex-1">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <Check className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs md:text-sm leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="block pt-2 md:pt-4 mt-auto">
                    <Button 
                      className="w-full text-sm md:text-base" 
                      size="lg"
                      variant={plan.ctaVariant}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section id="comparison" className="py-12 md:py-16 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8 md:mb-12 px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4">Feature Comparison</h2>
            <p className="text-base md:text-xl">
              Compare all features across our plans
            </p>
          </div>
          
          <div className="glass rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 md:py-4 px-3 md:px-6 font-semibold text-sm md:text-base sticky left-0 bg-background/95 backdrop-blur-sm z-10">Feature</th>
                    <th className="text-center py-3 md:py-4 px-2 md:px-6 font-semibold text-sm md:text-base min-w-20">Free</th>
                    <th className="text-center py-3 md:py-4 px-2 md:px-6 font-semibold text-sm md:text-base bg-primary/5 min-w-20">Team</th>
                    <th className="text-center py-3 md:py-4 px-2 md:px-6 font-semibold text-sm md:text-base min-w-[100px]">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="py-3 md:py-4 px-3 md:px-6 font-medium text-xs md:text-sm sticky left-0 bg-background/95 backdrop-blur-sm">{feature.name}</td>
                      <td className="py-3 md:py-4 px-2 md:px-6 text-center">
                        {typeof feature.free === 'boolean' ? (
                          feature.free ? (
                            <Check className="h-4 w-4 md:h-5 md:w-5 text-acc mx-auto" />
                          ) : (
                            <X className="h-4 w-4 md:h-5 md:w-5 text-red-900 mx-auto" />
                          )
                        ) : (
                          <span className="text-xs md:text-sm">{feature.free}</span>
                        )}
                      </td>
                      <td className="py-3 md:py-4 px-2 md:px-6 text-center bg-primary/5">
                        {typeof feature.team === 'boolean' ? (
                          feature.team ? (
                            <Check className="h-4 w-4 md:h-5 md:w-5 text-green-800 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 md:h-5 md:w-5 text-red-900 mx-auto" />
                          )
                        ) : (
                          <span className="text-xs md:text-sm font-medium">{feature.team}</span>
                        )}
                      </td>
                      <td className="py-3 md:py-4 px-2 md:px-6 text-center">
                        {typeof feature.enterprise === 'boolean' ? (
                          feature.enterprise ? (
                            <Check className="h-4 w-4 md:h-5 md:w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 md:h-5 md:w-5 text-red-900 mx-auto" />
                          )
                        ) : (
                          <span className="text-xs md:text-sm">{feature.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-8 md:mb-12 px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4">Frequently Asked Questions</h2>
            <p className="text-base md:text-xl text-muted-foreground">
              Everything you need to know about GitTask pricing
            </p>
          </div>

          <Accordion type="single" collapsible className="rounded-lg px-4 md:px-6">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base md:text-lg font-semibold py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 px-4">Ready to transform your workflow?</h2>
          <p className="text-base md:text-xl text-muted-foreground mb-6 md:mb-8 px-4">
            Join thousands of developers managing technical debt smarter with GitTask
          </p>
          <Link href="/login" className="inline-block w-full sm:w-auto px-4">
            <Button
              size="default"
              className="text-base md:text-lg px-6 md:px-8 h-12 glow-primary w-full sm:w-auto"
            >
              <Github className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
