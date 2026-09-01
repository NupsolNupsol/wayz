import type { ReactNode } from 'react'
import { Boxes, GitBranch, Hash, Layers, Lock, Package, Plug, ShieldCheck, TestTube, TriangleAlert, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, Badge } from '@/components/ui'
import { useWorkflows } from '@/hooks'
import { APP } from '@/config/appConfig'
import type { EngineWorkflow } from '@/api/types'

export function ArchitecturePage() {
  const { data: workflows = [] } = useWorkflows()

  return (
    <div data-testid="architecture-page">
      <PageHeader
        title="Technical documentation"
        subtitle={`How ${APP.name} is built: the engine, its decoupling, and the services behind each rule`}
        crumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Help' }, { label: 'Architecture' }]}
      />

      <div className="flex flex-col gap-5">
        <Doc icon={<Layers size={20} />} title="1 · Layering" testId="arch-layers">
          <P>
            Two independent applications talking only over HTTP. Each layer knows the one below it and nothing above.
          </P>
          <Pre>{`Browser (React)
  features/*  ──▶ hooks/queries.ts (TanStack Query) ──▶ api/*.api.ts (axios) ──┐
                                                                              │ /api
Backend (Express)                                                             ▼
  routes/*  ─▶  controllers/*  ─▶  services/*  ─▶  domain/*  ─▶  models/*
  (mw+wire)     (zod + shape)      (use-cases)     (pure rules)   (Mongoose)`}</Pre>
          <Bullets
            items={[
              ['routes', 'thin — attach middleware, point at a controller'],
              ['controllers', 'validate the request with zod, call one service, shape the response'],
              ['services', 'use-cases and orchestration; the only layer that touches several models'],
              ['domain', 'pure rules — no Express, no Mongo, unit-testable in isolation'],
              ['models', 'persistence only'],
            ]}
          />
          <Note>
            The frontend mirrors this: axios exists only inside <Code>src/api/</Code>. Components never import it,
            so the transport can change without touching a screen.
          </Note>
        </Doc>

        <Doc icon={<Package size={20} />} title="2 · @wayz/workflow — an independent package" testId="arch-package">
          <P>
            The workflow engine is <strong>not part of the backend</strong>. It is a separate package beside it, built
            on its own and consumed from <Code>dist/</Code> — the same arrangement as the chargeback platform.
          </P>
          <Pre>{`lockerflow-platform/
  workflow/                              ← independent package, built with tsc
    shared/          access.ts  status.ts  types.ts      (centralised)
    bookingWorkflowValidators/    controller.<engine>.validator.controller.ts
    bookingWorkflowOperations/    controller.<engine>.operation.controller.ts
    workflow/        booking.<engine>.workflow.ts
                     booking.engines.workflow.ts   (registry)
                     workflow.validators.ts        (registry)
                     workflow.operators.ts         (registry)
  backend/           imports ../workflow/dist
  frontend/`}</Pre>
          <Bullets
            items={[
              ['validators = guards', 'one controller PER ENGINE, a switch on the transition code. Return string[] of errors; all violations reported at once (422).'],
              ['operators = effects', 'one controller PER ENGINE. Return a NEW booking snapshot plus declarative asset intents.'],
              ['shared.validators / shared.operations', 'building blocks reused across engines — a check that applies to every asset type lives once.'],
              ['registries', 'engine → workflow / validator / operator. Nothing switches on engine anywhere else.'],
            ]}
          />
          <Note>
            <strong>The package is pure.</strong> It cannot touch Mongo, Express or the backend: a validator receives a
            plain booking snapshot, an operator returns a transformed one. Asset changes are <em>declared</em> as
            intents and applied by the host afterwards, so a rejected transition leaves the estate untouched.
          </Note>
          <P>
            That purity is the point: a tenant can add <Code>booking.&lt;engine&gt;.workflow.ts</Code> with a matching
            validator and operator, register it in three lines, rebuild the package — and the backend runs it without
            a single change.
          </P>
        </Doc>

        <Doc icon={<Workflow size={20} />} title="3 · A workflow is DATA" testId="arch-engine">
          <P>
            Business lifecycles are not <Code>if</Code> statements scattered through services. Each engine exports one
            declarative <Code>EngineWorkflow</Code>; the host interprets it and hard-codes nothing.
          </P>
          <Pre>{`export const shopDropWorkflow: EngineWorkflow = {
  engineKind: 'SHOP_AND_DROP',
  assetKind:  'COMPARTMENT',        ← which physical kind this governs
  transitions: [
    { code:'TO_STORED', label:'Confirm storage (start timer)',
      source:[RESERVED], target: ACTIVE, actors: OPS },
    ...
  ],
}

export const LaunchShopDropControl   = (code, ctx) => useShopDropValidator(code, ctx)
export const LaunchShopDropOperation = (code, ctx) => useShopDropOperation(code, ctx)`}</Pre>
          <P>
            Dispatch is keyed on the engine, which <strong>is</strong> the kind of asset being handled —
            <Code>COMPARTMENT</Code> → Shop &amp; Drop, <Code>VEHICLE</Code> → Mobility, and so on. Both lookups exist
            (<Code>getWorkflow</Code>, <Code>getWorkflowByAssetKind</Code>) and a startup assertion keeps them from
            drifting apart.
          </P>
          <Note>
            The validator/operator split is what makes single-use controls possible: the validator checks a fresh
            identity proof exists, and the separate operator <em>burns</em> it — so re-running a transition cannot
            silently reuse the same authorisation.
          </Note>
        </Doc>

        <Doc icon={<GitBranch size={20} />} title="4 · Live engine catalogue" testId="arch-catalogue">
          <P>
            Read from <Code>GET /api/engines/workflows</Code> at page load — this is the machine actually running, not
            a diagram of one.
          </P>
          <div className="flex flex-col gap-3 mt-2">
            {workflows.map((wf: EngineWorkflow) => (
              <div key={wf.engineKind} className="lf-card p-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-semibold text-navy dark:text-dk-texthi">{wf.engineKind}</span>
                  <Badge tone="info">{wf.sessionKind}</Badge>
                  <Badge tone="neutral">initial: {wf.initialStatus}</Badge>
                  <Badge tone="neutral">{wf.transitions.length} transitions</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wf.transitions.map((t: EngineWorkflow['transitions'][number]) => (
                    <span
                      key={t.code}
                      title={`${t.source.join(' | ')} → ${t.target}`}
                      className="lf-chip bg-canvas dark:bg-dk-elevated text-[11px] font-mono"
                    >
                      {t.source.join('|')} → {t.target}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Note>
            Adding an engine: add the kind to <Code>ENGINE_KINDS</Code>, write one workflow file, register it, seed its
            products. Routes, RBAC, availability, persistence and this page all consume it unchanged — Open/Closed.
          </Note>
        </Doc>

        <Doc icon={<Hash size={20} />} title="5 · Identifiers" testId="arch-ids">
          <P>
            Meaningful entities carry a sequential id from the <Code>counters</Code> collection —
            <Code>bk-0042</Code>, <Code>ord-0042</Code>, <Code>inc-0042</Code> — so a customer complaining about a
            booking can be looked up by typing it. The same number backs the human reference, making
            <Code>bk-0042</Code> and <Code>SD-0042</Code> obviously one booking.
          </P>
          <Bullets
            items={[
              ['Atomic', 'findOneAndUpdate($inc, upsert) — one round trip, safe under concurrency, never "read the last row and add one".'],
              ['Per tenant', 'each tenant starts at 0001 and cannot infer another tenant’s volume from an id.'],
              ['Replaces nextRef()', 'an in-process variable seeded at 100010 that restarted on every deploy, silently colliding with existing refs.'],
            ]}
          />
          <Note>
            Sequential ids are enumerable, so the <strong>public</strong> tracking page does not use them: every
            booking also carries a random <Code>trackingToken</Code>, and <Code>/track/:token</Code> accepts nothing
            else. Readable ids for staff, capability tokens for customers.
          </Note>
        </Doc>

        <Doc icon={<Plug size={20} />} title="6 · Ports keep the domain clean" testId="arch-ports">
          <P>
            The engine mutates shared physical units only through the <Code>AssetOps</Code> interface, so it has no
            knowledge of Mongo. The same idea repeats wherever the domain meets the outside world:
          </P>
          <Bullets
            items={[
              ['AssetOps', 'read/write AssetUnits — swapped for a stub in guard unit tests'],
              ['whatsapp.service', 'Vonage transport; isConfigured() + a send that never throws'],
              ['email.service', 'SMTP transport with automatic primary → fallback host'],
              ['otp.service', 'code LIFECYCLE only (generate/store/verify); delivery is delegated to a transport'],
            ]}
          />
          <Note>
            Because <Code>otp.service</Code> keys codes by <em>destination</em>, WhatsApp and email work side by side:
            a code mailed to an address cannot be redeemed against a phone number.
          </Note>
        </Doc>

        <Doc icon={<Boxes size={20} />} title="7 · Domain modules — the rules, isolated and pure" testId="arch-domain">
          <Bullets
            items={[
              ['domain/packing.ts', 'first-fit-decreasing bin packing. Capacity ≠ pricing: several bags may share a compartment, one order may need several.'],
              ['domain/overtime.ts', 'grace period + whole-hour penalty blocks. One function; the DTO, the tracking page, the sweeper and the completion charge all read it.'],
              ['domain/incidents.ts', 'per-engine incident catalogue, so a scooter is never offered "missing bag".'],
              ['domain/engine/*', 'the state machine: guards, effects, registry, executor.'],
            ]}
          />
          <Note>
            These are plain functions with no I/O. That is why the overtime timeline can be probed minute by minute in
            tests without waiting in real time.
          </Note>
        </Doc>

        <Doc icon={<ShieldCheck size={20} />} title="8 · Controls, and the problem each one solves" testId="arch-controls">
          <Table
            rows={[
              ['Payment never starts billing', 'A customer must not be charged for time before their property is actually in a locker.', 'startTimer() runs only in fulfilment transitions — never in payBooking().'],
              ['Physical scan-in', 'An agent could otherwise start the clock without the bags going in.', 'Three guards on TO_STORED: compartment must match the reservation, unit must still be held, scans must be an EXACT set match (no missing, foreign or duplicate).'],
              ['Identity before custody release', 'Anyone could collect someone else’s luggage.', 'identityVerified() gates TO_RETRIEVAL; the proof is consumed on use and expires in 30 min.'],
              ['Channel fallbacks', 'A provider outage must not stop the counter — but must not weaken the check either.', 'WhatsApp → Email → ID document (reason + photo) → supervisor step-up. Every fallback is audited.'],
              ['Overtime fairness', 'Charging someone for being 90 seconds late is bad service; letting an hour slide is lost revenue.', '5-minute free grace, then whole-hour blocks, computed server-side only.'],
              ['Tenant isolation', 'One station must never read another’s data.', 'Every query is scoped by tenantId + stationId from the JWT.'],
            ]}
          />
        </Doc>

        <Doc icon={<Lock size={20} />} title="9 · Security posture" testId="arch-security">
          <Bullets
            items={[
              ['One public surface', 'routes/public.route.ts is the only unauthenticated router. Its payload is an ALLOW-LIST projection — a new Booking field cannot leak by default.'],
              ['Capability links', 'A tracking id is bk_ + 10 nanoid chars, rate limited to 120/min per IP. Barcodes are never published — they are the claim token at scan-out.'],
              ['PII isolation', 'ID-document images live in their own collection, not in the aggregate that every transition loads. Only the last 4 digits of a document number are kept; each view of an image is audited.'],
              ['Step-up auth', 'A supervisor override authenticates the supervisor without replacing the agent’s session, and is attributed to the supervisor.'],
              ['No code leakage', 'Once a provider is configured, a failed send returns FAILED. A code shown to the agent proves nothing about the customer.'],
            ]}
          />
        </Doc>

        <Doc icon={<TestTube size={20} />} title="10 · Testing strategy" testId="arch-testing">
          <Bullets
            items={[
              ['API level (Playwright + in-memory Mongo)', 'the full lifecycle, RBAC, tenant isolation, the guard matrix, the public projection. No Docker required.'],
              ['Domain level', 'guards called directly with a stubbed AssetOps to cover concurrency branches a sequential HTTP test cannot stage; the overtime timeline probed minute by minute.'],
              ['Browser level', 'against the live Docker stack — the real wizard, the scan gate, the verification modal, the public tracking page.'],
            ]}
          />
          <Note>
            Browser specs release the compartments they take (<Code>releaseStoredBooking</Code>): the Docker database
            persists between runs and the seeded pools are finite.
          </Note>
        </Doc>

        <Doc icon={<TriangleAlert size={20} />} title="11 · Known limitations" testId="arch-limits">
          <Bullets
            items={[
              ['No multi-document transactions', 'Single Mongo node: a transition writes the Booking then the AssetUnit sequentially. Guards narrow the race; a replica set would close it.'],
              ['Online only', 'No service worker or outbox. The connectivity toggle demonstrates the blocking warning required by the spec.'],
              ['Overtime is billed, not collected', 'Completion raises a charge line and returns the order to awaiting payment; there is no card terminal integration.'],
              ['In-memory rate limiting and OTP store', 'Per process. A multi-instance deployment needs Redis for both.'],
              ['Non-Shop&Drop workflows are assumed', 'Mobility, Lagoon, COTE and Ana’am are reasonable placeholders — swap the single workflow file when the confirmed ones arrive.'],
            ]}
          />
        </Doc>
      </div>
    </div>
  )
}

function Doc({ icon, title, testId, children }: { icon: ReactNode; title: string; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">{icon}</div>
        <SectionTitle>{title}</SectionTitle>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  )
}

const P = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted leading-relaxed">{children}</p>

const Code = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-[12px] bg-canvas dark:bg-dk-elevated px-1.5 py-0.5 rounded text-navy dark:text-dk-text">{children}</code>
)

const Pre = ({ children }: { children: ReactNode }) => (
  <pre className="text-[11.5px] leading-relaxed font-mono bg-canvas dark:bg-dk-elevated rounded-xl p-3 overflow-x-auto text-navy dark:text-dk-text">
    {children}
  </pre>
)

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-navy dark:text-dk-text border-l-2 border-brand pl-3 py-0.5">{children}</p>
)

function Bullets({ items }: { items: [string, string][] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(([term, detail]) => (
        <li key={term} className="text-sm">
          <span className="font-mono text-[12px] font-semibold text-navy dark:text-dk-texthi">{term}</span>
          <span className="text-muted"> — {detail}</span>
        </li>
      ))}
    </ul>
  )
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="pb-2 pr-3 font-bold">Control</th>
            <th className="pb-2 pr-3 font-bold">Problem it targets</th>
            <th className="pb-2 font-bold">How it is enforced</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([control, problem, how]) => (
            <tr key={control} className="border-t border-line align-top">
              <td className="py-2.5 pr-3 font-semibold text-navy dark:text-dk-texthi">{control}</td>
              <td className="py-2.5 pr-3 text-muted">{problem}</td>
              <td className="py-2.5 text-muted">{how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
