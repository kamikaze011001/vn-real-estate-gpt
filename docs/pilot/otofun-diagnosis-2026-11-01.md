# OTOFUN access diagnosis — 1 November 2026

The user asked to debug OTOFUN first because it is an important source, and to research additional sources including Facebook. This note separates the observed external failure from a worker-side retry problem. Additional-source findings are in [the sourced research note](../research/hanoi-source-expansion-2026-11-01.md).

## Reproduction and narrowed causes

The [GitHub run with detailed diagnostics](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41272135309) failed with seven OTOFUN network failures and one HTTP 503. VOZ returned four HTTP 200 responses, observed three source records and had no errors. The seven existing shared candidates remained stored; no qualifying new candidates were added. Their numeric values, availability and legal-document claims were not upgraded.

A local single-request reproduction using `Fetcher.get()` failed at the robots-policy endpoint with HTTP 503 before any property parsing. The same robots request through curl, with the same honest crawler User-Agent and Accept header, also returned HTTP 503 over HTTP/2. Its 107-byte error response said “No server is available to handle this request.” No post body or credentials were sent or saved by the probe. The subsequent bounded pipeline check obtained robots HTTP 200 followed by a source-page HTTP 503: the affected endpoint varies, so this is not solely a missing robots file.

Ranked hypotheses and checks:

1. **Wrong/obsolete hostname.** All seven candidates use `www.otofun.net.vn`. OTOFUN's [own service agreement](https://www.otofun.net.vn/threads/thoa-thuan-cung-cap-va-su-dung-dich-vu-mang-xa-hoi-otofun.1962611/) names both `otofun.net.vn` and `otofun.net`; both configured `www` names and their apex names resolved to `210.245.88.132`. This does not support changing aliases as a fix, and no alternate-host retry was introduced.
2. **Source HTTP/backend availability along this network path.** Supported by the explicit server-unavailable 503 and failures using both clients. This does not prove a worldwide outage or identify the operator's internal cause; access-policy/routing differences remain possible.
3. **Local DNS/TLS/parser bug.** Ordinary TCP/TLS checks succeeded for OTOFUN (TLS 1.3) and VOZ. No proxy schemes were configured in the local Python environment. Python and curl produced the same HTTP failure; parsing was not reached. A native Brave navigation to the robots URL stalled without producing a completed response and was closed; it is not evidence of successful browser access. Chrome was untouched.
4. **Only excessive request volume.** A single robots request after the earlier run still failed. This weakens a volume-only explanation but does not establish what rate controls the publisher applies.

The initial conclusion was an HTTP/source-availability obstacle in the tested crawler path, with a separate local worker defect that amplified failures. The subsequent normal-client success below narrows that conclusion: OTOFUN is accessible, and the failure depends on the request path/profile or time. It must not be described as a confirmed general source outage. Changing parsers alone cannot repair an HTTP failure.

## Follow-up: ordinary Requests and BeautifulSoup succeeded

After the user reported that normal browsing worked and requested a normal Python crawl, the exact retained [OTOFUN thread](https://www.otofun.net.vn/threads/can-ho-chung-cu-ecopark-onsen.1968309/) loaded in native Brave without signing in. This corrects any implication that only cached content was accessible; the earlier stalled robots navigation did not establish that ordinary thread browsing failed.

An isolated temporary Python environment with Requests 2.34.2 and BeautifulSoup 4.15.0 then made a normal fresh-session request using the library's honest default `python-requests/2.34.2` identity. Robots and the exact thread both returned HTTP 200 in approximately 0.13/0.15 seconds. Robots permitted the request. BeautifulSoup parsed 20 post containers and identified the original opening-post key `post-73122262`. The heading is marked expired, so successful access does not make the ad current inventory. No body, comments, contacts, images or browser cookies were imported into Supabase. The local credential-free result is retained in `artifacts/otofun-requests-bs-probe-2026-11-01.json` (ignored).

A subsequent comparison found the existing urllib client timed out at robots, while Requests configured with the existing custom crawler User-Agent/Accept returned robots HTTP 503. The normal Requests success and custom-profile failure support investigating HTTP client/session/header compatibility, not replacing the HTML parser as an access fix. These requests happened sequentially, so time-varying availability remains a confounder; a particular header or bot filter has not been proven responsible. No browser identity, authentication cookies, proxy, CAPTCHA bypass or TLS-verification bypass was used.

BeautifulSoup is viable for normal returned HTML; it does not issue HTTP requests or resolve a 503. References: [Requests response/status handling](https://requests.readthedocs.io/en/latest/user/quickstart/), [BeautifulSoup HTML parsing](https://www.crummy.com/software/BeautifulSoup/bs4/doc/).

### Integrated normal-client change

Following the user's instruction to continue, the feature branch now uses a normal Requests session for OTOFUN in the actual `Fetcher`, with its fixed honest Python identity throughout a run. VOZ retains its previous urllib transport/profile. Robots uses that same identity. TLS verification, redirect validation, publisher outage/access stops and decompressed response bounds remain enforced. Environment proxy/netrc credentials are disabled; anonymous source-set cookies remain in memory only. The existing tested field extraction is retained; a read-only `--thread` probe additionally checks BeautifulSoup agrees on the opening-post key. Pinned requirements, a local ignored virtual environment and CI installation make the same client available locally and to the scheduled worker after merge.

All 55 local Python tests pass, including response-size, TLS/redirect configuration, timeout and actual-identity robots checks. The first integrated live probe then timed out at robots after eight seconds. A local prepared-request comparison confirmed that neither the earlier normal prototype nor this client had ambient authorization, proxies or a custom certificate path. The earlier success therefore remains valid evidence of normal Python access, but the integrated client is not yet verified reliable. No automatic header/client rotation or retries were added after the failure. Do not call the source recovered until a normal actual pipeline run succeeds. The change remains on the feature branch pending CI/merge and GitHub-runner verification.

## Worker fix

Before the fix, a robots outage was not remembered for the run: each queued item could request the failed policy again. Network failures and 5xx responses also allowed the worker to continue requesting other pages from the same source. The old three-minute GitHub probe attempted nine OTOFUN requests and reported eight errors.

The crawler now records temporary publisher unavailability on a network failure or 5xx. Later refresh/discovery attempts in that run stop, including attempts via either OTOFUN alias. VOZ proceeds independently. A fresh worker has a fresh transient state, so a later scheduled attempt can detect recovery without an operator clearing an access restriction. Existing 401/403/429, challenge, robots, URL allowlist and redirect restrictions remain enforced.

Network diagnostics retain only fixed categories: timeout, DNS, TLS, reset, refused, unreachable or other. Raw exception messages, cookies, contacts and source content do not enter the shared run report. New/changed source observations still require review and cannot publish themselves as approved listings.

## Validation

- **Regression:** tests first failed with `request.call_count == 3` instead of `1` for repeated robots 503 and nested network timeouts. They pass after the fix; separate checks cover a page 503 after valid robots, recovery in a fresh worker, and independent VOZ continuation through daily collection.
- **Local suite:** all 51 Python crawler/review/preview/pipeline tests pass, including the loopback preview check.
- **Actual local pipeline + cloud inbox:** `npm run pipeline -- collect --apply --pages 1 --threads 1` produced OTOFUN `failed`, VOZ `ok`, six total requests and one source error. OTOFUN made two requests (robots 200, page 503) and then stopped; VOZ made four successful requests and observed three source records. No qualifying new candidates or listings were added. This is a local worker against the shared inbox, not a new GitHub-runner verification of the changed code.
- **Read-only command:** `npm run pipeline:probe -- --source otofun` uses the real transport, robots policy and marketplace parser; `--source voz` uses the real property feed/parser. It never loads deployment credentials or writes shared data. A failure exits nonzero and prints only status/categories/counts.
- No public UI, MCP tools/resources, app connection, new-source schedule or publication behavior changes. No new actual-ChatGPT test is claimed for this worker-only change.

## Recovery and additional sources

Keep OTOFUN enabled as an important source, preserve previous observations until their existing expiry, and make a bounded normal attempt on a later run. Do not mark missing fetches sold or reconfirmed. If the failure persists, an operator-supported feed/access arrangement is the practical next investigation; this task has not contacted OTOFUN or committed to a commercial agreement. Recovery cannot be declared until a normal permitted fetch and parser check succeeds in the actual worker environment.

The source expansion note prioritizes Batdongsan, Nhà Tốt/Chợ Tốt, Alonhadat and Muaban for discovery; OneHousing and Tân Long for possible original supplier relationships; Homedy as a secondary discovery source; and licensed/official context separately. These are researched candidates, not newly activated collectors. Facebook Groups, Marketplace and supplier Pages have distinct access and reuse conditions, documented without assuming that human visibility or administrator consent supplies a working automated API.

A bounded local pipeline run of the initial all-Requests version failed: OTOFUN timed out, and VOZ returned robots 200/feed 403. It collected no candidates. The migration was narrowed to OTOFUN before release, preserving VOZ's previously working client and identity. The blocked VOZ request was not retried using another profile in that run. A regression test locks down the fixed per-source transport choice. No new local collection is claimed after that correction; existing shared candidates remain subject to their prior expiry.
