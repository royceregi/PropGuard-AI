import { Icons } from "@/components/icons";

type Icon = (typeof Icons)[keyof typeof Icons];

const PROBLEMS: { icon: Icon; title: string; text: string }[] = [
  {
    icon: Icons.Description,
    title: "Forged or edited deeds",
    text: "A paper or PDF deed can be altered, and it is hard to tell by looking at it."
  },
  {
    icon: Icons.GppBad,
    title: "Sellers who don't own the land",
    text: "Some sales are made by people who are not the registered owner."
  },
  {
    icon: Icons.TrendingUp,
    title: "Suspicious deals",
    text: "Unusual prices or quick resales can hide fraud or money laundering."
  }
];

const STEPS: { icon: Icon; title: string; text: string }[] = [
  {
    icon: Icons.ReceiptLong,
    title: "A sale is registered",
    text: "The Land Registry records the property, the owners and the documents."
  },
  {
    icon: Icons.ViewInAr,
    title: "A fingerprint goes on the blockchain",
    text: "We store a unique digital fingerprint of the record. If anyone changes the record later, the fingerprint no longer matches."
  },
  {
    icon: Icons.SmartToy,
    title: "AI agents check the deal",
    text: "Four AI agents look up the record, compare it with the blockchain and look for warning signs."
  },
  {
    icon: Icons.Assessment,
    title: "You get a clear report",
    text: "A simple verdict, a risk level and the reasons behind it, so you can decide with confidence."
  }
];

const AGENTS: { icon: Icon; name: string; text: string }[] = [
  {
    icon: Icons.FindInPage,
    name: "Evidence Retrieval",
    text: "Collects the land record, its documents and the matching blockchain entry."
  },
  {
    icon: Icons.QueryStats,
    name: "Transaction Analysis",
    text: "Checks the seller really owned the property and that documents were not changed."
  },
  {
    icon: Icons.GppMaybe,
    name: "Risk Detection",
    text: "Gives the deal a risk score and flags anything unusual, like an odd price."
  },
  {
    icon: Icons.Description,
    name: "Report Writer",
    text: "Turns the findings into a short report anyone can read, with a recommendation."
  }
];

const AUDIENCES: { icon: Icon; title: string; points: string[] }[] = [
  {
    icon: Icons.HowToReg,
    title: "Property owners and buyers",
    points: [
      "See and verify the properties you own",
      "Check a property a seller shares with you",
      "Ask questions in plain language"
    ]
  },
  {
    icon: Icons.Business,
    title: "Banks, agents and companies",
    points: [
      "Verify deals before lending or closing",
      "Request risk assessments",
      "Keep an audit-ready trail"
    ]
  },
  {
    icon: Icons.Gavel,
    title: "Land Registry",
    points: [
      "Review and approve risk assessments",
      "Spot fraud patterns across all sales",
      "Prove records were never tampered with"
    ]
  }
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is a blockchain, in simple terms?",
    a: "A shared record book that can only be added to, never secretly edited. We store a fingerprint of each land record there, so any later change is easy to detect."
  },
  {
    q: "Does the AI change official records?",
    a: "No. The AI only reads and checks. Official records are owned by the Land Registry and are never changed by PropGuard AI."
  },
  {
    q: "Can other people see my property?",
    a: "No. You only see properties you own, used to own, took part in a sale for, or that an owner chose to share with you."
  },
  {
    q: "How do I ask a question?",
    a: "Open the AI Assistant and type a question such as \u201cIs transaction 1-361-2021-1 risky?\u201d. You get a short answer with a link to the full evidence."
  }
];

function SectionHeading({
  eyebrow,
  title,
  text
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
        {title}
      </h2>
      {text && (
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          {text}
        </p>
      )}
    </div>
  );
}

export function LandingSections() {
  return (
    <>
      <section className="bg-surface-canvas py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="The problem"
            title="Property fraud is hard to spot"
            text="Buying land is often the biggest purchase of a lifetime, yet checking that a deal is genuine still depends on paperwork that can be faked."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-text-primary">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-4 bg-surface py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="How it works"
            title="Four simple steps"
            text="You don't need to understand blockchain or AI. Here is what happens behind the scenes."
          />
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                className="relative rounded-2xl border border-border bg-surface-canvas p-6"
              >
                <span className="absolute top-5 right-5 font-mono text-xs text-text-muted">
                  0{index + 1}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-text-primary">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="ai-agents"
        className="scroll-mt-4 bg-surface-canvas py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="AI agents"
            title="A team of four AI assistants"
            text="Each agent does one job and passes its findings to the next, like a team of specialists working on your case."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map(({ icon: Icon, name, text }, index) => (
              <div
                key={name}
                className="relative rounded-2xl border border-border bg-surface p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary-dark">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-xs font-medium text-text-muted">
                  Agent {index + 1}
                </p>
                <h3 className="font-semibold text-text-primary">{name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {text}
                </p>
                {index < AGENTS.length - 1 && (
                  <Icons.ArrowForward className="absolute top-1/2 -right-4 hidden h-5 w-5 -translate-y-1/2 text-text-muted lg:block" />
                )}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-10 flex max-w-3xl items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <Icons.AutoAwesome className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-text-secondary">
              <span className="font-semibold text-text-primary">Just ask.</span>{" "}
              The AI Assistant answers everyday questions about your properties
              in plain language. When you ask whether a deal is risky, it calls
              all four agents and links you to the full report.
            </p>
          </div>
        </div>
      </section>

      <section
        id="who-its-for"
        className="scroll-mt-4 bg-surface py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Who it's for"
            title="Built for everyone in a property deal"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, points }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-surface-canvas p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-text-primary">
                  {title}
                </h3>
                <ul className="mt-3 space-y-2">
                  {points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2 text-sm text-text-secondary"
                    >
                      <Icons.Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-4 bg-surface-canvas py-20 sm:py-24"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Common questions" />
          <div className="mt-10 space-y-3">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-border bg-surface p-5 open:shadow-xs"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-text-primary">
                  {q}
                  <Icons.KeyboardArrowDown className="h-5 w-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
