import { useState, useMemo } from 'react'
import {
  CodeBracketIcon, KeyIcon, ArrowPathIcon, ShieldCheckIcon,
  CpuChipIcon, CameraIcon, DocumentTextIcon, ExclamationTriangleIcon,
  CheckCircleIcon, ClipboardDocumentIcon, MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'auth' | 'applications' | 'scoring' | 'face' | 'contracts' | 'errors'

interface SearchItem {
  tabId: TabId
  title: string
  text: string
  tag?: string
}

// ─── Searchable index ─────────────────────────────────────────────────────────

const SEARCH_INDEX: SearchItem[] = [
  // Overview
  { tabId: 'overview', title: 'Base URL', text: 'https://be.encode.uz/api/v1 base url host production' },
  { tabId: 'overview', title: 'Response envelope', text: 'paginated list items total page page_size total_pages json response format' },
  { tabId: 'overview', title: 'Integration flow', text: 'login jwt bearer token api endpoints flow steps' },
  { tabId: 'overview', title: 'Architecture overview', text: 'merchant mfo central bank portals roles architecture' },
  // Auth
  { tabId: 'auth', title: 'Login endpoint', text: 'POST /auth/login email password obtain token authentication', tag: 'POST /auth/login' },
  { tabId: 'auth', title: 'Token refresh', text: 'POST /auth/refresh refresh token extend session expire', tag: 'POST /auth/refresh' },
  { tabId: 'auth', title: 'Bearer token', text: 'authorization header bearer jwt token usage attach request' },
  { tabId: 'auth', title: 'Role enforcement', text: '403 forbidden role MERCHANT MFO_ADMIN CENTRAL_BANK guard' },
  // Applications
  { tabId: 'applications', title: 'Submit application', text: 'POST /applications/multi-product submit installment application client passport income', tag: 'POST /applications/multi-product' },
  { tabId: 'applications', title: 'List applications', text: 'GET /applications list filter pagination page', tag: 'GET /applications' },
  { tabId: 'applications', title: 'Get application', text: 'GET /applications/{id} retrieve single detail', tag: 'GET /applications/{id}' },
  { tabId: 'applications', title: 'Confirm application', text: 'POST /applications/{id}/confirm tariff months term lock contract', tag: 'POST /applications/{id}/confirm' },
  { tabId: 'applications', title: 'Decide application', text: 'PATCH /applications/{id}/decide approve reject mfo admin', tag: 'PATCH /applications/{id}/decide' },
  { tabId: 'applications', title: 'Fraud gate', text: 'fraud gate PASS FLAG BLOCK duplicate passport 24h suspicious' },
  // Scoring
  { tabId: 'scoring', title: 'Test scoring', text: 'POST /scoring/calculate test score preview income payment credit_history open_loans age', tag: 'POST /scoring/calculate' },
  { tabId: 'scoring', title: 'Affordability factor', text: 'F1 affordability DTI income payment weight 40%' },
  { tabId: 'scoring', title: 'Credit history factor', text: 'F2 credit history GOOD FAIR NONE BAD weight 30%' },
  { tabId: 'scoring', title: 'Behavioral factor', text: 'F3 behavioral open loans weight 20%' },
  { tabId: 'scoring', title: 'Demographic factor', text: 'F4 demographic age 25 45 55 65 weight 10%' },
  { tabId: 'scoring', title: 'Score outcomes', text: 'APPROVED PARTIAL REJECTED score threshold 50 70%' },
  { tabId: 'scoring', title: 'Hard reject rules', text: 'bankruptcy overdue_days max_open_loans hard_dti_min instant reject' },
  // Face
  { tabId: 'face', title: 'Face verify endpoint', text: 'POST /face_verify base64 image webcam capture identity', tag: 'POST /face_verify' },
  { tabId: 'face', title: 'Image format', text: 'jpeg png data uri base64 2mb size limit image encoding' },
  // Contracts
  { tabId: 'contracts', title: 'List contracts', text: 'GET /contracts list pagination', tag: 'GET /contracts' },
  { tabId: 'contracts', title: 'Payment schedule', text: 'GET /contracts/{id}/schedule installment amortization principal interest balance due_date', tag: 'GET /contracts/{id}/schedule' },
  { tabId: 'contracts', title: 'Download PDF', text: 'GET /contracts/{id}/pdf binary download signed contract', tag: 'GET /contracts/{id}/pdf' },
  { tabId: 'contracts', title: 'Payment formula', text: 'monthly payment PV principal value annual rate months formula calculation' },
  // Errors
  { tabId: 'errors', title: '200 OK', text: '200 ok successful get patch response', tag: '200' },
  { tabId: 'errors', title: '201 Created', text: '201 created resource post', tag: '201' },
  { tabId: 'errors', title: '400 Bad Request', text: '400 bad request invalid query body params', tag: '400' },
  { tabId: 'errors', title: '401 Unauthorized', text: '401 unauthorized missing expired jwt token', tag: '401' },
  { tabId: 'errors', title: '403 Forbidden', text: '403 forbidden role wrong endpoint', tag: '403' },
  { tabId: 'errors', title: '404 Not Found', text: '404 not found resource id', tag: '404' },
  { tabId: 'errors', title: '409 Conflict', text: '409 conflict duplicate passport product name', tag: '409' },
  { tabId: 'errors', title: '422 Unprocessable Entity', text: '422 pydantic validation error detail array field', tag: '422' },
  { tabId: 'errors', title: '500 Internal Server Error', text: '500 internal server error retry back-off', tag: '500' },
]

// ─── Shared UI components ─────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative rounded-xl bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-gray-400 text-xs font-mono uppercase">{lang}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-xs">
          {copied
            ? <><CheckCircleIcon className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
            : <><ClipboardDocumentIcon className="h-3.5 w-3.5" /><span>Copy</span></>}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">{code}</pre>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>
}

function Pill({ children, color = 'gray' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'orange' | 'red' | 'gray' | 'purple' }) {
  const colors = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-700',
  }
  return <span className={clsx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', colors[color])}>{children}</span>
}

function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE' }) {
  const colors = { GET: 'bg-blue-100 text-blue-700', POST: 'bg-green-100 text-green-700', PATCH: 'bg-orange-100 text-orange-700', DELETE: 'bg-red-100 text-red-700' }
  return <span className={clsx('font-mono text-xs font-bold px-2 py-0.5 rounded', colors[method])}>{method}</span>
}

function EndpointRow({ method, path, desc, roles }: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; desc: string; roles: string[]
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0 sm:w-80">
        <MethodBadge method={method} />
        <code className="text-xs font-mono text-gray-700 truncate">{path}</code>
      </div>
      <p className="text-sm text-gray-600 flex-1">{desc}</p>
      <div className="flex gap-1 flex-shrink-0">
        {roles.map(r => (
          <Pill key={r} color={r === 'CB' ? 'purple' : r === 'MFO' ? 'green' : 'blue'}>{r}</Pill>
        ))}
      </div>
    </div>
  )
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function OverviewPanel() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
        <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-1">Base URL</p>
        <code className="text-xl font-mono text-green-400">https://be.encode.uz/api/v1</code>
        <p className="text-slate-400 text-sm mt-3">
          All endpoints are prefixed with <code className="text-slate-300">/api/v1</code>. Production deployments
          replace the host; the path structure is unchanged.
        </p>
      </div>

      <div>
        <SectionTitle>Architecture overview</SectionTitle>
        <p className="text-sm text-gray-600 mb-4">
          The platform exposes a single RESTful JSON API consumed by the three role-based portals and any
          third-party integrations (POS terminals, external scoring bureaus, ERP systems).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'Merchant POS', color: 'border-blue-200 bg-blue-50', badge: 'blue' as const, items: ['Submit multi-product applications', 'Browse approved tariff offers', 'Track installment contracts'] },
            { title: 'MFO Admin', color: 'border-emerald-200 bg-emerald-50', badge: 'green' as const, items: ['Review & decide applications', 'Manage tariff plans', 'Configure scoring weights'] },
            { title: 'Central Bank', color: 'border-purple-200 bg-purple-50', badge: 'purple' as const, items: ['Approve / reject tariffs', 'Monitor all MFOs', 'Access full audit log'] },
          ].map(card => (
            <div key={card.title} className={clsx('rounded-xl border p-4', card.color)}>
              <div className="flex items-center gap-2 mb-3"><Pill color={card.badge}>{card.title}</Pill></div>
              <ul className="space-y-1.5">
                {card.items.map(i => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />{i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Integration flow</SectionTitle>
        <div className="flex flex-wrap gap-3 items-center text-sm text-gray-600">
          {['POST /auth/login → JWT', 'Attach Bearer token', 'Call API endpoints', 'Handle paginated responses'].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="h-5 w-5 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                <span>{step}</span>
              </div>
              {i < arr.length - 1 && <span className="text-gray-300">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Response envelope</SectionTitle>
        <CodeBlock lang="json" code={`// Paginated list
{
  "items": [...],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}

// Single resource
{
  "id": "uuid",
  "status": "APPROVED",
  ...
}

// Validation error
{
  "detail": [
    { "loc": ["body", "passport"], "msg": "field required", "type": "missing" }
  ]
}`} />
      </div>
    </div>
  )
}

function AuthPanel() {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Login & obtain a token</SectionTitle>
        <p className="text-sm text-gray-600 mb-3">
          All protected endpoints require a JWT Bearer token issued by <code className="bg-gray-100 px-1 rounded text-xs">POST /api/v1/auth/login</code>.
          Tokens expire after 30 minutes; use <code className="bg-gray-100 px-1 rounded text-xs">POST /api/v1/auth/refresh</code> to extend the session.
        </p>
        <CodeBlock lang="http" code={`POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "bobur@techmart.uz",
  "password": "demo1234"
}`} />
      </div>
      <div>
        <SectionTitle>Login response</SectionTitle>
        <CodeBlock lang="json" code={`{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "name": "Bobur Tashmatov",
    "email": "bobur@techmart.uz",
    "role": "MERCHANT",
    "organization": "TechMart LLC"
  }
}`} />
      </div>
      <div>
        <SectionTitle>Using the token</SectionTitle>
        <p className="text-sm text-gray-600 mb-3">Pass the token in the <code className="bg-gray-100 px-1 rounded text-xs">Authorization</code> header on every subsequent request.</p>
        <CodeBlock lang="http" code={`GET /api/v1/applications?page=1&page_size=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`} />
      </div>
      <div>
        <SectionTitle>Token refresh</SectionTitle>
        <CodeBlock lang="http" code={`POST /api/v1/auth/refresh
Authorization: Bearer <refresh_token>

// Response
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}`} />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 font-semibold mb-1">Role enforcement</p>
        <p className="text-sm text-amber-700">
          Each endpoint is guarded by role. Calling an endpoint outside your role returns
          <code className="bg-amber-100 px-1 rounded text-xs mx-1">403 Forbidden</code>.
          The three roles are <code className="bg-amber-100 px-1 rounded text-xs">MERCHANT</code>,{' '}
          <code className="bg-amber-100 px-1 rounded text-xs">MFO_ADMIN</code>, and{' '}
          <code className="bg-amber-100 px-1 rounded text-xs">CENTRAL_BANK</code>.
        </p>
      </div>
    </div>
  )
}

function ApplicationsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Endpoints</SectionTitle>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <EndpointRow method="POST" path="/applications/multi-product" desc="Submit a new multi-product installment application" roles={['Merchant']} />
          <EndpointRow method="GET" path="/applications" desc="List applications with filters and pagination" roles={['MFO', 'Merchant']} />
          <EndpointRow method="GET" path="/applications/{id}" desc="Retrieve a single application with full detail" roles={['MFO', 'Merchant']} />
          <EndpointRow method="POST" path="/applications/{id}/confirm" desc="Confirm application — select tariff and term" roles={['Merchant']} />
          <EndpointRow method="PATCH" path="/applications/{id}/decide" desc="Approve or reject an application" roles={['MFO']} />
        </div>
      </div>
      <div>
        <SectionTitle>Submit a multi-product application</SectionTitle>
        <p className="text-sm text-gray-600 mb-3">Send client info and a list of products in one request. The engine runs fraud checks and credit scoring immediately and returns eligible tariff offers.</p>
        <CodeBlock lang="json" code={`POST /api/v1/applications/multi-product
Authorization: Bearer <merchant_token>

{
  "client": {
    "name": "Alisher Nazarov",
    "passport": "AB1234567",
    "phone": "+998901234567",
    "monthly_income": 5000000,
    "age": 32,
    "employment_type": "EMPLOYED",
    "credit_history": "GOOD",
    "open_loans": 1
  },
  "items": [
    { "product_id": "uuid-1", "quantity": 1 },
    { "product_id": "uuid-2", "quantity": 2 }
  ],
  "face_image": "data:image/jpeg;base64,/9j/4AAQ...",
  "signature": "data:image/png;base64,iVBOR..."
}`} />
      </div>
      <div>
        <SectionTitle>Application response</SectionTitle>
        <CodeBlock lang="json" code={`{
  "id": "app-uuid",
  "status": "PENDING",
  "total_amount": 12500000,
  "score": 78,
  "fraud_gate": "PASS",
  "eligible_tariffs": [
    {
      "tariff_id": "tariff-uuid",
      "tariff_name": "Standard 12M",
      "annual_rate": 18.5,
      "available_months": [3, 6, 9, 12],
      "monthly_payment_12": 1145833
    }
  ],
  "application_items": [
    { "product_id": "uuid-1", "name": "Laptop X1", "price": 8500000, "quantity": 1 },
    { "product_id": "uuid-2", "name": "Mouse Pro", "price": 2000000, "quantity": 2 }
  ]
}`} />
      </div>
      <div>
        <SectionTitle>Confirm the application</SectionTitle>
        <CodeBlock lang="json" code={`POST /api/v1/applications/{id}/confirm
Authorization: Bearer <merchant_token>

{
  "tariff_id": "tariff-uuid",
  "months": 12
}`} />
      </div>
      <div>
        <SectionTitle>Fraud gate statuses</SectionTitle>
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { gate: 'PASS', color: 'green' as const, desc: 'No fraud signals — proceed normally' },
            { gate: 'FLAG', color: 'orange' as const, desc: 'Suspicious — MFO must manually review' },
            { gate: 'BLOCK', color: 'red' as const, desc: 'Blocked — duplicate passport within 24 h' },
          ].map(g => (
            <div key={g.gate} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <Pill color={g.color}>{g.gate}</Pill>
              <span className="text-gray-600">{g.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScoringPanel() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">The scoring engine is deterministic and rule-based — the same inputs always produce the same score. Weights are configurable per tariff by MFO admins.</p>
      <div>
        <SectionTitle>Scoring factors</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-700">Factor</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Default weight</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Key rule</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['F1 Affordability', '40%', 'DTI (income / payment): ≥5→100, ≥3→80, ≥2→50, ≥1.5→30'],
                ['F2 Credit history', '30%', 'GOOD→100 · FAIR→65 · NONE→25 · BAD→0'],
                ['F3 Behavioral', '20%', 'Open loans: 0→100, 1→85, 2→70, 3→50, 4→30, 5+→10'],
                ['F4 Demographic', '10%', 'Age 25–45→100 · 18–55→70 · 18–65→40'],
              ].map(([f, w, rule]) => (
                <tr key={f} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{f}</td>
                  <td className="px-4 py-3 text-gray-600">{w}</td>
                  <td className="px-4 py-3 text-gray-600">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <SectionTitle>Score outcomes</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'APPROVED', desc: 'Score ≥ tariff minimum score', color: 'border-green-200 bg-green-50', pill: 'green' as const },
            { label: 'PARTIAL', desc: 'Score ≥ 50 — 70% of requested amount', color: 'border-orange-200 bg-orange-50', pill: 'orange' as const },
            { label: 'REJECTED', desc: 'Score < 50 or hard reject triggered', color: 'border-red-200 bg-red-50', pill: 'red' as const },
          ].map(o => (
            <div key={o.label} className={clsx('rounded-xl border p-4', o.color)}>
              <Pill color={o.pill}>{o.label}</Pill>
              <p className="text-sm text-gray-600 mt-2">{o.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Test the scoring engine</SectionTitle>
        <CodeBlock lang="json" code={`POST /api/v1/scoring/calculate
Authorization: Bearer <any_token>

{
  "monthly_income": 5000000,
  "monthly_payment": 1200000,
  "credit_history": "GOOD",
  "open_loans": 1,
  "age": 32,
  "tariff_id": "tariff-uuid"
}

// Response
{
  "score": 78,
  "outcome": "APPROVED",
  "breakdown": {
    "affordability": { "score": 80, "weight": 0.4, "weighted": 32.0 },
    "credit_history": { "score": 100, "weight": 0.3, "weighted": 30.0 },
    "behavioral": { "score": 85, "weight": 0.2, "weighted": 17.0 },
    "demographic": { "score": 100, "weight": 0.1, "weighted": 10.0 }
  }
}`} />
      </div>
      <div>
        <SectionTitle>Hard reject rules</SectionTitle>
        <p className="text-sm text-gray-600 mb-3">These checks run before scoring. Any match instantly rejects the application.</p>
        <div className="space-y-2">
          {[
            'Bankruptcy flag is true',
            'open_loans > tariff.max_open_loans',
            'overdue_days > tariff.max_overdue_days',
            'DTI (income / payment) < tariff.hard_dti_min',
          ].map(rule => (
            <div key={rule} className="flex items-center gap-2 text-sm text-gray-700 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500 shrink-0" />{rule}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FacePanel() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Face verification is an optional step in the merchant application flow. It captures a webcam frame and sends it to the backend for identity confirmation. The backend stores the image alongside the application record.</p>
      <div>
        <SectionTitle>Endpoint</SectionTitle>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <EndpointRow method="POST" path="/face_verify" desc="Submit a base64-encoded face image for an application" roles={['Merchant']} />
        </div>
      </div>
      <div>
        <SectionTitle>Request</SectionTitle>
        <CodeBlock lang="json" code={`POST /api/v1/face_verify
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "application_id": "app-uuid",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
}`} />
      </div>
      <div>
        <SectionTitle>Response</SectionTitle>
        <CodeBlock lang="json" code={`{
  "verified": true,
  "confidence": 0.97,
  "message": "Face captured and stored"
}`} />
      </div>
      <div>
        <SectionTitle>Integration notes</SectionTitle>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            'Images must be JPEG or PNG encoded as a data URI (data:image/jpeg;base64,...)',
            'Maximum image size: 2 MB before base64 encoding',
            'Verification is non-blocking — a failed capture does not prevent the application from being submitted',
            'The stored image is viewable by MFO admins in the application detail panel',
          ].map(note => (
            <li key={note} className="flex items-start gap-2">
              <CheckCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />{note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ContractsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Endpoints</SectionTitle>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <EndpointRow method="GET" path="/contracts" desc="List contracts with pagination" roles={['MFO', 'Merchant']} />
          <EndpointRow method="GET" path="/contracts/{id}" desc="Get contract details" roles={['MFO', 'Merchant']} />
          <EndpointRow method="GET" path="/contracts/{id}/schedule" desc="Get the full installment payment schedule" roles={['MFO', 'Merchant']} />
          <EndpointRow method="GET" path="/contracts/{id}/pdf" desc="Download the signed contract as a PDF (binary)" roles={['MFO', 'Merchant']} />
        </div>
      </div>
      <div>
        <SectionTitle>Payment schedule</SectionTitle>
        <CodeBlock lang="json" code={`GET /api/v1/contracts/{id}/schedule
Authorization: Bearer <token>

// Response
{
  "contract_id": "contract-uuid",
  "total_amount": 12500000,
  "annual_rate": 18.5,
  "months": 12,
  "monthly_payment": 1145833,
  "schedule": [
    { "month": 1, "due_date": "2026-04-15", "principal": 978166, "interest": 167667, "balance": 11521834 },
    { "month": 2, "due_date": "2026-05-15", "principal": 993352, "interest": 152481, "balance": 10528482 }
  ]
}`} />
      </div>
      <div>
        <SectionTitle>PDF download</SectionTitle>
        <p className="text-sm text-gray-600 mb-3">Set the <code className="bg-gray-100 px-1 rounded text-xs">Accept</code> header to <code className="bg-gray-100 px-1 rounded text-xs">application/pdf</code> and write the response body to a file or blob.</p>
        <CodeBlock lang="http" code={`GET /api/v1/contracts/{id}/pdf
Authorization: Bearer <token>
Accept: application/pdf

// Response headers
Content-Type: application/pdf
Content-Disposition: attachment; filename="contract-{id}.pdf"`} />
      </div>
      <div>
        <SectionTitle>Payment formula</SectionTitle>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-700">
          monthly_payment = PV × r × (1+r)^n / ((1+r)^n − 1)
          <br />
          <span className="text-gray-500 text-xs">where r = annual_rate / 100 / 12,  n = number of months</span>
        </div>
      </div>
    </div>
  )
}

function ErrorsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>HTTP status codes</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-700">Code</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Meaning</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Common causes</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['200', 'OK', 'Successful GET or PATCH'],
                ['201', 'Created', 'Resource created (POST)'],
                ['400', 'Bad Request', 'Invalid request body or query params'],
                ['401', 'Unauthorized', 'Missing or expired JWT token'],
                ['403', 'Forbidden', 'Valid token but wrong role for endpoint'],
                ['404', 'Not Found', 'Resource ID does not exist or is not owned by you'],
                ['409', 'Conflict', 'Duplicate passport, duplicate product name'],
                ['422', 'Unprocessable Entity', 'Pydantic validation error — check the detail array'],
                ['500', 'Internal Server Error', 'Unexpected backend error — contact support'],
              ].map(([code, meaning, causes]) => (
                <tr key={code} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><Pill color={code.startsWith('2') ? 'green' : code.startsWith('4') ? 'orange' : 'red'}>{code}</Pill></td>
                  <td className="px-4 py-3 font-medium text-gray-800">{meaning}</td>
                  <td className="px-4 py-3 text-gray-600">{causes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <SectionTitle>Validation error shape</SectionTitle>
        <CodeBlock lang="json" code={`// HTTP 422
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "client", "passport"],
      "msg": "Field required"
    },
    {
      "type": "string_too_short",
      "loc": ["body", "client", "phone"],
      "msg": "String should have at least 9 characters",
      "input": "+99"
    }
  ]
}`} />
      </div>
      <div>
        <SectionTitle>Fraud block response</SectionTitle>
        <CodeBlock lang="json" code={`// HTTP 200 — fraud gate is part of the application, not an HTTP error
{
  "id": "app-uuid",
  "status": "PENDING",
  "fraud_gate": "BLOCK",
  "fraud_reason": "Duplicate passport detected within 24h window",
  "eligible_tariffs": []
}`} />
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800 font-semibold mb-1">Retry guidance</p>
        <p className="text-sm text-blue-700">
          <code className="bg-blue-100 px-1 rounded text-xs">401</code> — refresh the token and retry once.{' '}
          <code className="bg-blue-100 px-1 rounded text-xs">409</code> — do not retry; resolve the conflict first.{' '}
          <code className="bg-blue-100 px-1 rounded text-xs">500</code> — safe to retry with exponential back-off (max 3 attempts).
        </p>
      </div>
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: CodeBracketIcon },
  { id: 'auth', label: 'Authentication', icon: KeyIcon },
  { id: 'applications', label: 'Applications API', icon: ArrowPathIcon },
  { id: 'scoring', label: 'Scoring Engine', icon: CpuChipIcon },
  { id: 'face', label: 'Face Verification', icon: CameraIcon },
  { id: 'contracts', label: 'Contracts & PDF', icon: DocumentTextIcon },
  { id: 'errors', label: 'Error Handling', icon: ExclamationTriangleIcon },
]

const PANELS: Record<TabId, React.ComponentType> = {
  overview: OverviewPanel,
  auth: AuthPanel,
  applications: ApplicationsPanel,
  scoring: ScoringPanel,
  face: FacePanel,
  contracts: ContractsPanel,
  errors: ErrorsPanel,
}

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  auth: 'Authentication',
  applications: 'Applications API',
  scoring: 'Scoring Engine',
  face: 'Face Verification',
  contracts: 'Contracts & PDF',
  errors: 'Error Handling',
}

// ─── Search results panel ─────────────────────────────────────────────────────

function SearchResults({ query, onNavigate }: { query: string; onNavigate: (tab: TabId) => void }) {
  const q = query.toLowerCase().trim()
  const results = useMemo(() =>
    SEARCH_INDEX.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.text.toLowerCase().includes(q)
    ), [q])

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
        <MagnifyingGlassIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No results for "{query}"</p>
        <p className="text-gray-400 text-sm mt-1">Try searching for an endpoint, HTTP status code, or topic.</p>
      </div>
    )
  }

  // Group by tab
  const grouped = results.reduce<Record<TabId, SearchItem[]>>((acc, item) => {
    if (!acc[item.tabId]) acc[item.tabId] = []
    acc[item.tabId].push(item)
    return acc
  }, {} as Record<TabId, SearchItem[]>)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{results.length} result{results.length !== 1 ? 's' : ''} for <span className="font-semibold text-gray-700">"{query}"</span></p>
      {(Object.entries(grouped) as [TabId, SearchItem[]][]).map(([tabId, items]) => (
        <div key={tabId} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
            {(() => { const tab = TABS.find(t => t.id === tabId)!; return <tab.icon className="h-4 w-4 text-gray-400" /> })()}
            <span className="text-sm font-semibold text-gray-700">{TAB_LABELS[tabId]}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <button
                key={item.title}
                onClick={() => onNavigate(item.tabId)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  {item.tag && <code className="text-xs text-gray-500 font-mono">{item.tag}</code>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">Go to section →</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [query, setQuery] = useState('')

  const isSearching = query.trim().length > 0
  const ActivePanel = PANELS[activeTab]

  const handleNavigate = (tab: TabId) => {
    setActiveTab(tab)
    setQuery('')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Standalone top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
              <span className="text-white font-bold text-xs">MIP</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm hidden sm:block">Integration Docs</span>
          </div>

          {/* Search bar */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search endpoints, topics, status codes…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-9 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            />
            {isSearching && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 transition-colors"
              >
                <XMarkIcon className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Swagger link */}
          <a
            href="https://be.encode.uz/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
          >
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Swagger UI
          </a>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Integration Reference</h1>
              <p className="text-white/70 text-sm mt-1">
                Authentication, application lifecycle, scoring engine, face verification, and contracts.
                No account required to read these docs.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {['REST / JSON', 'JWT Bearer auth', 'FastAPI 0.111', 'Pydantic v2', 'OpenAPI /docs'].map(tag => (
              <span key={tag} className="rounded-full bg-white/15 px-3 py-1">{tag}</span>
            ))}
          </div>
        </div>

        {isSearching ? (
          <SearchResults query={query} onNavigate={handleNavigate} />
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
                    activeTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/60',
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <ActivePanel />
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Interactive API docs at{' '}
          <code className="bg-gray-100 px-1 rounded">https://be.encode.uz/docs</code>
          {' '}(Swagger UI) and{' '}
          <code className="bg-gray-100 px-1 rounded">https://be.encode.uz/redoc</code>
          {' '}(ReDoc).
        </p>
      </main>
    </div>
  )
}
