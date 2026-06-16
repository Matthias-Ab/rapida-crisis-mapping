# RAPIDA — Product Roadmap & Ambitious Ideas

Ideas beyond the current prototype. Documented for evaluators, future contributors, and UNDP product planning.

---

## What's in the prototype today

- Voice-to-report (NLP field detection in 6 UN languages)
- AI damage classification (client-side, ONNX)
- Auto-SITREP generation (Groq/Llama 3.3)
- Needs heatmap with per-type filtering
- Consolidated incident view (DBSCAN geographic clustering)
- Response dispatch tracker
- Report description auto-translation
- Quick 3-step form (civilians) vs detailed 5-step form (responders)
- Low-bandwidth mode (auto photo compression on 2G)
- Mass incident auto-detection

---

## Near-term (next sprint, 1–2 weeks)

### Consensus Engine
Multiple reports for the same location should produce a single confidence-weighted verdict, not N separate dots. When 5 independent reporters all say "complete damage, earthquake, rescue needed" at the same coordinates, the system should surface: *"5 confirmations — high confidence — rescue priority."* A verified Red Cross report should count 10× a first-time anonymous report.

### Role-based Access
Four distinct personas need different interfaces:

| Role | Entry point | Form | Access |
|---|---|---|---|
| **Reporter** (public) | /submit | 3-step quick form | Submit only |
| **Responder** (Red Cross, police) | /respond | Full 5-step + household count, access route, hazard notes | Submit + view own |
| **Analyst** (local NGOs) | /dashboard (read-only) | — | View, filter, export |
| **Admin** (UNDP) | /dashboard (full) | — | Everything + dispatch + verify + SITREP |

Responders get additional fields: estimated affected households, safe access route (free text), hazard type (gas leak, structural risk, flooding depth), and a severity scale 1–5 aligned with the Saffir-Simpson / Modified Mercalli Intensity scales.

### UNDP PDNA Alignment
Full alignment with UNDP's Post-Disaster Needs Assessment (PDNA) sector categories:
- Housing & shelter
- Education (schools affected)
- Health (facilities, personnel)
- Livelihoods (economic damage)
- Infrastructure (roads, water, power, telecoms)
- Social protection (vulnerable populations)

---

## Medium-term (1–3 months)

### Satellite Cross-Validation
Automatically cross-reference ground-truth reports with freely available SAR (Synthetic Aperture Radar) imagery from Copernicus Sentinel-1. When a cluster of "complete damage" reports appears, pull the nearest cloud-free optical or SAR tile and overlay it in the dashboard. Adds an independent layer of confidence without any API cost (Copernicus data is open).

### Community Validation / Upvoting
After a report is submitted, other field reporters who visit the same area can tap "I confirm this" on a shared report link — incrementing a verification counter. No login required. Stops noise from a single bad actor inflating counts while amplifying genuine mass events.

### AI Photo Evidence Assessment
Use a fine-tuned vision model (or few-shot prompting with the existing Groq API) to assess submitted photos for:
- Whether the photo actually shows a building (not a blank wall / sky / selfie)
- Whether the damage described matches what's visible
- Estimated severity from the image alone, as a cross-check against the user-selected level

This auto-flags reports where photo and form contradict each other for human analyst review.

### Federated Intake
Allow external data sources to push reports into RAPIDA via a standard API:
- WhatsApp bot (Twilio)
- SMS gateway (short code + keyword parsing)
- Twitter/X keyword monitoring
- Satellite change-detection webhooks (Planet, Maxar)

Each source gets a trust score. Bot-submitted reports never appear as verified without human review.

---

## Long-term / Ambitious (3–12 months)

### Predictive Damage Mapping
Use historical crisis patterns + current report clusters + building inventory data (OpenStreetMap building footprints + estimated construction quality) to generate a heatmap of *expected* damage in areas that haven't reported yet. This helps coordinate proactive inspection teams rather than reactive response.

### Responder Coordination Map
Real-time layer showing active response team locations (opt-in GPS from the responder app). Each responder is assigned to a specific open report. The map shows: unassigned reports (red), assigned-in-progress (amber), resolved (green). Eliminates duplicate deployment to the same incident.

### Offline-First Field Tablet Mode
A PWA skin optimised for a 10" Android tablet used by field assessment teams with no internet. The tablet syncs a local copy of the damage map before going offline. Field workers walk through an area, submitting reports that queue locally. On return to base (WiFi), the entire queue uploads and the central map updates. The tablet view shows a split: map on the left, rapid-entry form on the right — one-handed operation.

### Multi-Hazard Compound Events
Detect reports that indicate compound crises: earthquake + tsunami reports in the same coastal area within 30 minutes. Surface a compound-event alert with automated cascade risk assessment (the earthquake may trigger a tsunami, fires, building collapse AND infrastructure failure simultaneously). Currently RAPIDA treats each crisis type independently.

### Natural Language Query Interface
An analyst-facing query bar powered by the existing Groq integration: *"Show me all complete-damage residential buildings in Kharkiv reported in the last 6 hours with rescue needs"* — translated into API filter parameters automatically. Removes the need to understand the dashboard filter UI for time-pressured analysts.

### Integration with OCHA's HDX
Automatic data push to UN OCHA's Humanitarian Data Exchange (HDX) at configurable intervals. Datasets published as open data under CC BY for use by the broader humanitarian community. RAPIDA becomes a real-time feeder into the global humanitarian data ecosystem.

---

## Known limitations of current approach

1. **Grid bias**: The original grid clustering (since replaced with DBSCAN) had edge cases at grid boundaries. DBSCAN solves this but requires PostGIS — not available on all free DB tiers.

2. **No ground truth**: We have no way to close the loop — once a report is submitted we don't know if the damage was real or has been remediated. Responder confirmation (dispatch tracker) is a partial fix.

3. **Session-based identity**: Anonymous sessions mean one phone can generate unlimited reports with different session IDs. Rate limiting per IP helps but doesn't fully prevent gaming.

4. **Photo spoofing**: Anyone can upload an irrelevant photo. The AI quality check flags obvious non-building photos but isn't foolproof.

5. **Language quality**: The NLP voice parser uses keyword lists. For low-resource languages or dialectal variation (Ethiopian Amharic, Libyan Arabic) the detection accuracy drops. A fine-tuned NER model per language would fix this.
